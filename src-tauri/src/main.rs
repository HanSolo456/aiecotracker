#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    net::TcpStream,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Manager, RunEvent, State};

const NEXT_PORT: u16 = 3000;

struct NextChild(Mutex<Option<Child>>);

#[derive(serde::Deserialize)]
struct DesktopGoogleHandoff {
    status: String,
    #[serde(rename = "idToken")]
    id_token: Option<String>,
    error: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: u64,
    #[serde(rename = "expiresAt")]
    expires_at: u64,
}

#[derive(serde::Serialize)]
struct DesktopGoogleHandoffResponse {
    status: String,
    #[serde(rename = "idToken")]
    id_token: Option<String>,
    error: Option<String>,
}

fn desktop_handoff_dir() -> PathBuf {
    std::env::temp_dir().join("aiecotrack-desktop-google-handoff")
}

fn desktop_handoff_file(request_id: &str) -> PathBuf {
    desktop_handoff_dir().join(format!("{request_id}.json"))
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let allowed = [
        "http://localhost",
        "https://localhost",
        "http://127.0.0.1",
        "https://127.0.0.1",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ];

    if !allowed.iter().any(|prefix| url.starts_with(prefix)) {
        return Err("only local desktop auth URLs may be opened externally".into());
    }

    #[cfg(target_os = "macos")]
    let mut cmd = {
        let mut cmd = Command::new("open");
        cmd.arg(&url);
        cmd
    };

    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "start", "", &url]);
        cmd
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut cmd = {
        let mut cmd = Command::new("xdg-open");
        cmd.arg(&url);
        cmd
    };

    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("failed to open external browser: {e}"))
}

#[tauri::command]
fn read_desktop_google_handoff(request_id: String) -> Result<DesktopGoogleHandoffResponse, String> {
    let file = desktop_handoff_file(&request_id);
    let raw = match fs::read_to_string(&file) {
        Ok(raw) => raw,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            return Ok(DesktopGoogleHandoffResponse {
                status: "expired".into(),
                id_token: None,
                error: None,
            })
        }
        Err(err) => return Err(format!("failed to read desktop Google handoff: {err}")),
    };

    let parsed: DesktopGoogleHandoff =
        serde_json::from_str(&raw).map_err(|e| format!("failed to parse desktop Google handoff: {e}"))?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("system time error: {e}"))?
        .as_millis() as u64;

    if parsed.expires_at <= now {
        let _ = fs::remove_file(&file);
        return Ok(DesktopGoogleHandoffResponse {
            status: "expired".into(),
            id_token: None,
            error: None,
        });
    }

    if parsed.status == "completed" || parsed.status == "failed" {
        let _ = fs::remove_file(&file);
    }

    let _ = parsed.created_at;

    Ok(DesktopGoogleHandoffResponse {
        status: parsed.status,
        id_token: parsed.id_token,
        error: parsed.error,
    })
}

fn wait_for_port(timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if TcpStream::connect(("127.0.0.1", NEXT_PORT)).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(150));
    }
    false
}

fn bundled_node_exe(app: &AppHandle) -> Option<PathBuf> {
    let res = app.path().resource_dir().ok()?;
    let win = res.join("nodejs").join("node.exe");
    if win.is_file() {
        return Some(win);
    }
    let unix = res.join("nodejs").join("bin").join("node");
    if unix.is_file() {
        return Some(unix);
    }
    None
}

fn next_server_dir(app: &AppHandle) -> Option<PathBuf> {
    let res = app.path().resource_dir().ok()?;
    let dir = res.join("next-server");
    if dir.join("server.js").is_file() {
        Some(dir)
    } else {
        None
    }
}

fn spawn_next_production(app: &AppHandle, state: &State<'_, NextChild>) -> Result<(), String> {
    let dir = next_server_dir(app).ok_or_else(|| {
        "next-server bundle missing (run `npm run build:desktop` before `tauri build`)".to_string()
    })?;
    let node = bundled_node_exe(app).unwrap_or_else(|| PathBuf::from("node"));
    let mut cmd = Command::new(&node);
    cmd.current_dir(&dir)
        .env("PORT", NEXT_PORT.to_string())
        .env("HOSTNAME", "localhost")
        .env("NODE_ENV", "production")
        .arg("server.js")
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn Node for Next.js ({:?}): {e}", node))?;

    *state.0.lock().map_err(|_| "server state poisoned")? = Some(child);

    if !wait_for_port(Duration::from_secs(90)) {
        return Err("Next.js did not listen on port 3000 in time".into());
    }

    Ok(())
}

fn ensure_next_running(app: &AppHandle, state: &State<'_, NextChild>) -> Result<(), String> {
    if cfg!(debug_assertions) {
        if !wait_for_port(Duration::from_secs(180)) {
            eprintln!(
                "[AI-EcoTrack] Dev server not reachable on localhost:{} — is `npm run dev` running?",
                NEXT_PORT
            );
        }
        return Ok(());
    }

    spawn_next_production(app, state)
}

fn kill_next(state: &State<'_, NextChild>) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn main() {
    tauri::Builder::default()
        .manage(NextChild(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            open_external_url,
            read_desktop_google_handoff
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let state = app.state::<NextChild>();
            if let Err(e) = ensure_next_running(&handle, &state) {
                eprintln!("[AI-EcoTrack] {e}");
                if !cfg!(debug_assertions) {
                    std::process::exit(1);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Tauri application")
        .run(|app_handle, event| {
            if matches!(
                event,
                RunEvent::Exit | RunEvent::ExitRequested { .. }
            ) {
                kill_next(&app_handle.state::<NextChild>());
            }
        });
}
