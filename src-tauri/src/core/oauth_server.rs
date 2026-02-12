use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tokio::sync::watch;
use std::sync::{Mutex, OnceLock};
use tauri::Url;
use crate::core::oauth;
use crate::utils::logger::{log_info, log_error, log_warn};

struct OAuthFlowState {
    auth_url: String,
    #[allow(dead_code)]
    redirect_uri: String,
    state: String,
    cancel_tx: watch::Sender<bool>,
    code_tx: mpsc::Sender<Result<String, String>>,
    code_rx: Option<mpsc::Receiver<Result<String, String>>>,
}

static OAUTH_FLOW_STATE: OnceLock<Mutex<Option<OAuthFlowState>>> = OnceLock::new();

fn get_oauth_flow_state() -> &'static Mutex<Option<OAuthFlowState>> {
    OAUTH_FLOW_STATE.get_or_init(|| Mutex::new(None))
}

fn oauth_success_html() -> &'static str {
    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n\
    <html>\
    <body style='font-family: sans-serif; text-align: center; padding: 50px;'>\
    <h1 style='color: green;'>✅ Authorization Successful!</h1>\
    <p>You can close this window and return to the application.</p>\
    <script>setTimeout(function() { window.close(); }, 2000);</script>\
    </body>\
    </html>"
}

fn oauth_fail_html() -> &'static str {
    "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\n\r\n\
    <html>\
    <body style='font-family: sans-serif; text-align: center; padding: 50px;'>\
    <h1 style='color: red;'>❌ Authorization Failed</h1>\
    <p>Failed to obtain Authorization Code. Please return to the app and try again.</p>\
    </body>\
    </html>"
}

pub async fn ensure_oauth_flow_prepared(app_handle: Option<tauri::AppHandle>) -> Result<String, String> {
    // Return URL if flow already exists and is still "fresh" (receiver hasn't been taken)
    if let Ok(mut state) = get_oauth_flow_state().lock() {
        if let Some(s) = state.as_mut() {
            if s.code_rx.is_some() {
                return Ok(s.auth_url.clone());
            } else {
                let _ = s.cancel_tx.send(true);
                *state = None;
            }
        }
    }

    // Bind to ephemeral port on 127.0.0.1
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("failed_to_bind_local_port: {}", e))?;
    
    let port = listener
        .local_addr()
        .map_err(|e| format!("failed_to_get_local_port: {}", e))?
        .port();

    let redirect_uri = format!("http://127.0.0.1:{}/oauth-callback", port);
    let state_str = uuid::Uuid::new_v4().to_string();
    let auth_url = oauth::get_auth_url(&redirect_uri, &state_str);

    let (cancel_tx, mut cancel_rx) = watch::channel(false);
    let (code_tx, code_rx) = mpsc::channel::<Result<String, String>>(1);

    let app_handle_for_tasks = app_handle.clone();
    let tx = code_tx.clone();

    tokio::spawn(async move {
        if let Ok((mut stream, _)) = tokio::select! {
            res = listener.accept() => res.map_err(|e| format!("failed_to_accept_connection: {}", e)),
            _ = cancel_rx.changed() => Err("OAuth cancelled".to_string()),
        } {
            let mut buffer = [0u8; 4096];
            let bytes_read = stream.read(&mut buffer).await.unwrap_or(0);
            let request = String::from_utf8_lossy(&buffer[..bytes_read]);
            
            let query_params = request
                .lines()
                .next()
                .and_then(|line| {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 { Some(parts[1]) } else { None }
                })
                .and_then(|path| {
                    Url::parse(&format!("http://localhost{}", path)).ok()
                })
                .map(|url| {
                    let mut code = None;
                    let mut state = None;
                    for (k, v) in url.query_pairs() {
                        if k == "code" { code = Some(v.to_string()); }
                        else if k == "state" { state = Some(v.to_string()); }
                    }
                    (code, state)
                });

            let (code, received_state) = match query_params {
                Some((c, s)) => (c, s),
                None => (None, None),
            };

            let state_valid = {
                if let Ok(lock) = get_oauth_flow_state().lock() {
                    if let Some(s) = lock.as_ref() {
                        received_state.as_ref() == Some(&s.state)
                    } else { false }
                } else { false }
            };

            let (result, response_html) = match (code, state_valid) {
                (Some(code), true) => {
                    log_info("OAuth code captured successfully");
                    (Ok(code), oauth_success_html())
                },
                (Some(_), false) => {
                    log_error("OAuth callback state mismatch");
                    (Err("OAuth state mismatch".to_string()), oauth_fail_html())
                },
                (None, _) => (Err("Failed to get Authorization Code".to_string()), oauth_fail_html()),
            };
            
            let _ = stream.write_all(response_html.as_bytes()).await;
            let _ = stream.flush().await;

            // 发射事件到前端
            if let Some(h) = app_handle_for_tasks {
                use tauri::Emitter;
                match h.emit("oauth-callback-received", ()) {
                    Ok(_) => log_info("OAuth callback event emitted"),
                    Err(e) => log_error(&format!("Failed to emit event: {}", e)),
                }
            } else {
                log_warn("No app handle available for event emission");
            }
            
            let _ = tx.send(result).await;
        }
    });

    if let Ok(mut state) = get_oauth_flow_state().lock() {
        *state = Some(OAuthFlowState {
            auth_url: auth_url.clone(),
            redirect_uri,
            state: state_str,
            cancel_tx,
            code_tx,
            code_rx: Some(code_rx),
        });
    }

    if let Some(h) = app_handle {
        use tauri::Emitter;
        let _ = h.emit("oauth-url-generated", &auth_url);
    }

    Ok(auth_url)
}

// start_oauth_flow removed

/// Manually submit code
pub async fn submit_oauth_code(code_input: String) -> Result<(), String> {
    let tx = {
        let lock = get_oauth_flow_state().lock().map_err(|e| e.to_string())?;
        if let Some(state) = lock.as_ref() {
            state.code_tx.clone()
        } else {
            return Err("No active flow".to_string());
        }
    };

    let code = if code_input.starts_with("http") {
        if let Ok(url) = Url::parse(&code_input) {
            url.query_pairs().find(|(k, _)| k == "code").map(|(_, v)| v.to_string()).unwrap_or(code_input)
        } else { code_input }
    } else { code_input };

    tx.send(Ok(code)).await.map_err(|_| "Failed to send code".to_string())?;
    Ok(())
}

/// Complete OAuth flow without opening browser
// start_oauth_flow removed as it is superseded by manual flow control
pub async fn complete_oauth_flow(app_handle: Option<tauri::AppHandle>) -> Result<oauth::TokenResponse, String> {
    let _ = ensure_oauth_flow_prepared(app_handle).await?;

    let (mut code_rx, redirect_uri) = {
        let mut lock = get_oauth_flow_state().lock().map_err(|_| "Lock corrupted".to_string())?;
        let Some(state) = lock.as_mut() else { return Err("No state".to_string()); };
        let rx = state.code_rx.take().ok_or("Authorization already in progress")?;
        (rx, state.redirect_uri.clone())
    };

    let code = match code_rx.recv().await {
        Some(Ok(code)) => code,
        Some(Err(e)) => return Err(e),
        None => return Err("Closed".to_string()),
    };

    if let Ok(mut lock) = get_oauth_flow_state().lock() { *lock = None; }

    oauth::exchange_code(&code, &redirect_uri).await
}
