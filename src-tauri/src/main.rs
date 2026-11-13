// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Both paired surfaces use XWayland on Linux: the compositor does not
    // permit arbitrary cross-process focus on native Wayland windows.
    #[cfg(target_os = "linux")]
    if std::env::var_os("DISPLAY").is_some() {
        // SAFETY: this is the first code in main, before Tauri starts threads.
        unsafe {
            std::env::set_var("GDK_BACKEND", "x11");
        }
    }
    app_lib::run();
}
