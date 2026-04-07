use std::process::{Command, Stdio};

/// Spawns `ollama serve` as a detached background process.
/// The child handle is dropped immediately — on Unix the process keeps running.
/// Returns an error string if the binary cannot be found or spawned.
#[tauri::command]
fn start_ollama() -> Result<(), String> {
    Command::new("ollama")
        .arg("serve")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Could not start Ollama: {e}"))
}

/// Stops the Ollama daemon by terminating the `ollama` process (same as quitting the app).
/// On failure (no process, permission denied), returns an error message.
#[tauri::command]
fn stop_ollama() -> Result<(), String> {
    #[cfg(unix)]
    {
        let status = Command::new("killall")
            .arg("ollama")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|e| format!("Could not stop Ollama: {e}"))?;
        if status.success() {
            Ok(())
        } else {
            Err(
                "No Ollama process was found, or shutdown was denied. If Ollama is running, try quitting it from the menu bar."
                    .into(),
            )
        }
    }
    #[cfg(windows)]
    {
        let status = Command::new("taskkill")
            .args(["/IM", "ollama.exe", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|e| format!("Could not stop Ollama: {e}"))?;
        if status.success() {
            Ok(())
        } else {
            Err("Could not stop Ollama (process not found or access denied).".into())
        }
    }
    #[cfg(all(not(unix), not(windows)))]
    {
        Err("Stopping Ollama is not supported on this platform.".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![start_ollama, stop_ollama])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
