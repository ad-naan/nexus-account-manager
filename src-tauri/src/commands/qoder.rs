use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use once_cell::sync::Lazy;
use rand::RngCore;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::AppHandle;
use url::Url;

use crate::utils::local_secret_storage::{
    read_secret_storage_value_by_db_path, write_secret_storage_value_by_db_path,
};
use crate::utils::logger::log_warn;

pub const QODER_STATE_DB_CONFIG_KEY: &str = "qoder_state_db_path";

const QODER_OAUTH_TIMEOUT_SECONDS: i64 = 600;
const QODER_DEVICE_LOGIN_CLIENT_ID: &str = "e883ade2-e6e3-4d6d-adf7-f92ceff5fdcb";
const QODER_DEVICE_LOGIN_CHALLENGE_METHOD: &str = "S256";
const QODER_LOGIN_BASE_URL: &str = "https://qoder.com/device/selectAccounts";
const QODER_OPENAPI_BASE_URL: &str = "https://openapi.qoder.sh";
const QODER_DEVICE_TOKEN_POLL_PATH: &str = "/api/v1/deviceToken/poll";
const QODER_USER_INFO_PATH: &str = "/api/v1/userinfo";
const QODER_USER_PLAN_PATH: &str = "/api/v2/user/plan";
const QODER_CREDIT_USAGE_PATH: &str = "/api/v2/quota/usage";
const QODER_SECRET_USER_INFO_KEY: &str = "secret://aicoding.auth.userInfo";
const QODER_SECRET_USER_PLAN_KEY: &str = "secret://aicoding.auth.userPlan";
const QODER_SECRET_CREDIT_USAGE_KEY: &str = "secret://aicoding.auth.creditUsage";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct QoderOAuthStartResponse {
    pub login_id: String,
    pub verification_uri: String,
    pub expires_in: i64,
    pub interval_seconds: i64,
}

#[derive(Debug, Clone)]
struct PendingQoderOAuthState {
    login_id: String,
    expected_nonce: String,
    code_verifier: String,
    expires_at: i64,
    cancelled: bool,
}

#[derive(Debug, serde::Deserialize)]
struct QoderDeviceTokenPollResult {
    #[serde(default)]
    token: Option<String>,
}

static PENDING_QODER_OAUTH_STATE: Lazy<Mutex<Option<PendingQoderOAuthState>>> =
    Lazy::new(|| Mutex::new(None));

pub fn detect_qoder_state_db_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "APPDATA environment variable not found".to_string())?;
        return Ok(PathBuf::from(appdata)
            .join("Qoder")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb"));
    }

    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
        return Ok(home
            .join("Library")
            .join("Application Support")
            .join("Qoder")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb"));
    }

    #[cfg(target_os = "linux")]
    {
        let home = dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
        return Ok(home
            .join(".config")
            .join("Qoder")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb"));
    }

    #[allow(unreachable_code)]
    Err("Qoder is not supported on this platform".to_string())
}

fn resolve_qoder_state_db_path() -> Result<PathBuf, String> {
    if let Some(configured_path) = crate::utils::config::get_config_string(QODER_STATE_DB_CONFIG_KEY)? {
        return Ok(PathBuf::from(configured_path));
    }

    detect_qoder_state_db_path()
}

fn parse_json_text(raw: &str) -> Value {
    serde_json::from_str(raw).unwrap_or_else(|_| Value::String(raw.to_string()))
}

fn walk_value<'a>(value: &'a Value, visitor: &mut dyn FnMut(&'a Value)) {
    visitor(value);
    match value {
        Value::Object(map) => {
            for child in map.values() {
                walk_value(child, visitor);
            }
        }
        Value::Array(items) => {
            for child in items {
                walk_value(child, visitor);
            }
        }
        _ => {}
    }
}

