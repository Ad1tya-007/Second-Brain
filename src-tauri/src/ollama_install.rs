//! Download and install Ollama with progress events for the UI.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

fn find_app_bundle(dir: &Path) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() && p.file_name()?.to_string_lossy().ends_with(".app") {
            return Some(p);
        }
        if p.is_dir() {
            if let Some(found) = find_app_bundle(&p) {
                return Some(found);
            }
        }
    }
    None
}

const DARWIN_ZIP: &str = "https://ollama.com/download/Ollama-darwin.zip";

#[derive(Clone, Serialize)]
pub struct OllamaInstallProgress {
    pub phase: String,
    pub message: String,
    /// Overall progress 0–100
    pub percent: f64,
    pub bytes_received: Option<u64>,
    pub bytes_total: Option<u64>,
    /// Estimated seconds remaining (when computable)
    pub eta_seconds: Option<u32>,
}

fn emit_progress(app: &AppHandle, p: OllamaInstallProgress) {
    let _ = app.emit("ollama-install-progress", &p);
}

/// True if `ollama` is on PATH and responds to `--version`.
#[tauri::command]
pub fn is_ollama_installed() -> bool {
    std::process::Command::new("ollama")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[tauri::command]
pub async fn install_ollama(app: AppHandle) -> Result<(), String> {
    if is_ollama_installed() {
        emit_progress(
            &app,
            OllamaInstallProgress {
                phase: "done".into(),
                message: "Ollama is already installed.".into(),
                percent: 100.0,
                bytes_received: None,
                bytes_total: None,
                eta_seconds: None,
            },
        );
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        install_macos(&app).await
    }
    #[cfg(target_os = "linux")]
    {
        install_linux(&app).await
    }
    #[cfg(target_os = "windows")]
    {
        install_windows(&app).await
    }
    #[cfg(not(any(
        target_os = "macos",
        target_os = "linux",
        target_os = "windows"
    )))]
    {
        Err("Automatic Ollama installation is not available on this platform.".into())
    }
}

