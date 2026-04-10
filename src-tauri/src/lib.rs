mod auth;
mod messages;
mod notes;
mod ollama_install;
mod threads;

use std::process::{Command, Stdio};
use tokio::sync::Mutex;

/// Shared application state managed by Tauri.
pub struct AppState {
    /// MongoDB database handle — initialised by the `setup_db` command.
    pub db: Mutex<Option<mongodb::Database>>,
    /// Secret used to sign session JWTs.
    /// For a production app this should be a random value persisted in the
    /// OS keychain. For the MVP a fixed dev secret is fine.
    pub jwt_secret: String,
}

/// Spawns `ollama serve` as a detached background process.
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

/// Stops the Ollama daemon.
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
            Err("No Ollama process was found, or shutdown was denied.".into())
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
        .manage(AppState {
            db: Mutex::new(None),
            jwt_secret: "dev-jwt-secret-change-before-shipping".to_string(),
        })
        .plugin(tauri_plugin_oauth::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_ollama,
            stop_ollama,
            ollama_install::is_ollama_installed,
            ollama_install::install_ollama,
            auth::setup_db,
            auth::auth_register,
            auth::auth_login,
            auth::auth_google_exchange,
            notes::list_notes,
            notes::create_note,
            notes::update_note,
            notes::delete_note,
            notes::embed_note,
            notes::search_notes,
            threads::list_threads,
            threads::save_thread,
            threads::delete_thread,
            messages::save_message,
            messages::list_thread_messages,
            messages::delete_thread_messages,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