fn pick_string_recursive(value: &Value, keys: &[&str]) -> Option<String> {
    let mut found = None;
    let target_keys: Vec<String> = keys.iter().map(|key| key.to_ascii_lowercase()).collect();

    walk_value(value, &mut |current| {
        if found.is_some() {
            return;
        }

        let Some(obj) = current.as_object() else {
            return;
        };

        for (key, raw) in obj {
            if !target_keys.contains(&key.to_ascii_lowercase()) {
                continue;
            }

            if let Some(text) = raw.as_str().map(str::trim).filter(|text| !text.is_empty()) {
                found = Some(text.to_string());
                return;
            }
        }
    });

    found
}

fn pick_first_email(value: &Value) -> Option<String> {
    let mut found = None;

    walk_value(value, &mut |current| {
        if found.is_some() {
            return;
        }

        let Some(text) = current.as_str().map(str::trim) else {
            return;
        };

        if text.contains('@') && text.contains('.') {
            found = Some(text.to_lowercase());
        }
    });

    found
}

fn build_qoder_import_config(db_path: &Path) -> Result<Value, String> {
    let user_info_raw = read_secret_storage_value_by_db_path(db_path, QODER_SECRET_USER_INFO_KEY)?
        .map(|value| parse_json_text(&value));
    let user_plan_raw = read_secret_storage_value_by_db_path(db_path, QODER_SECRET_USER_PLAN_KEY)?
        .map(|value| parse_json_text(&value));
    let credit_usage_raw =
        read_secret_storage_value_by_db_path(db_path, QODER_SECRET_CREDIT_USAGE_KEY)?
            .map(|value| parse_json_text(&value));

    if user_info_raw.is_none() && user_plan_raw.is_none() && credit_usage_raw.is_none() {
        return Err("No Qoder local session found".to_string());
    }

    let email = user_info_raw
        .as_ref()
        .and_then(|value| {
            pick_string_recursive(value, &["email", "mail"]).or_else(|| pick_first_email(value))
        })
        .or_else(|| user_plan_raw.as_ref().and_then(pick_first_email))
        .or_else(|| credit_usage_raw.as_ref().and_then(pick_first_email))
        .unwrap_or_else(|| "qoder-local".to_string());

    let name = user_info_raw
        .as_ref()
        .and_then(|value| pick_string_recursive(value, &["name", "displayName", "nickname", "username"]))
        .unwrap_or_else(|| "Qoder".to_string());

    let provider_id = user_plan_raw
        .as_ref()
        .and_then(|value| pick_string_recursive(value, &["plan", "tier", "membershipType", "subscriptionType"]))
        .unwrap_or_else(|| "Qoder".to_string());

    let user_id = user_info_raw
        .as_ref()
        .and_then(|value| pick_string_recursive(value, &["uid", "userId", "user_id", "accountId", "id"]));

    let mut result = Map::new();
    result.insert("email".to_string(), json!(email));
    result.insert("name".to_string(), json!(name));
    result.insert("providerId".to_string(), json!(provider_id));
    result.insert("source".to_string(), json!("local"));
    result.insert(
        "localPath".to_string(),
        json!(db_path.to_string_lossy().to_string()),
    );

    if let Some(value) = user_id {
        result.insert("userId".to_string(), json!(value));
    }
    if let Some(value) = user_info_raw {
        result.insert("userInfo".to_string(), value);
    }
    if let Some(value) = user_plan_raw {
        result.insert("userPlan".to_string(), value);
    }
    if let Some(value) = credit_usage_raw {
        result.insert("creditUsage".to_string(), value);
    }

    Ok(Value::Object(result))
}

fn fallback_user_info(settings: &Value) -> Value {
    json!({
        "id": settings.get("userId").and_then(Value::as_str).unwrap_or_default(),
        "email": settings.get("email").and_then(Value::as_str).unwrap_or_default(),
        "name": settings.get("name").and_then(Value::as_str).unwrap_or_default(),
    })
}