#[cfg(target_os = "macos")]
async fn install_macos(app: &AppHandle) -> Result<(), String> {
    emit_progress(
        app,
        OllamaInstallProgress {
            phase: "prepare".into(),
            message: "Preparing to download Ollama for macOS…".into(),
            percent: 0.0,
            bytes_received: None,
            bytes_total: None,
            eta_seconds: None,
        },
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(7200))
        .build()
        .map_err(|e| e.to_string())?;

    let total_bytes: Option<u64> = client
        .head(DARWIN_ZIP)
        .send()
        .await
        .ok()
        .and_then(|r| r.headers().get(reqwest::header::CONTENT_LENGTH)?.to_str().ok()?.parse().ok());

    let response = client
        .get(DARWIN_ZIP)
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?;

    let temp_zip = std::env::temp_dir().join("lsb-ollama-darwin.zip");
    let mut file = tokio::fs::File::create(&temp_zip)
        .await
        .map_err(|e| e.to_string())?;

    let mut downloaded: u64 = 0;
    let start_dl = Instant::now();
    let mut last_emit = Instant::now();

    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    let mut stream = response.bytes_stream();
    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        let n = chunk.len() as u64;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += n;

        let should_emit = last_emit.elapsed().as_millis() >= 180
            || total_bytes.is_some_and(|t| downloaded >= t);
        if should_emit {
            let pct = total_bytes
                .map(|t| (downloaded as f64 / t as f64) * 72.0)
                .unwrap_or(25.0)
                .min(72.0);
            let elapsed = start_dl.elapsed().as_secs_f64().max(0.001);
            let bps = downloaded as f64 / elapsed;
            let eta = total_bytes.and_then(|t| {
                let left = t.saturating_sub(downloaded);
                if bps > 50.0 {
                    Some((left as f64 / bps).ceil() as u32)
                } else {
                    None
                }
            });
            emit_progress(
                app,
                OllamaInstallProgress {
                    phase: "download".into(),
                    message: format!(
                        "Downloading installer… {:.1} MB{}",
                        downloaded as f64 / 1_000_000.0,
                        total_bytes
                            .map(|t| format!(" / {:.1} MB", t as f64 / 1_000_000.0))
                            .unwrap_or_default()
                    ),
                    percent: pct,
                    bytes_received: Some(downloaded),
                    bytes_total: total_bytes,
                    eta_seconds: eta,
                },
            );
            last_emit = Instant::now();
        }
    }
    file.flush().await.ok();

    emit_progress(
        app,
        OllamaInstallProgress {
            phase: "extract".into(),
            message: "Unpacking Ollama…".into(),
            percent: 74.0,
            bytes_received: Some(downloaded),
            bytes_total: total_bytes,
            eta_seconds: None,
        },
    );

    let extract_dir = std::env::temp_dir().join(format!(
        "lsb-ollama-extract-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));
    if extract_dir.exists() {
        let _ = std::fs::remove_dir_all(&extract_dir);
    }
    std::fs::create_dir_all(&extract_dir).map_err(|e| e.to_string())?;

    let st = std::process::Command::new("unzip")
        .args(["-q", "-o", temp_zip.to_str().unwrap(), "-d", extract_dir.to_str().unwrap()])
        .status()
        .map_err(|e| e.to_string())?;
    if !st.success() {
        let _ = std::fs::remove_file(&temp_zip);
        return Err("Could not unzip the Ollama download. Is 'unzip' installed?".into());
    }

    let src_app = find_app_bundle(&extract_dir)
        .ok_or_else(|| "Ollama.app not found in the downloaded zip.".to_string())?;

    emit_progress(
        app,
        OllamaInstallProgress {
            phase: "install".into(),
            message: "Installing Ollama to Applications…".into(),
            percent: 82.0,
            bytes_received: None,
            bytes_total: None,
            eta_seconds: None,
        },
    );

    let _ = std::process::Command::new("pkill")
        .args(["-x", "Ollama"])
        .status();
    std::thread::sleep(std::time::Duration::from_secs(2));

    let dest = Path::new("/Applications/Ollama.app");
    if dest.exists() {
        let _ = std::fs::remove_dir_all(dest);
    }

    let copy = std::process::Command::new("ditto")
        .args([src_app.to_str().unwrap(), "/Applications/Ollama.app"])
        .status()
        .map_err(|e| e.to_string())?;
    if !copy.success() {
        let _ = std::fs::remove_file(&temp_zip);
        let _ = std::fs::remove_dir_all(&extract_dir);
        return Err("Could not copy Ollama to /Applications (permission denied?).".into());
    }

    emit_progress(
        app,
        OllamaInstallProgress {
            phase: "path".into(),
            message: "Adding ollama to your PATH…".into(),
            percent: 90.0,
            bytes_received: None,
            bytes_total: None,
            eta_seconds: None,
        },
    );

    let ollama_bin = "/Applications/Ollama.app/Contents/Resources/ollama";
    let _ = std::fs::create_dir_all("/usr/local/bin");
    let ln = std::process::Command::new("ln")
        .args(["-sf", ollama_bin, "/usr/local/bin/ollama"])
        .status();
    if ln.map(|s| !s.success()).unwrap_or(true) {
        let _ = std::process::Command::new("sudo")
            .args(["ln", "-sf", ollama_bin, "/usr/local/bin/ollama"])
            .status();
    }

    emit_progress(
        app,
        OllamaInstallProgress {
            phase: "launch".into(),
            message: "Starting Ollama…".into(),
            percent: 96.0,
            bytes_received: None,
            bytes_total: None,
            eta_seconds: None,
        },
    );

    let _ = std::process::Command::new("open")
        .args(["-a", "Ollama", "--args", "hidden"])
        .spawn();

    let _ = std::fs::remove_file(&temp_zip);
    let _ = std::fs::remove_dir_all(&extract_dir);

    emit_progress(
        app,
        OllamaInstallProgress {
            phase: "done".into(),
            message: "Ollama installed. You can pull models from the terminal with: ollama pull <model>".into(),
            percent: 100.0,
            bytes_received: None,
            bytes_total: None,
            eta_seconds: None,
        },
    );

    Ok(())
}

#[cfg(target_os = "linux")]
async fn install_linux(app: &AppHandle) -> Result<(), String> {
    emit_progress(
        app,
        OllamaInstallProgress {
            phase: "prepare".into(),
            message: "Starting the official Ollama install script…".into(),
            percent: 2.0,
            bytes_received: None,
            bytes_total: None,
            eta_seconds: Some(240),
        },
    );

    let mut child = tokio::process::Command::new("bash")
        .arg("-c")
        .arg("curl -fsSL https://ollama.com/install.sh | sh")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Could not start installer: {e}"))?;

    let app_h = app.clone();
    let progress = tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(450));
        let start = Instant::now();
        loop {
            interval.tick().await;
            let elapsed = start.elapsed().as_secs_f64();
            let percent = 4.0 + (88.0 * (1.0 - (-elapsed / 220.0).exp())).min(88.0);
            let eta = (300.0f64 - elapsed).max(0.0) as u32;
            emit_progress(
                &app_h,
                OllamaInstallProgress {
                    phase: "install".into(),
                    message: "Installing… (enter your password if the system asks)".into(),
                    percent,
                    bytes_received: None,
                    bytes_total: None,
                    eta_seconds: Some(eta.min(600)),
                },
            );
        }
    });

    let status = child.wait().await.map_err(|e| e.to_string())?;
    progress.abort();

    if !status.success() {
        return Err(
            "Install script failed. Try in a terminal: curl -fsSL https://ollama.com/install.sh | sh"
                .into(),
        );
    }

    emit_progress(
        app,
        OllamaInstallProgress {
            phase: "done".into(),
            message: "Ollama installed.".into(),
            percent: 100.0,
            bytes_received: None,
            bytes_total: None,
            eta_seconds: None,
        },
    );
    Ok(())
}

