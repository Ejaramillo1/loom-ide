//! One instance per surface, including launches from outside the other app.
//! Local activation messages never carry paths, shell commands, or user data.
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::Duration;

pub const TAURI: &str = "127.0.0.1:43761";
pub const WORKBENCH: &str = "127.0.0.1:43762";
const REQUEST: &[u8] = b"loom-activate-v1\n";
const RESPONSE: &[u8] = b"loom-active-v1\n";

pub fn activate(address: &str) -> Result<bool, String> {
    let mut socket = match TcpStream::connect_timeout(
        &address
            .parse()
            .map_err(|e| format!("Invalid activation address: {e}"))?,
        Duration::from_millis(300),
    ) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::ConnectionRefused => return Ok(false),
        Err(e) => return Err(format!("Could not activate the existing window: {e}")),
    };
    socket
        .set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|e| e.to_string())?;
    socket
        .set_write_timeout(Some(Duration::from_secs(2)))
        .map_err(|e| e.to_string())?;
    socket.write_all(REQUEST).map_err(|e| e.to_string())?;
    let mut reply = [0; RESPONSE.len()];
    socket
        .read_exact(&mut reply)
        .map_err(|e| format!("The existing window did not acknowledge activation: {e}"))?;
    if reply != RESPONSE {
        return Err("Another service occupies the window activation port".into());
    }
    Ok(true)
}

pub struct Instance(TcpListener);
impl Instance {
    /// Bind before creating a window: simultaneous launches cannot create duplicates.
    pub fn claim(address: &str) -> Result<Option<Self>, String> {
        match TcpListener::bind(address) {
            Ok(listener) => Ok(Some(Self(listener))),
            Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
                if activate(address)? {
                    Ok(None)
                } else {
                    Err("Window activation is busy; try again".into())
                }
            }
            Err(e) => Err(format!("Could not register the window: {e}")),
        }
    }
    pub fn serve(self, focus: impl Fn() + Send + 'static) {
        std::thread::spawn(move || {
            for mut socket in self.0.incoming().flatten() {
                let _ = socket.set_read_timeout(Some(Duration::from_secs(1)));
                let _ = socket.set_write_timeout(Some(Duration::from_secs(1)));
                let mut request = [0; REQUEST.len()];
                if socket.read_exact(&mut request).is_ok() && request == REQUEST {
                    focus();
                    let _ = socket.write_all(RESPONSE);
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn repeated_launches_activate_one_existing_instance() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap().to_string();
        let (send, receive) = std::sync::mpsc::channel();
        Instance(listener).serve(move || {
            send.send(()).unwrap();
        });
        for _ in 0..3 {
            assert!(Instance::claim(&address).unwrap().is_none());
            receive.recv_timeout(Duration::from_secs(1)).unwrap();
        }
    }
    #[test]
    fn closed_surface_can_be_started_again() {
        let instance = Instance::claim("127.0.0.1:0").unwrap().unwrap();
        let address = instance.0.local_addr().unwrap().to_string();
        drop(instance);
        assert!(!activate(&address).unwrap());
        assert!(Instance::claim(&address).unwrap().is_some());
    }
}