fn fallback_user_plan(settings: &Value) -> Value {
    json!({
        "plan": settings.get("providerId").and_then(Value::as_str).unwrap_or("Qoder"),
        "tier": settings.get("providerId").and_then(Value::as_str).unwrap_or("Qoder"),
    })
}

fn fallback_credit_usage(settings: &Value) -> Value {
    json!({
        "usagePercent": settings
            .get("usagePercent")
            .or_else(|| settings.get("creditsUsagePercent"))
            .cloned()
            .unwrap_or_else(|| json!(0)),
    })
}

fn normalize_non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}

fn now_timestamp() -> i64 {
    chrono::Utc::now().timestamp()
}

fn generate_pkce_verifier() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn generate_pkce_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

fn generate_login_nonce() -> String {
    uuid::Uuid::new_v4().simple().to_string()
}

fn build_qoder_device_login_url(nonce: &str, challenge: &str) -> Result<String, String> {
    let mut url =
        Url::parse(QODER_LOGIN_BASE_URL).map_err(|error| format!("Failed to parse Qoder login URL: {}", error))?;
    {
        let mut query = url.query_pairs_mut();
        query.append_pair("nonce", nonce);
        query.append_pair("challenge", challenge);
        query.append_pair("challenge_method", QODER_DEVICE_LOGIN_CHALLENGE_METHOD);
        query.append_pair("client_id", QODER_DEVICE_LOGIN_CLIENT_ID);
    }
    Ok(url.to_string())
}

async fn poll_qoder_device_token_once(
    nonce: &str,
    verifier: &str,
) -> Result<Option<String>, String> {
    let response = crate::utils::http::get_client()
        .get(format!("{}{}", QODER_OPENAPI_BASE_URL, QODER_DEVICE_TOKEN_POLL_PATH))
        .query(&[
            ("nonce", nonce),
            ("verifier", verifier),
            ("challenge_method", QODER_DEVICE_LOGIN_CHALLENGE_METHOD),
        ])
        .send()
        .await
        .map_err(|error| format!("Failed to poll Qoder device token: {}", error))?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "Failed to poll Qoder device token: status={}, body_len={}",
            status,
            body.len()
        ));
    }

    let payload = response
        .json::<QoderDeviceTokenPollResult>()
        .await
        .map_err(|error| format!("Failed to parse Qoder device token response: {}", error))?;

    Ok(payload
        .token
        .as_deref()
        .and_then(|value| normalize_non_empty(Some(value))))
}

async fn fetch_qoder_openapi_json(path: &str, access_token: &str) -> Result<Value, String> {
    let response = crate::utils::http::get_client()
        .get(format!("{}{}", QODER_OPENAPI_BASE_URL, path))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|error| format!("Failed to request Qoder OpenAPI {}: {}", path, error))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "Failed to request Qoder OpenAPI {}: status={}, body_len={}",
            path,
            status,
            body.len()
        ));
    }

    response
        .json::<Value>()
        .await
        .map_err(|error| format!("Failed to parse Qoder OpenAPI {} response: {}", path, error))
}