#[cfg(target_os = "windows")]
async fn install_windows(app: &AppHandle) -> Result<(), String> {
    const WIN_SETUP: &str = "https://ollama.com/download/OllamaSetup.exe";

    emit_progress(
        app,
        OllamaInstallProgress {
            phase: "prepare".into(),
            message: "Downloading Ollama for Windows…".into(),
            percent: 0.0,
            bytes_received: None,
            bytes_total: None,
            eta_seconds: None,
        },
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(7200))
        .build()
        .map_err(|e| e.to_string())?;

    let total_bytes: Option<u64> = client
        .head(WIN_SETUP)
        .send()
        .await
        .ok()
        .and_then(|r| r.headers().get(reqwest::header::CONTENT_LENGTH)?.to_str().ok()?.parse().ok());

    let response = client
        .get(WIN_SETUP)
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?;

    let temp_exe = std::env::temp_dir().join("OllamaSetup.exe");
    let mut file = tokio::fs::File::create(&temp_exe)
        .await
        .map_err(|e| e.to_string())?;

    let mut downloaded: u64 = 0;
    let start_dl = Instant::now();
    let mut last_emit = Instant::now();

    use futures_util::StreamExt;
    use tokio::io::AsyncWriteExt;

    let mut stream = response.bytes_stream();
    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        let n = chunk.len() as u64;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += n;

        if last_emit.elapsed().as_millis() >= 200 {
            let pct = total_bytes
                .map(|t| (downloaded as f64 / t as f64) * 85.0)
                .unwrap_or(40.0)
                .min(85.0);
            let elapsed = start_dl.elapsed().as_secs_f64().max(0.001);
            let bps = downloaded as f64 / elapsed;
            let eta = total_bytes.and_then(|t| {
                let left = t.saturating_sub(downloaded);
                if bps > 50.0 {
                    Some((left as f64 / bps).ceil() as u32)
                } else {
                    None
                }
            });
            emit_progress(
                app,
                OllamaInstallProgress {
                    phase: "download".into(),
                    message: format!(
                        "Downloading OllamaSetup.exe… {:.1} MB",
                        downloaded as f64 / 1_000_000.0
                    ),
                    percent: pct,
                    bytes_received: Some(downloaded),
                    bytes_total: total_bytes,
                    eta_seconds: eta,
                },
            );
            last_emit = Instant::now();
        }
    }
    file.flush().await.ok();

    emit_progress(
        app,
        OllamaInstallProgress {
            phase: "install".into(),
            message: "Launching the Ollama installer — follow the steps in the window.".into(),
            percent: 92.0,
            bytes_received: Some(downloaded),
            bytes_total: total_bytes,
            eta_seconds: None,
        },
    );

    std::process::Command::new(&temp_exe)
        .spawn()
        .map_err(|e| format!("Could not start installer: {e}"))?;

    emit_progress(
        app,
        OllamaInstallProgress {
            phase: "done".into(),
            message: "When the installer finishes, return here and use Start Ollama.".into(),
            percent: 100.0,
            bytes_received: None,
            bytes_total: None,
            eta_seconds: None,
        },
    );

    Ok(())
}
