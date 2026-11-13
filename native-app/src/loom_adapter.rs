//! Native adapter: connects the eframe workbench to the real Loom server.
//! Blocking HTTP over TcpStream (same pattern as src-tauri/src/lib.rs),
//! but the response body is bounded by Content-Length when present and
//! de-chunked when transfer-encoding is chunked; read-until-EOF is only
//! the last resort, capped at 16 MB. No new dependencies: std + serde_json.

use crate::adapter::{AgentActivity, AgentAdapter, ContextPack};
use crate::knowledge::State;
use serde_json::Value;
use std::io::{BufRead, BufReader, Write};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

const LOOM_ADDR: &str = "127.0.0.1:5006";
const LOOM_HOST: &str = "127.0.0.1:5006";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(2);
const WRITE_TIMEOUT: Duration = Duration::from_secs(5);
const GET_READ_TIMEOUT: Duration = Duration::from_secs(4);
const POST_READ_TIMEOUT: Duration = Duration::from_secs(180);
const MAX_BODY_BYTES: usize = 16 * 1024 * 1024;
const MAX_HEADER_BYTES: usize = 64 * 1024;

/// First non-empty text key wins, in the order the Tauri backend uses.
const TEXT_KEYS: [&str; 5] = ["text", "response", "content", "reply", "message"];

pub struct LoomHttpAdapter;

impl Default for LoomHttpAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl LoomHttpAdapter {
    pub fn new() -> Self {
        Self
    }

    /// Raw HTTP request to Loom. Returns (status, body_bytes).
    pub fn loom_request(
        &self,
        method: &str,
        path: &str,
        body: Option<&str>,
    ) -> Result<(u16, Vec<u8>), String> {
        self.request_to(LOOM_ADDR, method, path, body)
    }

    fn request_to(
        &self,
        addr: &str,
        method: &str,
        path: &str,
        body: Option<&str>,
    ) -> Result<(u16, Vec<u8>), String> {
        let socket: SocketAddr = addr
            .parse()
            .map_err(|e| format!("Bad Loom address {addr}: {e}"))?;
        let mut stream = TcpStream::connect_timeout(&socket, CONNECT_TIMEOUT)
            .map_err(|e| format!("Loom is unavailable. Start looms serve --http-port 5006. {e}"))?;
        let read_timeout = if body.is_some() {
            POST_READ_TIMEOUT
        } else {
            GET_READ_TIMEOUT
        };
        stream
            .set_read_timeout(Some(read_timeout))
            .map_err(|e| e.to_string())?;
        stream
            .set_write_timeout(Some(WRITE_TIMEOUT))
            .map_err(|e| e.to_string())?;
        let body = body.unwrap_or("");
        let request = format!(
            "{method} {path} HTTP/1.1\r\nHost: {LOOM_HOST}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        stream
            .write_all(request.as_bytes())
            .map_err(|e| e.to_string())?;
        let mut reader = BufReader::new(stream);
        read_response(&mut reader)
    }

    /// Parse a JSON response body into a Value.
    pub fn parse_json(&self, payload: &[u8]) -> Result<Value, String> {
        serde_json::from_slice(payload).map_err(|e| format!("Invalid Loom response: {e}"))
    }

    /// First non-empty string among text/response/content/reply/message.
    pub fn extract_text(value: &Value) -> Result<String, String> {
        for key in TEXT_KEYS {
            if let Some(text) = value.get(key).and_then(|v| v.as_str()) {
                if !text.trim().is_empty() {
                    return Ok(text.to_string());
                }
            }
        }
        Err("Loom returned no text. Check its agent configuration.".into())
    }
}

/// Read one HTTP response from a buffered reader: headers first, then the
/// body bounded by Content-Length when present, de-chunked when the
/// transfer encoding is chunked, and only as a last resort read until the
/// connection closes, capped at 16 MB.
fn read_response<R: BufRead>(reader: &mut R) -> Result<(u16, Vec<u8>), String> {
    let mut head = Vec::new();
    let mut line = Vec::new();
    loop {
        line.clear();
        let n = reader
            .read_until(b'\n', &mut line)
            .map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("Loom closed the connection before sending a response".into());
        }
        head.extend_from_slice(&line);
        if head.len() > MAX_HEADER_BYTES {
            return Err("Loom response headers exceeded 64 KB".into());
        }
        if line == b"\r\n" || line == b"\n" {
            break;
        }
    }
    let head_text = String::from_utf8_lossy(&head);
    let mut lines = head_text.lines();
    let status_line = lines.next().ok_or("Invalid HTTP response")?;
    let status: u16 = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|v| v.parse().ok())
        .ok_or("Invalid HTTP status")?;
    let mut content_length: Option<usize> = None;
    let mut chunked = false;
    for line in lines {
        if let Some((name, value)) = line.split_once(':') {
            match name.trim().to_ascii_lowercase().as_str() {
                "content-length" => {
                    content_length = value.trim().parse().ok();
                }
                "transfer-encoding" => {
                    if value.to_ascii_lowercase().contains("chunked") {
                        chunked = true;
                    }
                }
                _ => {}
            }
        }
    }
    if let Some(len) = content_length {
        if len > MAX_BODY_BYTES {
            return Err("Loom response exceeded 16 MB.".into());
        }
        let mut body = vec![0u8; len];
        reader
            .read_exact(&mut body)
            .map_err(|e| format!("Loom closed the connection early: {e}"))?;
        return Ok((status, body));
    }
    if chunked {
        return Ok((status, read_chunked(reader)?));
    }
    let mut body = Vec::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        body.extend_from_slice(&buf[..n]);
        if body.len() > MAX_BODY_BYTES {
            return Err("Loom response exceeded 16 MB.".into());
        }
    }
    Ok((status, body))
}