fn build_qoder_config_from_openapi(access_token: &str, user_info: Value, user_plan: Option<Value>, credit_usage: Option<Value>) -> Value {
    let email = pick_string_recursive(&user_info, &["email", "mail"])
        .or_else(|| pick_first_email(&user_info))
        .or_else(|| user_plan.as_ref().and_then(pick_first_email))
        .or_else(|| credit_usage.as_ref().and_then(pick_first_email))
        .unwrap_or_else(|| "qoder-oauth".to_string());
    let name = pick_string_recursive(&user_info, &["name", "displayName", "nickname", "username"])
        .unwrap_or_else(|| "Qoder".to_string());
    let provider_id = user_plan
        .as_ref()
        .and_then(|value| pick_string_recursive(value, &["plan", "tier", "membershipType", "subscriptionType"]))
        .unwrap_or_else(|| "Qoder".to_string());
    let user_id = pick_string_recursive(&user_info, &["uid", "userId", "user_id", "accountId", "id"]);

    let mut result = Map::new();
    result.insert("email".to_string(), json!(email));
    result.insert("name".to_string(), json!(name));
    result.insert("providerId".to_string(), json!(provider_id));
    result.insert("accessToken".to_string(), json!(access_token));
    result.insert("source".to_string(), json!("oauth"));
    result.insert("userInfo".to_string(), user_info);
    if let Some(value) = user_id {
        result.insert("userId".to_string(), json!(value));
    }
    if let Some(value) = user_plan {
        result.insert("userPlan".to_string(), value);
    }
    if let Some(value) = credit_usage {
        result.insert("creditUsage".to_string(), value);
    }

    Value::Object(result)
}

async fn refresh_qoder_config(settings: Option<String>) -> Result<Value, String> {
    let settings_str = settings.ok_or_else(|| "Settings parameter is required".to_string())?;
    let settings_value: Value = serde_json::from_str(&settings_str)
        .map_err(|error| format!("Failed to parse settings JSON: {}", error))?;
    let access_token = settings_value
        .get("accessToken")
        .or_else(|| settings_value.get("access_token"))
        .or_else(|| settings_value.get("token"))
        .and_then(Value::as_str)
        .and_then(|value| normalize_non_empty(Some(value)))
        .ok_or_else(|| "Missing Qoder access token in settings".to_string())?;

    let user_info = fetch_qoder_openapi_json(QODER_USER_INFO_PATH, &access_token).await?;
    let user_plan = match fetch_qoder_openapi_json(QODER_USER_PLAN_PATH, &access_token).await {
        Ok(value) => Some(value),
        Err(error) => {
            log_warn(format!("[Qoder Refresh] Failed to fetch user plan, using cached snapshot if available: {}", error));
            settings_value.get("userPlan").cloned()
        }
    };
    let credit_usage = match fetch_qoder_openapi_json(QODER_CREDIT_USAGE_PATH, &access_token).await {
        Ok(value) => Some(value),
        Err(error) => {
            log_warn(format!("[Qoder Refresh] Failed to fetch credit usage, using cached snapshot if available: {}", error));
            settings_value.get("creditUsage").cloned()
        }
    };

    Ok(build_qoder_config_from_openapi(
        &access_token,
        user_info,
        user_plan,
        credit_usage,
    ))
}

#[tauri::command]
pub async fn qoder_import_from_local(_app: AppHandle) -> Result<Value, String> {
    let db_path = resolve_qoder_state_db_path()?;
    build_qoder_import_config(&db_path)
}

#[tauri::command]
pub async fn qoder_oauth_login_start() -> Result<QoderOAuthStartResponse, String> {
    let expected_nonce = generate_login_nonce();
    let code_verifier = generate_pkce_verifier();
    let code_challenge = generate_pkce_challenge(&code_verifier);
    let verification_uri = build_qoder_device_login_url(&expected_nonce, &code_challenge)?;
    let login_id = uuid::Uuid::new_v4().to_string();

    let mut pending = PENDING_QODER_OAUTH_STATE
        .lock()
        .map_err(|_| "Failed to acquire Qoder OAuth lock".to_string())?;
    *pending = Some(PendingQoderOAuthState {
        login_id: login_id.clone(),
        expected_nonce,
        code_verifier,
        expires_at: now_timestamp() + QODER_OAUTH_TIMEOUT_SECONDS,
        cancelled: false,
    });

    Ok(QoderOAuthStartResponse {
        login_id,
        verification_uri,
        expires_in: QODER_OAUTH_TIMEOUT_SECONDS,
        interval_seconds: 1,
    })
}

