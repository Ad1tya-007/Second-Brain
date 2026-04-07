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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![start_ollama])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
