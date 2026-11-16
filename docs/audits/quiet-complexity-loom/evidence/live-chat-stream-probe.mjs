// Live chat-stream probe: reproduces the exact HTTP request the Rust
// `run_stream` reader emits for `ask_loom_stream` (POST /v1/weave:stream)
// and captures the real server's response with per-event latency.
//
// Byte-for-byte faithful to src-tauri/src/loom_stream.rs `run_stream`:
//   POST /v1/weave:stream HTTP/1.1
//   Host: {addr}
//   X-Loom-Slot-Origin: interactive
//   Content-Type: application/json
//   Accept: text/event-stream
//   Content-Length: {len}
//   Connection: close
//
// Body (snake_case, as `weave_stream_body` builds it) with enable_trace.
//
// Disposable data: a fresh turn (no session_id/agent_id) on the default
// agent, prompt "Reply with exactly: pong". No existing conversation is
// touched.

import net from "node:net";

const HOST = process.env.LOOM_HOST || "127.0.0.1";
const PORT = Number(process.env.LOOM_PORT || 5006);

const body = JSON.stringify({
  query: "Reply with exactly: pong",
  enable_trace: true,
});

const addr = `${HOST}:${PORT}`;
const request =
  `POST /v1/weave:stream HTTP/1.1\r\n` +
  `Host: ${addr}\r\n` +
  `X-Loom-Slot-Origin: interactive\r\n` +
  `Content-Type: application/json\r\n` +
  `Accept: text/event-stream\r\n` +
  `Content-Length: ${Buffer.byteLength(body)}\r\n` +
  `Connection: close\r\n\r\n` +
  body;

const t0 = Date.now();
const events = [];
let raw = Buffer.alloc(0);
let headEnd = -1;
let headText = "";

const socket = net.connect(PORT, HOST);

socket.on("connect", () => {
  socket.write(request);
});

socket.on("data", (chunk) => {
  raw = Buffer.concat([raw, chunk]);
  // Find end of headers once.
  if (headEnd < 0) {
    const idx = raw.indexOf("\r\n\r\n");
    if (idx >= 0) {
      headEnd = idx + 4;
      headText = raw.subarray(0, idx).toString("utf8");
    }
  }
});

socket.on("end", () => {
  finish();
});

socket.on("error", (err) => {
  console.error("SOCKET ERROR:", err.message);
  process.exit(1);
});

function finish() {
  const latencyToFirstByte = Date.now() - t0;
  const headers = headText.split("\r\n");
  const statusLine = headers[0] || "";
  const contentLengthHeader = headers.find((h) => /^content-length:/i.test(h));
  const transferEncoding = headers.find((h) => /^transfer-encoding:/i.test(h));
  const contentType = headers.find((h) => /^content-type:/i.test(h));

  // Decode body framing (chunked or content-length) into raw bytes.
  let payload = raw.subarray(headEnd);
  if (transferEncoding && /chunked/i.test(transferEncoding)) {
    payload = dechunk(payload);
  }

  const bodyText = payload.toString("utf8");
  // Split into SSE events on blank lines; within an event, collect data: lines.
  const sseEvents = [];
  let current = { data: "", ts: null };
  for (const line of bodyText.split(/\r?\n/)) {
    if (line === "") {
      if (current.data.trim()) {
        sseEvents.push({ data: current.data.trim(), ts: current.ts });
      }
      current = { data: "", ts: null };
      continue;
    }
    if (line.startsWith("data:")) {
      const d = line.slice(5).trimStart();
      if (current.ts === null) current.ts = Date.now() - t0;
      current.data += d;
    }
    // ignore comment/event/id lines, but note them if present
  }
  if (current.data.trim()) sseEvents.push({ data: current.data.trim(), ts: current.ts });

  const parsed = sseEvents.map((e) => {
    let obj = null;
    try {
      obj = JSON.parse(e.data);
    } catch {
      obj = { raw: e.data };
    }
    return { latencyMs: e.ts, event: obj };
  });

  const firstEvent = parsed[0] || null;
  const lastEvent = parsed[parsed.length - 1] || null;

  const summary = {
    target: addr,
    serverReached: true,
    statusLine,
    contentType,
    transferEncoding,
    contentLengthHeader,
    bytesReceived: raw.length,
    latencyToFirstByteMs: latencyToFirstByte,
    firstEvent: firstEvent
      ? {
          latencyMs: firstEvent.latencyMs,
          keys: Object.keys(firstEvent.event || {}),
          sample: firstEvent.event,
        }
      : null,
    eventCount: parsed.length,
    lastEvent: lastEvent ? lastEvent.event : null,
  };

  console.log("=== LIVE CHAT STREAM PROBE ===");
  console.log(JSON.stringify(summary, null, 2));

  // Full transcript for evidence.
  console.log("\n=== RAW RESPONSE HEAD ===");
  console.log(headText);
  console.log("\n=== SSE EVENTS (index, latencyMs, payload) ===");
  parsed.forEach((e, i) => {
    console.log(`${i}\t${e.latencyMs}ms\t${JSON.stringify(e.event)}`);
  });
}

function dechunk(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const lineEnd = buf.indexOf("\r\n", i);
    if (lineEnd < 0) break;
    const sizeHex = buf.subarray(i, lineEnd).toString("utf8").split(";")[0].trim();
    const size = parseInt(sizeHex, 16);
    i = lineEnd + 2;
    if (size === 0) break;
    out.push(buf.subarray(i, i + size));
    i += size + 2; // skip data + trailing CRLF
  }
  return Buffer.concat(out);
}