#[tauri::command]
pub async fn qoder_oauth_login_complete(
    _app: AppHandle,
    login_id: String,
) -> Result<Value, String> {
    loop {
        let snapshot = {
            let pending = PENDING_QODER_OAUTH_STATE
                .lock()
                .map_err(|_| "Failed to acquire Qoder OAuth lock".to_string())?;
            let state = pending
                .as_ref()
                .cloned()
                .ok_or_else(|| "No pending Qoder OAuth login found".to_string())?;

            if state.login_id != login_id {
                return Err("Qoder OAuth login_id mismatch".to_string());
            }
            if state.cancelled {
                return Err("Qoder OAuth login cancelled".to_string());
            }
            if now_timestamp() > state.expires_at {
                return Err("Qoder OAuth login timed out".to_string());
            }

            state
        };

        match poll_qoder_device_token_once(&snapshot.expected_nonce, &snapshot.code_verifier).await {
            Ok(Some(access_token)) => {
                let result = refresh_qoder_config(Some(
                    json!({
                        "accessToken": access_token,
                    })
                    .to_string(),
                ))
                .await;

                if let Ok(mut pending) = PENDING_QODER_OAUTH_STATE.lock() {
                    if pending.as_ref().map(|state| state.login_id.as_str()) == Some(login_id.as_str()) {
                        *pending = None;
                    }
                }

                return result;
            }
            Ok(None) => {}
            Err(error) => {
                log_warn(format!("[Qoder OAuth] Device token poll failed, retrying: {}", error));
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
    }
}

#[tauri::command]
pub fn qoder_oauth_login_cancel(login_id: Option<String>) -> Result<(), String> {
    let mut pending = PENDING_QODER_OAUTH_STATE
        .lock()
        .map_err(|_| "Failed to acquire Qoder OAuth lock".to_string())?;

    let Some(state) = pending.as_mut() else {
        return Ok(());
    };

    if let Some(login_id) = login_id {
        if state.login_id != login_id {
            return Err("Qoder OAuth login_id mismatch".to_string());
        }
    }

    state.cancelled = true;
    Ok(())
}

#[tauri::command]
pub async fn refresh_qoder_token(_app: AppHandle, settings: Option<String>) -> Result<Value, String> {
    refresh_qoder_config(settings).await
}

#[tauri::command]
pub async fn switch_qoder_account(
    _app: AppHandle,
    settings: Option<String>,
) -> Result<(), String> {
    let settings_str = settings.ok_or_else(|| "Settings parameter is required".to_string())?;
    let settings_value: Value = serde_json::from_str(&settings_str)
        .map_err(|error| format!("Failed to parse settings JSON: {}", error))?;
    let db_path = resolve_qoder_state_db_path()?;

    let user_info = settings_value
        .get("userInfo")
        .cloned()
        .unwrap_or_else(|| fallback_user_info(&settings_value));
    let user_plan = settings_value
        .get("userPlan")
        .cloned()
        .unwrap_or_else(|| fallback_user_plan(&settings_value));
    let credit_usage = settings_value
        .get("creditUsage")
        .cloned()
        .unwrap_or_else(|| fallback_credit_usage(&settings_value));

    write_secret_storage_value_by_db_path(
        &db_path,
        QODER_SECRET_USER_INFO_KEY,
        &serde_json::to_string(&user_info)
            .map_err(|error| format!("Failed to serialize Qoder user info: {}", error))?,
    )?;
    write_secret_storage_value_by_db_path(
        &db_path,
        QODER_SECRET_USER_PLAN_KEY,
        &serde_json::to_string(&user_plan)
            .map_err(|error| format!("Failed to serialize Qoder user plan: {}", error))?,
    )?;
    write_secret_storage_value_by_db_path(
        &db_path,
        QODER_SECRET_CREDIT_USAGE_KEY,
        &serde_json::to_string(&credit_usage)
            .map_err(|error| format!("Failed to serialize Qoder credit usage: {}", error))?,
    )?;

    Ok(())
}