fn read_chunked<R: BufRead>(reader: &mut R) -> Result<Vec<u8>, String> {
    let mut body = Vec::new();
    loop {
        let mut line = String::new();
        reader.read_line(&mut line).map_err(|e| e.to_string())?;
        let size = usize::from_str_radix(line.split(';').next().unwrap_or("").trim(), 16)
            .map_err(|e| format!("Invalid chunk header: {e}"))?;
        if size == 0 {
            loop {
                let mut trailer = String::new();
                reader.read_line(&mut trailer).map_err(|e| e.to_string())?;
                if trailer == "\r\n" || trailer == "\n" || trailer.is_empty() {
                    break;
                }
            }
            break;
        }
        if body.len() + size > MAX_BODY_BYTES {
            return Err("Loom response exceeded 16 MB.".into());
        }
        let mut chunk = vec![0u8; size];
        reader
            .read_exact(&mut chunk)
            .map_err(|e| format!("Incomplete HTTP chunk: {e}"))?;
        body.extend_from_slice(&chunk);
        let mut crlf = [0u8; 2];
        reader
            .read_exact(&mut crlf)
            .map_err(|e| format!("Incomplete HTTP chunk: {e}"))?;
    }
    Ok(body)
}

impl AgentAdapter for LoomHttpAdapter {
    fn activity(&self) -> AgentActivity {
        match self.loom_request("GET", "/v1/health", None) {
            Ok((status, _)) if (200..300).contains(&status) => AgentActivity {
                state: State::Idle,
                execution_id: None,
                evidence: Vec::new(),
            },
            _ => AgentActivity {
                state: State::Error,
                execution_id: None,
                evidence: Vec::new(),
            },
        }
    }

    fn submit(&mut self, _context: &ContextPack, prompt: &str) -> Result<String, String> {
        let body = serde_json::json!({ "query": prompt }).to_string();
        let (status, payload) = self.loom_request("POST", "/v1/weave", Some(&body))?;
        if !(200..300).contains(&status) {
            return Err(format!("Loom returned HTTP {status}"));
        }
        let value = self.parse_json(&payload)?;
        Self::extract_text(&value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn request_to_dead_port_returns_error() {
        let adapter = LoomHttpAdapter::new();
        let result = adapter.request_to("127.0.0.1:1", "GET", "/v1/health", None);
        assert!(result.is_err());
    }

    #[test]
    fn extract_text_tries_five_keys_in_order() {
        let value = serde_json::json!({
            "response": "second choice",
            "text": "first choice",
            "content": "third choice",
        });
        assert_eq!(
            LoomHttpAdapter::extract_text(&value).unwrap(),
            "first choice"
        );
        let value = serde_json::json!({ "text": "   ", "reply": "fallback" });
        assert_eq!(LoomHttpAdapter::extract_text(&value).unwrap(), "fallback");
        let value = serde_json::json!({ "message": "last key" });
        assert_eq!(LoomHttpAdapter::extract_text(&value).unwrap(), "last key");
        let value = serde_json::json!({ "text": 42, "content": ["not a string"] });
        assert!(LoomHttpAdapter::extract_text(&value).is_err());
        let value = serde_json::json!({});
        assert!(LoomHttpAdapter::extract_text(&value).is_err());
    }

    #[test]
    fn content_length_bounds_the_body() {
        let raw = b"HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhelloEXTRA";
        let (status, body) = read_response(&mut Cursor::new(raw.to_vec())).unwrap();
        assert_eq!(status, 200);
        assert_eq!(body, b"hello");
    }

    #[test]
    fn chunked_body_is_decoded() {
        let raw = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n";
        let (status, body) = read_response(&mut Cursor::new(raw.to_vec())).unwrap();
        assert_eq!(status, 200);
        assert_eq!(body, b"hello world");
    }

    #[test]
    fn body_without_length_reads_until_close() {
        let raw = b"HTTP/1.1 200 OK\r\n\r\nbye";
        let (status, body) = read_response(&mut Cursor::new(raw.to_vec())).unwrap();
        assert_eq!(status, 200);
        assert_eq!(body, b"bye");
    }

    #[test]
    fn parse_json_rejects_bad_json() {
        let adapter = LoomHttpAdapter::new();
        assert!(adapter.parse_json(b"not json").is_err());
        assert!(adapter.parse_json(b"{\"ok\":true}").is_ok());
    }
}
