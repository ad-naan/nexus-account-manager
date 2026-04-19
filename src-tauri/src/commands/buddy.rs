use once_cell::sync::Lazy;
use reqwest::RequestBuilder;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::AppHandle;

use crate::utils::local_secret_storage::{
    read_secret_storage_value_by_db_path, write_secret_storage_value_by_db_path,
};
use crate::utils::logger::{log_info, log_warn};

pub const CODEBUDDY_STATE_DB_CONFIG_KEY: &str = "codebuddy_state_db_path";
pub const CODEBUDDY_CN_STATE_DB_CONFIG_KEY: &str = "codebuddy_cn_state_db_path";
pub const WORKBUDDY_STATE_DB_CONFIG_KEY: &str = "workbuddy_state_db_path";

const BUDDY_API_PREFIX: &str = "/v2/plugin";
const CODEBUDDY_API_ENDPOINT: &str = "https://www.codebuddy.ai";
const CODEBUDDY_CN_API_ENDPOINT: &str = "https://www.codebuddy.cn";
const WORKBUDDY_API_ENDPOINT: &str = "https://www.codebuddy.cn";
const CODEBUDDY_SECRET_EXTENSION_ID: &str = "tencent-cloud.coding-copilot";
const CODEBUDDY_SECRET_KEY: &str = "planning-genie.new.accessToken";
const CODEBUDDY_CN_SECRET_KEY: &str = "planning-genie.new.accessTokencn";
const WORKBUDDY_SECRET_KEY: &str = "planning-genie.new.accessTokencn";
const BUDDY_OAUTH_TIMEOUT_SECONDS: i64 = 600;
const BUDDY_OAUTH_POLL_INTERVAL_MS: u64 = 1500;

struct BuddyPlatform {
    id: &'static str,
    display_name: &'static str,
    dir_name: &'static str,
    config_key: &'static str,
    session_key: &'static str,
    provider_id: &'static str,
    api_endpoint: &'static str,
    supports_checkin: bool,
    oauth_platform: &'static str,
    oauth_login_prefix: &'static str,
}

const CODEBUDDY_PLATFORM: BuddyPlatform = BuddyPlatform {
    id: "codebuddy",
    display_name: "CodeBuddy",
    dir_name: "CodeBuddy",
    config_key: CODEBUDDY_STATE_DB_CONFIG_KEY,
    session_key: CODEBUDDY_SECRET_KEY,
    provider_id: "CodeBuddy",
    api_endpoint: CODEBUDDY_API_ENDPOINT,
    supports_checkin: false,
    oauth_platform: "ide",
    oauth_login_prefix: "cb",
};

const CODEBUDDY_CN_PLATFORM: BuddyPlatform = BuddyPlatform {
    id: "codebuddy_cn",
    display_name: "CodeBuddy CN",
    dir_name: "CodeBuddy CN",
    config_key: CODEBUDDY_CN_STATE_DB_CONFIG_KEY,
    session_key: CODEBUDDY_CN_SECRET_KEY,
    provider_id: "CodeBuddy CN",
    api_endpoint: CODEBUDDY_CN_API_ENDPOINT,
    supports_checkin: true,
    oauth_platform: "ide",
    oauth_login_prefix: "cbcn",
};

const WORKBUDDY_PLATFORM: BuddyPlatform = BuddyPlatform {
    id: "workbuddy",
    display_name: "WorkBuddy",
    dir_name: "WorkBuddy",
    config_key: WORKBUDDY_STATE_DB_CONFIG_KEY,
    session_key: WORKBUDDY_SECRET_KEY,
    provider_id: "WorkBuddy",
    api_endpoint: WORKBUDDY_API_ENDPOINT,
    supports_checkin: true,
    oauth_platform: "workbuddy",
    oauth_login_prefix: "wb",
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct BuddyOAuthStartResponse {
    pub login_id: String,
    pub verification_uri: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verification_uri_complete: Option<String>,
    pub expires_in: i64,
    pub interval_seconds: i64,
}

#[derive(Debug, Clone)]
struct PendingBuddyOAuthState {
    login_id: String,
    platform_id: &'static str,
    state: String,
    expires_at: i64,
    cancelled: bool,
}

static PENDING_BUDDY_OAUTH_STATE: Lazy<Mutex<HashMap<String, PendingBuddyOAuthState>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct BuddyCheckinStatus {
    pub today_checked_in: bool,
    pub active: bool,
    pub streak_days: i64,
    pub daily_credit: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub today_credit: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_streak_day: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_streak_day: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checkin_dates: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct BuddyCheckinResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reward: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_checkin_in: Option<i64>,
}

fn get_platform(platform_id: &str) -> Result<&'static BuddyPlatform, String> {
    match platform_id {
        "codebuddy" => Ok(&CODEBUDDY_PLATFORM),
        "codebuddy_cn" => Ok(&CODEBUDDY_CN_PLATFORM),
        "workbuddy" => Ok(&WORKBUDDY_PLATFORM),
        _ => Err(format!("Unsupported buddy platform: {}", platform_id)),
    }
}

fn default_state_db_path(platform: &BuddyPlatform) -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata =
            std::env::var("APPDATA").map_err(|_| "APPDATA environment variable not found".to_string())?;
        return Ok(PathBuf::from(appdata)
            .join(platform.dir_name)
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
            .join(platform.dir_name)
            .join("User")
            .join("globalStorage")
            .join("state.vscdb"));
    }

    #[cfg(target_os = "linux")]
    {
        let home = dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
        return Ok(home
            .join(".config")
            .join(platform.dir_name)
            .join("User")
            .join("globalStorage")
            .join("state.vscdb"));
    }

    #[allow(unreachable_code)]
    Err(format!("{} is not supported on this platform", platform.display_name))
}

pub fn detect_buddy_state_db_path(platform_id: &str) -> Result<PathBuf, String> {
    default_state_db_path(get_platform(platform_id)?)
}

fn resolve_buddy_state_db_path(platform: &BuddyPlatform) -> Result<PathBuf, String> {
    if let Some(configured_path) = crate::utils::config::get_config_string(platform.config_key)? {
        return Ok(PathBuf::from(configured_path));
    }

    default_state_db_path(platform)
}

fn build_secret_db_key(session_key: &str) -> String {
    format!(
        r#"secret://{{"extensionId":"{}","key":"{}"}}"#,
        CODEBUDDY_SECRET_EXTENSION_ID, session_key
    )
}

fn parse_json_or_text(raw: &str) -> Value {
    serde_json::from_str(raw).unwrap_or_else(|_| Value::String(raw.to_string()))
}

fn pick_string_from_object(obj: &Map<String, Value>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| obj.get(*key).and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn pick_i64_from_object(obj: &Map<String, Value>, keys: &[&str]) -> Option<i64> {
    keys.iter().find_map(|key| {
        let raw = obj.get(*key)?;
        raw.as_i64()
            .or_else(|| raw.as_u64().and_then(|value| i64::try_from(value).ok()))
            .or_else(|| raw.as_str().and_then(|value| value.trim().parse::<i64>().ok()))
    })
}

fn parse_local_access_token(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => {
            let trimmed = text.trim();
            (!trimmed.is_empty()).then(|| trimmed.to_string())
        }
        Value::Array(items) => items.iter().find_map(parse_local_access_token),
        Value::Object(obj) => {
            let direct = pick_string_from_object(obj, &["token", "access_token", "accessToken"]);
            if direct.is_some() {
                return direct;
            }

            let auth_token = obj
                .get("auth")
                .and_then(Value::as_object)
                .and_then(|auth| pick_string_from_object(auth, &["accessToken", "access_token"]));
            if auth_token.is_some() {
                return auth_token;
            }

            obj.get("session")
                .or_else(|| obj.get("data"))
                .and_then(parse_local_access_token)
        }
        _ => None,
    }
}

fn extract_token_parts(token: &str) -> Option<(Option<String>, String)> {
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Some((prefix, suffix)) = trimmed.split_once('+') {
        let uid = prefix.trim();
        let access_token = suffix.trim();
        if access_token.is_empty() {
            return None;
        }

        return Some((
            (!uid.is_empty()).then(|| uid.to_string()),
            access_token.to_string(),
        ));
    }

    Some((None, trimmed.to_string()))
}

fn build_import_config(platform: &BuddyPlatform, raw_secret: &str, db_path: &Path) -> Result<Value, String> {
    let parsed = parse_json_or_text(raw_secret);
    let root_obj = parsed.as_object();
    let account_obj = root_obj.and_then(|obj| obj.get("account").and_then(Value::as_object));
    let auth_obj = root_obj.and_then(|obj| obj.get("auth").and_then(Value::as_object));

    let raw_token = parse_local_access_token(&parsed)
        .ok_or_else(|| format!("No {} access token found in local session", platform.display_name))?;
    let (uid_from_token, access_token) = extract_token_parts(&raw_token)
        .ok_or_else(|| format!("Invalid {} access token payload", platform.display_name))?;

    let uid = root_obj
        .and_then(|obj| pick_string_from_object(obj, &["uid"]))
        .or_else(|| account_obj.and_then(|obj| pick_string_from_object(obj, &["uid", "id"])))
        .or(uid_from_token);

    let nickname = root_obj
        .and_then(|obj| pick_string_from_object(obj, &["nickname", "name"]))
        .or_else(|| account_obj.and_then(|obj| pick_string_from_object(obj, &["nickname", "label"])));

    let email = root_obj
        .and_then(|obj| pick_string_from_object(obj, &["email"]))
        .or_else(|| account_obj.and_then(|obj| pick_string_from_object(obj, &["email"])))
        .or_else(|| auth_obj.and_then(|obj| pick_string_from_object(obj, &["email"])))
        .or_else(|| nickname.clone())
        .or_else(|| uid.clone())
        .unwrap_or_else(|| format!("{}-local", platform.id));

    let enterprise_name = root_obj
        .and_then(|obj| pick_string_from_object(obj, &["enterpriseName", "enterprise_name"]))
        .or_else(|| account_obj.and_then(|obj| {
            pick_string_from_object(obj, &["enterpriseName", "enterprise_name"])
        }));
    let refresh_token = root_obj
        .and_then(|obj| pick_string_from_object(obj, &["refreshToken", "refresh_token"]))
        .or_else(|| auth_obj.and_then(|obj| pick_string_from_object(obj, &["refreshToken", "refresh_token"])));
    let token_type = root_obj
        .and_then(|obj| pick_string_from_object(obj, &["tokenType", "token_type"]))
        .or_else(|| auth_obj.and_then(|obj| pick_string_from_object(obj, &["tokenType", "token_type"])))
        .or_else(|| Some("Bearer".to_string()));
    let domain = root_obj
        .and_then(|obj| pick_string_from_object(obj, &["domain"]))
        .or_else(|| auth_obj.and_then(|obj| pick_string_from_object(obj, &["domain"])));
    let expires_at = root_obj
        .and_then(|obj| pick_i64_from_object(obj, &["expiresAt", "expires_at"]))
        .or_else(|| auth_obj.and_then(|obj| pick_i64_from_object(obj, &["expiresAt", "expires_at"])));

    let mut result = Map::new();
    result.insert("email".to_string(), json!(email));
    result.insert(
        "name".to_string(),
        json!(nickname.clone().unwrap_or_else(|| platform.display_name.to_string())),
    );
    result.insert(
        "providerId".to_string(),
        json!(enterprise_name.clone().unwrap_or_else(|| platform.provider_id.to_string())),
    );
    result.insert("accessToken".to_string(), json!(access_token));
    result.insert("source".to_string(), json!("local"));
    result.insert(
        "localPath".to_string(),
        json!(db_path.to_string_lossy().to_string()),
    );
    result.insert("sessionRaw".to_string(), parsed);

    if let Some(value) = uid {
        result.insert("uid".to_string(), json!(value));
    }
    if let Some(value) = nickname {
        result.insert("nickname".to_string(), json!(value));
    }
    if let Some(value) = enterprise_name {
        result.insert("enterpriseName".to_string(), json!(value));
    }
    if let Some(value) = refresh_token {
        result.insert("refreshToken".to_string(), json!(value));
    }
    if let Some(value) = token_type {
        result.insert("tokenType".to_string(), json!(value));
    }
    if let Some(value) = domain {
        result.insert("domain".to_string(), json!(value));
    }
    if let Some(value) = expires_at {
        result.insert("expiresAt".to_string(), json!(value));
    }

    Ok(Value::Object(result))
}

fn build_default_session_json(platform: &BuddyPlatform, settings: &Value) -> Result<String, String> {
    if let Some(raw) = settings.get("sessionRaw") {
        match raw {
            Value::Object(_) | Value::Array(_) => {
                return serde_json::to_string(raw)
                    .map_err(|error| format!("Failed to serialize {} raw session: {}", platform.display_name, error));
            }
            Value::String(text) => {
                if !text.trim().is_empty() {
                    return Ok(text.clone());
                }
            }
            _ => {}
        }
    }

    let access_token = settings
        .get("accessToken")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("Missing {} access token", platform.display_name))?;
    let refresh_token = settings
        .get("refreshToken")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let uid = settings.get("uid").and_then(Value::as_str).unwrap_or_default();
    let nickname = settings
        .get("nickname")
        .and_then(Value::as_str)
        .or_else(|| settings.get("name").and_then(Value::as_str))
        .unwrap_or_default();
    let enterprise_name = settings
        .get("enterpriseName")
        .and_then(Value::as_str)
        .or_else(|| settings.get("providerId").and_then(Value::as_str))
        .unwrap_or_default();
    let domain = settings.get("domain").and_then(Value::as_str).unwrap_or_default();
    let expires_at = settings.get("expiresAt").and_then(Value::as_i64).unwrap_or(0);

    Ok(json!({
        "id": platform.id,
        "token": access_token,
        "refreshToken": refresh_token,
        "expiresAt": expires_at,
        "domain": domain,
        "accessToken": if uid.is_empty() {
            access_token.to_string()
        } else {
            format!("{}+{}", uid, access_token)
        },
        "converted": true,
        "account": {
            "id": uid,
            "uid": uid,
            "label": nickname,
            "nickname": nickname,
            "enterpriseName": enterprise_name,
            "pluginEnabled": true,
            "lastLogin": true,
        },
        "auth": {
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "tokenType": settings
                .get("tokenType")
                .and_then(Value::as_str)
                .unwrap_or("Bearer"),
            "domain": domain,
            "expiresAt": expires_at,
            "expiresIn": expires_at,
            "refreshExpiresIn": 0,
            "refreshExpiresAt": 0,
            "lastRefreshTime": chrono::Utc::now().timestamp_millis(),
            "email": settings.get("email").and_then(Value::as_str).unwrap_or_default(),
        }
    })
    .to_string())
}

fn settings_object(settings: &Value) -> Result<&Map<String, Value>, String> {
    settings
        .as_object()
        .ok_or_else(|| "Settings must be a JSON object".to_string())
}

fn now_timestamp() -> i64 {
    chrono::Utc::now().timestamp()
}

fn generate_login_id(prefix: &str) -> String {
    use rand::Rng;

    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..16).map(|_| rng.r#gen::<u8>()).collect();
    format!(
        "{}_{}",
        prefix,
        bytes
            .iter()
            .map(|byte| format!("{:02x}", byte))
            .collect::<String>()
    )
}

fn extract_api_message(body: &Value) -> String {
    body.get("message")
        .or_else(|| body.get("msg"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("unknown error")
        .to_string()
}

fn ensure_api_success(status: reqwest::StatusCode, body: &Value, label: &str) -> Result<(), String> {
    if !status.is_success() {
        return Err(format!(
            "{} failed (http={}): {}",
            label,
            status.as_u16(),
            extract_api_message(body)
        ));
    }

    if let Some(code) = body.get("code").and_then(Value::as_i64) {
        if code != 0 && code != 200 {
            return Err(format!(
                "{} failed (code={}): {}",
                label,
                code,
                extract_api_message(body)
            ));
        }
    }

    Ok(())
}

fn apply_buddy_headers(
    mut req: RequestBuilder,
    uid: Option<&str>,
    enterprise_id: Option<&str>,
    domain: Option<&str>,
) -> RequestBuilder {
    if let Some(value) = uid.filter(|value| !value.trim().is_empty()) {
        req = req.header("X-User-Id", value.trim());
    }
    if let Some(value) = enterprise_id.filter(|value| !value.trim().is_empty()) {
        req = req.header("X-Enterprise-Id", value.trim());
        req = req.header("X-Tenant-Id", value.trim());
    }
    if let Some(value) = domain.filter(|value| !value.trim().is_empty()) {
        req = req.header("X-Domain", value.trim());
    }
    req
}

fn normalize_non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn normalize_product_code(value: Option<&str>) -> String {
    normalize_non_empty(value).unwrap_or_else(|| "p_tcaca".to_string())
}

fn normalize_user_resource_status(status: &[i32]) -> Vec<i32> {
    let mut normalized: Vec<i32> = status.iter().copied().filter(|value| *value >= 0).collect();
    if normalized.is_empty() {
        return vec![0, 3];
    }
    normalized.sort_unstable();
    normalized.dedup();
    normalized
}

fn build_default_user_resource_time_range() -> (String, String) {
    let now = chrono::Local::now();
    let begin = now.format("%Y-%m-%d %H:%M:%S").to_string();
    let end = (now + chrono::Duration::days(365 * 101))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    (begin, end)
}

async fn fetch_profile_account(platform: &BuddyPlatform, access_token: &str) -> Result<Value, String> {
    let url = format!("{}{}{}", platform.api_endpoint, BUDDY_API_PREFIX, "/accounts");
    let response = crate::utils::http::get_client()
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|error| format!("Failed to request {} account profile: {}", platform.display_name, error))?;

    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|error| format!("Failed to parse {} account profile: {}", platform.display_name, error))?;

    ensure_api_success(status, &body, &format!("{} account profile", platform.display_name))?;

    let accounts = body
        .get("data")
        .and_then(|data| data.get("accounts"))
        .and_then(Value::as_array);

    Ok(accounts
        .and_then(|items| {
            items
                .iter()
                .find(|item| item.get("lastLogin").and_then(Value::as_bool).unwrap_or(false))
                .or_else(|| items.first())
        })
        .cloned()
        .unwrap_or_else(|| json!({})))
}

async fn refresh_remote_token(
    platform: &BuddyPlatform,
    access_token: &str,
    refresh_token: &str,
    domain: Option<&str>,
) -> Result<Value, String> {
    let url = format!("{}{}{}", platform.api_endpoint, BUDDY_API_PREFIX, "/auth/token/refresh");
    let request = crate::utils::http::get_client()
        .post(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("X-Refresh-Token", refresh_token)
        .json(&json!({}));
    let request = apply_buddy_headers(request, None, None, domain);

    let response = request
        .send()
        .await
        .map_err(|error| format!("Failed to refresh {} token: {}", platform.display_name, error))?;

    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|error| format!("Failed to parse {} refresh response: {}", platform.display_name, error))?;

    ensure_api_success(status, &body, &format!("{} token refresh", platform.display_name))?;

    body.get("data")
        .cloned()
        .ok_or_else(|| format!("{} refresh response missing data field", platform.display_name))
}

async fn fetch_meter_payload(
    platform: &BuddyPlatform,
    endpoint: &str,
    access_token: &str,
    uid: Option<&str>,
    enterprise_id: Option<&str>,
    domain: Option<&str>,
    body: Option<Value>,
) -> Result<Value, String> {
    let url = format!("{}{endpoint}", platform.api_endpoint);
    let request = crate::utils::http::get_client()
        .post(&url)
        .header("Accept", "application/json, text/plain, */*")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json");
    let request = apply_buddy_headers(request, uid, enterprise_id, domain);
    let request = if let Some(payload) = body {
        request.json(&payload)
    } else {
        request
    };

    let response = request
        .send()
        .await
        .map_err(|error| format!("Failed to request {} {}: {}", platform.display_name, endpoint, error))?;

    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|error| format!("Failed to parse {} {} response: {}", platform.display_name, endpoint, error))?;

    ensure_api_success(status, &body, &format!("{} {}", platform.display_name, endpoint))?;
    Ok(body)
}

async fn fetch_dosage_notify(
    platform: &BuddyPlatform,
    access_token: &str,
    uid: Option<&str>,
    enterprise_id: Option<&str>,
    domain: Option<&str>,
) -> Result<Value, String> {
    fetch_meter_payload(
        platform,
        "/v2/billing/meter/get-dosage-notify",
        access_token,
        uid,
        enterprise_id,
        domain,
        None,
    )
    .await
}

async fn fetch_payment_type(
    platform: &BuddyPlatform,
    access_token: &str,
    uid: Option<&str>,
    enterprise_id: Option<&str>,
    domain: Option<&str>,
) -> Result<Value, String> {
    fetch_meter_payload(
        platform,
        "/v2/billing/meter/get-payment-type",
        access_token,
        uid,
        enterprise_id,
        domain,
        None,
    )
    .await
}

async fn fetch_user_resource_default(
    platform: &BuddyPlatform,
    access_token: &str,
    uid: Option<&str>,
    enterprise_id: Option<&str>,
    domain: Option<&str>,
) -> Result<Value, String> {
    let product_code = normalize_product_code(None);
    let status = normalize_user_resource_status(&[]);
    let (begin, end) = build_default_user_resource_time_range();
    fetch_meter_payload(
        platform,
        "/v2/billing/meter/get-user-resource",
        access_token,
        uid,
        enterprise_id,
        domain,
        Some(json!({
            "PageNumber": 1,
            "PageSize": 100,
            "ProductCode": product_code,
            "Status": status,
            "PackageEndTimeRangeBegin": begin,
            "PackageEndTimeRangeEnd": end,
        })),
    )
    .await
}

async fn get_checkin_status_by_token(
    platform: &BuddyPlatform,
    access_token: &str,
    uid: Option<&str>,
    enterprise_id: Option<&str>,
    domain: Option<&str>,
) -> Result<BuddyCheckinStatus, String> {
    if !platform.supports_checkin {
        return Err(format!("{} does not support check-in", platform.display_name));
    }

    let payload = fetch_meter_payload(
        platform,
        "/v2/billing/meter/checkin-status",
        access_token,
        uid,
        enterprise_id,
        domain,
        None,
    )
    .await?;

    let data = payload
        .get("data")
        .cloned()
        .ok_or_else(|| format!("{} check-in status response missing data field", platform.display_name))?;

    serde_json::from_value(data)
        .map_err(|error| format!("Failed to parse {} check-in status: {}", platform.display_name, error))
}

async fn perform_checkin_by_token(
    platform: &BuddyPlatform,
    access_token: &str,
    uid: Option<&str>,
    enterprise_id: Option<&str>,
    domain: Option<&str>,
) -> Result<BuddyCheckinResponse, String> {
    if !platform.supports_checkin {
        return Err(format!("{} does not support check-in", platform.display_name));
    }

    let url = format!("{}/v2/billing/meter/daily-checkin", platform.api_endpoint);
    let request = crate::utils::http::get_client()
        .post(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .json(&json!({}));
    let request = apply_buddy_headers(request, uid, enterprise_id, domain);

    let response = request
        .send()
        .await
        .map_err(|error| format!("Failed to perform {} check-in: {}", platform.display_name, error))?;

    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|error| format!("Failed to parse {} check-in response: {}", platform.display_name, error))?;

    if !status.is_success() {
        return Err(format!(
            "{} check-in failed (http={}): {}",
            platform.display_name,
            status.as_u16(),
            extract_api_message(&body)
        ));
    }

    let code = body.get("code").and_then(Value::as_i64).unwrap_or(-1);
    if code != 0 && code != 200 {
        return Ok(BuddyCheckinResponse {
            success: false,
            message: Some(extract_api_message(&body)),
            reward: None,
            next_checkin_in: None,
        });
    }

    let data = body
        .get("data")
        .cloned()
        .ok_or_else(|| format!("{} check-in response missing data field", platform.display_name))?;

    Ok(BuddyCheckinResponse {
        success: data.get("success").and_then(Value::as_bool).unwrap_or(true),
        message: data
            .get("message")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
        reward: data.get("reward").cloned(),
        next_checkin_in: data
            .get("nextCheckinIn")
            .or_else(|| data.get("next_checkin_in"))
            .and_then(Value::as_i64),
    })
}

fn build_buddy_config_result(
    platform: &BuddyPlatform,
    profile: &Value,
    settings: &Map<String, Value>,
    access_token: String,
    refresh_token: Option<String>,
    token_type: Option<String>,
    domain: Option<String>,
    expires_at: Option<i64>,
    quota_raw: Option<Value>,
    usage_raw: Option<Value>,
    checkin_status: Option<BuddyCheckinStatus>,
) -> Value {
    let profile_obj = profile.as_object();
    let email = profile_obj
        .and_then(|obj| pick_string_from_object(obj, &["email"]))
        .or_else(|| pick_string_from_object(settings, &["email"]))
        .or_else(|| profile_obj.and_then(|obj| pick_string_from_object(obj, &["nickname"])))
        .or_else(|| profile_obj.and_then(|obj| pick_string_from_object(obj, &["uid"])))
        .unwrap_or_else(|| format!("{}-token", platform.id));
    let name = profile_obj
        .and_then(|obj| pick_string_from_object(obj, &["nickname", "name"]))
        .or_else(|| pick_string_from_object(settings, &["name"]))
        .unwrap_or_else(|| platform.display_name.to_string());
    let provider_id = profile_obj
        .and_then(|obj| pick_string_from_object(obj, &["enterpriseName", "enterprise_name"]))
        .or_else(|| pick_string_from_object(settings, &["providerId"]))
        .unwrap_or_else(|| platform.provider_id.to_string());
    let uid = profile_obj.and_then(|obj| pick_string_from_object(obj, &["uid", "id"]));
    let nickname = profile_obj.and_then(|obj| pick_string_from_object(obj, &["nickname", "label"]));
    let enterprise_id = profile_obj.and_then(|obj| pick_string_from_object(obj, &["enterpriseId"]));
    let enterprise_name =
        profile_obj.and_then(|obj| pick_string_from_object(obj, &["enterpriseName", "enterprise_name"]));

    let mut result = Map::new();
    result.insert("email".to_string(), json!(email));
    result.insert("name".to_string(), json!(name));
    result.insert("providerId".to_string(), json!(provider_id));
    result.insert("accessToken".to_string(), json!(access_token));
    result.insert("profileRaw".to_string(), profile.clone());

    if let Some(value) = refresh_token {
        result.insert("refreshToken".to_string(), json!(value));
    }
    if let Some(value) = token_type {
        result.insert("tokenType".to_string(), json!(value));
    }
    if let Some(value) = domain {
        result.insert("domain".to_string(), json!(value));
    }
    if let Some(value) = expires_at {
        result.insert("expiresAt".to_string(), json!(value));
    }
    if let Some(value) = uid {
        result.insert("uid".to_string(), json!(value));
    }
    if let Some(value) = nickname {
        result.insert("nickname".to_string(), json!(value));
    }
    if let Some(value) = enterprise_id {
        result.insert("enterpriseId".to_string(), json!(value));
    }
    if let Some(value) = enterprise_name {
        result.insert("enterpriseName".to_string(), json!(value));
    }
    if let Some(value) = quota_raw {
        result.insert("quotaRaw".to_string(), value);
    }
    if let Some(value) = usage_raw {
        result.insert("usageRaw".to_string(), value);
    }
    if let Some(value) = checkin_status {
        result.insert("checkinStatus".to_string(), json!(value));
    }

    Value::Object(result)
}

fn parse_settings_payload(settings: Option<String>) -> Result<Value, String> {
    let settings_str = settings.ok_or_else(|| "Settings parameter is required".to_string())?;
    serde_json::from_str(&settings_str).map_err(|error| format!("Failed to parse settings JSON: {}", error))
}

async fn refresh_buddy_config_value(platform: &BuddyPlatform, settings_value: Value) -> Result<Value, String> {
    let settings_obj = settings_object(&settings_value)?;

    let mut access_token = pick_string_from_object(settings_obj, &["accessToken", "access_token", "token"])
        .ok_or_else(|| format!("Missing {} access token", platform.display_name))?;
    let mut refresh_token = pick_string_from_object(settings_obj, &["refreshToken", "refresh_token"]);
    let mut token_type = pick_string_from_object(settings_obj, &["tokenType", "token_type"])
        .or_else(|| Some("Bearer".to_string()));
    let mut domain = pick_string_from_object(settings_obj, &["domain"]);
    let mut expires_at = pick_i64_from_object(settings_obj, &["expiresAt", "expires_at"]);

    if let Some(refresh_value) = refresh_token.clone() {
        match refresh_remote_token(platform, &access_token, &refresh_value, domain.as_deref()).await {
            Ok(payload) => {
                log_info(format!("[{}] Token refreshed successfully", platform.display_name));
                access_token = payload
                    .get("accessToken")
                    .or_else(|| payload.get("access_token"))
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .unwrap_or(access_token);
                refresh_token = payload
                    .get("refreshToken")
                    .or_else(|| payload.get("refresh_token"))
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .or(refresh_token);
                token_type = payload
                    .get("tokenType")
                    .or_else(|| payload.get("token_type"))
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .or(token_type);
                domain = payload
                    .get("domain")
                    .and_then(Value::as_str)
                    .map(str::to_string)
                    .or(domain);
                expires_at = payload
                    .get("expiresAt")
                    .or_else(|| payload.get("expires_at"))
                    .and_then(Value::as_i64)
                    .or(expires_at);
            }
            Err(error) => {
                log_warn(format!(
                    "[{}] Token refresh failed, falling back to current access token: {}",
                    platform.display_name, error
                ));
            }
        }
    }

    let profile = fetch_profile_account(platform, &access_token).await?;
    let profile_obj = profile.as_object();
    let uid = profile_obj
        .and_then(|obj| pick_string_from_object(obj, &["uid", "id"]))
        .or_else(|| pick_string_from_object(settings_obj, &["uid"]));
    let enterprise_id = profile_obj
        .and_then(|obj| pick_string_from_object(obj, &["enterpriseId"]))
        .or_else(|| pick_string_from_object(settings_obj, &["enterpriseId"]));

    let dosage = fetch_dosage_notify(
        platform,
        &access_token,
        uid.as_deref(),
        enterprise_id.as_deref(),
        domain.as_deref(),
    )
    .await
    .ok();
    let payment = fetch_payment_type(
        platform,
        &access_token,
        uid.as_deref(),
        enterprise_id.as_deref(),
        domain.as_deref(),
    )
    .await
    .ok();
    let user_resource = fetch_user_resource_default(
        platform,
        &access_token,
        uid.as_deref(),
        enterprise_id.as_deref(),
        domain.as_deref(),
    )
    .await
    .ok();

    let mut quota_map = Map::new();
    if let Some(value) = &dosage {
        quota_map.insert("dosage".to_string(), value.clone());
    }
    if let Some(value) = &payment {
        quota_map.insert("payment".to_string(), value.clone());
    }
    if let Some(value) = &user_resource {
        quota_map.insert("userResource".to_string(), value.clone());
    }

    let checkin_status = if platform.supports_checkin {
        get_checkin_status_by_token(
            platform,
            &access_token,
            uid.as_deref(),
            enterprise_id.as_deref(),
            domain.as_deref(),
        )
        .await
        .ok()
    } else {
        None
    };

    Ok(build_buddy_config_result(
        platform,
        &profile,
        settings_obj,
        access_token,
        refresh_token,
        token_type,
        domain,
        expires_at,
        (!quota_map.is_empty()).then_some(Value::Object(quota_map)),
        user_resource,
        checkin_status,
    ))
}

async fn refresh_buddy_config(platform: &BuddyPlatform, settings: Option<String>) -> Result<Value, String> {
    refresh_buddy_config_value(platform, parse_settings_payload(settings)?).await
}

async fn get_buddy_checkin_status(platform: &BuddyPlatform, settings: Option<String>) -> Result<BuddyCheckinStatus, String> {
    let settings_value = parse_settings_payload(settings)?;
    let settings_obj = settings_object(&settings_value)?;
    let access_token = pick_string_from_object(settings_obj, &["accessToken", "access_token", "token"])
        .ok_or_else(|| format!("Missing {} access token", platform.display_name))?;
    let uid = pick_string_from_object(settings_obj, &["uid"]);
    let enterprise_id = pick_string_from_object(settings_obj, &["enterpriseId"]);
    let domain = pick_string_from_object(settings_obj, &["domain"]);

    get_checkin_status_by_token(
        platform,
        &access_token,
        uid.as_deref(),
        enterprise_id.as_deref(),
        domain.as_deref(),
    )
    .await
}

async fn checkin_buddy(platform: &BuddyPlatform, settings: Option<String>) -> Result<BuddyCheckinResponse, String> {
    let settings_value = parse_settings_payload(settings)?;
    let settings_obj = settings_object(&settings_value)?;
    let access_token = pick_string_from_object(settings_obj, &["accessToken", "access_token", "token"])
        .ok_or_else(|| format!("Missing {} access token", platform.display_name))?;
    let uid = pick_string_from_object(settings_obj, &["uid"]);
    let enterprise_id = pick_string_from_object(settings_obj, &["enterpriseId"]);
    let domain = pick_string_from_object(settings_obj, &["domain"]);

    perform_checkin_by_token(
        platform,
        &access_token,
        uid.as_deref(),
        enterprise_id.as_deref(),
        domain.as_deref(),
    )
    .await
}

fn clear_pending_buddy_login(login_id: &str) -> Result<(), String> {
    let mut pending = PENDING_BUDDY_OAUTH_STATE
        .lock()
        .map_err(|_| "Failed to acquire buddy OAuth lock".to_string())?;
    pending.remove(login_id);
    Ok(())
}

async fn start_buddy_oauth(platform: &BuddyPlatform) -> Result<BuddyOAuthStartResponse, String> {
    let url = format!(
        "{}{}/auth/state?platform={}",
        platform.api_endpoint, BUDDY_API_PREFIX, platform.oauth_platform
    );

    let response = crate::utils::http::get_client()
        .post(&url)
        .json(&json!({}))
        .send()
        .await
        .map_err(|error| format!("Failed to start {} OAuth: {}", platform.display_name, error))?;

    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|error| format!("Failed to parse {} OAuth start response: {}", platform.display_name, error))?;

    ensure_api_success(status, &body, &format!("{} OAuth start", platform.display_name))?;

    let data = body
        .get("data")
        .ok_or_else(|| format!("{} OAuth start response missing data field", platform.display_name))?;
    let state = data
        .get("state")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("{} OAuth start response missing state", platform.display_name))?
        .to_string();
    let auth_url = data
        .get("authUrl")
        .or_else(|| data.get("auth_url"))
        .or_else(|| data.get("url"))
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or("");
    let verification_uri = if auth_url.is_empty() {
        format!("{}/login?state={}", platform.api_endpoint, state)
    } else {
        auth_url.to_string()
    };
    let login_id = generate_login_id(platform.oauth_login_prefix);

    let mut pending = PENDING_BUDDY_OAUTH_STATE
        .lock()
        .map_err(|_| "Failed to acquire buddy OAuth lock".to_string())?;
    pending.insert(
        login_id.clone(),
        PendingBuddyOAuthState {
            login_id: login_id.clone(),
            platform_id: platform.id,
            state,
            expires_at: now_timestamp() + BUDDY_OAUTH_TIMEOUT_SECONDS,
            cancelled: false,
        },
    );

    Ok(BuddyOAuthStartResponse {
        login_id,
        verification_uri: verification_uri.clone(),
        verification_uri_complete: Some(verification_uri),
        expires_in: BUDDY_OAUTH_TIMEOUT_SECONDS,
        interval_seconds: (BUDDY_OAUTH_POLL_INTERVAL_MS / 1000 + 1) as i64,
    })
}

async fn complete_buddy_oauth(platform: &BuddyPlatform, login_id: String) -> Result<Value, String> {
    loop {
        let state_info = {
            let pending = PENDING_BUDDY_OAUTH_STATE
                .lock()
                .map_err(|_| "Failed to acquire buddy OAuth lock".to_string())?;
            let current = pending
                .get(&login_id)
                .cloned()
                .ok_or_else(|| format!("No pending {} OAuth login found", platform.display_name))?;

            if current.platform_id != platform.id {
                return Err(format!("{} OAuth login does not match platform", platform.display_name));
            }
            if current.cancelled {
                return Err(format!("{} OAuth login was cancelled", platform.display_name));
            }
            if now_timestamp() > current.expires_at {
                return Err(format!("{} OAuth login timed out", platform.display_name));
            }

            current
        };

        let poll_url = format!(
            "{}{}/auth/token?state={}",
            platform.api_endpoint, BUDDY_API_PREFIX, state_info.state
        );
        let response = crate::utils::http::get_client().get(&poll_url).send().await;

        if let Ok(response) = response {
            let body = response.json::<Value>().await.unwrap_or_else(|_| json!({}));
            let code = body.get("code").and_then(Value::as_i64).unwrap_or(-1);

            if code == 0 || code == 200 {
                if let Some(data) = body.get("data") {
                    let access_token = data
                        .get("accessToken")
                        .or_else(|| data.get("access_token"))
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(str::to_string);

                    if let Some(access_token) = access_token {
                        let mut settings = Map::new();
                        settings.insert("accessToken".to_string(), json!(access_token));

                        if let Some(value) = data
                            .get("refreshToken")
                            .or_else(|| data.get("refresh_token"))
                            .and_then(Value::as_str)
                            .map(str::trim)
                            .filter(|value| !value.is_empty())
                        {
                            settings.insert("refreshToken".to_string(), json!(value));
                        }
                        if let Some(value) = data
                            .get("tokenType")
                            .or_else(|| data.get("token_type"))
                            .and_then(Value::as_str)
                            .map(str::trim)
                            .filter(|value| !value.is_empty())
                        {
                            settings.insert("tokenType".to_string(), json!(value));
                        }
                        if let Some(value) = data
                            .get("domain")
                            .and_then(Value::as_str)
                            .map(str::trim)
                            .filter(|value| !value.is_empty())
                        {
                            settings.insert("domain".to_string(), json!(value));
                        }
                        if let Some(value) = data
                            .get("expiresAt")
                            .or_else(|| data.get("expires_at"))
                            .and_then(Value::as_i64)
                        {
                            settings.insert("expiresAt".to_string(), json!(value));
                        }

                        let result =
                            refresh_buddy_config_value(platform, Value::Object(settings)).await;
                        let _ = clear_pending_buddy_login(&login_id);
                        return result;
                    }
                }
            }
        }

        tokio::time::sleep(std::time::Duration::from_millis(BUDDY_OAUTH_POLL_INTERVAL_MS)).await;
    }
}

fn cancel_buddy_oauth(platform: &BuddyPlatform, login_id: Option<String>) -> Result<(), String> {
    let mut pending = PENDING_BUDDY_OAUTH_STATE
        .lock()
        .map_err(|_| "Failed to acquire buddy OAuth lock".to_string())?;

    if let Some(login_id) = login_id {
        let current = pending
            .get_mut(&login_id)
            .ok_or_else(|| format!("No pending {} OAuth login found", platform.display_name))?;
        if current.platform_id != platform.id || current.login_id != login_id {
            return Err(format!("{} OAuth login does not match platform", platform.display_name));
        }
        current.cancelled = true;
        return Ok(());
    }

    for current in pending.values_mut() {
        if current.platform_id == platform.id {
            current.cancelled = true;
        }
    }

    Ok(())
}

async fn import_from_local(platform: &BuddyPlatform) -> Result<Value, String> {
    let db_path = resolve_buddy_state_db_path(platform)?;
    let db_key = build_secret_db_key(platform.session_key);
    let raw_secret = read_secret_storage_value_by_db_path(&db_path, &db_key)?
        .ok_or_else(|| format!("No {} local session found", platform.display_name))?;

    build_import_config(platform, &raw_secret, &db_path)
}

async fn switch_account(platform: &BuddyPlatform, settings: Option<String>) -> Result<(), String> {
    let settings_value = parse_settings_payload(settings)?;
    let session_json = build_default_session_json(platform, &settings_value)?;
    let db_path = resolve_buddy_state_db_path(platform)?;
    let db_key = build_secret_db_key(platform.session_key);

    write_secret_storage_value_by_db_path(&db_path, &db_key, &session_json)?;
    Ok(())
}

#[tauri::command]
pub async fn codebuddy_import_from_local(_app: AppHandle) -> Result<Value, String> {
    import_from_local(&CODEBUDDY_PLATFORM).await
}

#[tauri::command]
pub async fn codebuddy_oauth_login_start() -> Result<BuddyOAuthStartResponse, String> {
    start_buddy_oauth(&CODEBUDDY_PLATFORM).await
}

#[tauri::command]
pub async fn codebuddy_oauth_login_complete(
    _app: AppHandle,
    login_id: String,
) -> Result<Value, String> {
    complete_buddy_oauth(&CODEBUDDY_PLATFORM, login_id).await
}

#[tauri::command]
pub fn codebuddy_oauth_login_cancel(login_id: Option<String>) -> Result<(), String> {
    cancel_buddy_oauth(&CODEBUDDY_PLATFORM, login_id)
}

#[tauri::command]
pub async fn codebuddy_cn_import_from_local(_app: AppHandle) -> Result<Value, String> {
    import_from_local(&CODEBUDDY_CN_PLATFORM).await
}

#[tauri::command]
pub async fn codebuddy_cn_oauth_login_start() -> Result<BuddyOAuthStartResponse, String> {
    start_buddy_oauth(&CODEBUDDY_CN_PLATFORM).await
}

#[tauri::command]
pub async fn codebuddy_cn_oauth_login_complete(
    _app: AppHandle,
    login_id: String,
) -> Result<Value, String> {
    complete_buddy_oauth(&CODEBUDDY_CN_PLATFORM, login_id).await
}

#[tauri::command]
pub fn codebuddy_cn_oauth_login_cancel(login_id: Option<String>) -> Result<(), String> {
    cancel_buddy_oauth(&CODEBUDDY_CN_PLATFORM, login_id)
}

#[tauri::command]
pub async fn workbuddy_import_from_local(_app: AppHandle) -> Result<Value, String> {
    import_from_local(&WORKBUDDY_PLATFORM).await
}

#[tauri::command]
pub async fn workbuddy_oauth_login_start() -> Result<BuddyOAuthStartResponse, String> {
    start_buddy_oauth(&WORKBUDDY_PLATFORM).await
}

#[tauri::command]
pub async fn workbuddy_oauth_login_complete(
    _app: AppHandle,
    login_id: String,
) -> Result<Value, String> {
    complete_buddy_oauth(&WORKBUDDY_PLATFORM, login_id).await
}

#[tauri::command]
pub fn workbuddy_oauth_login_cancel(login_id: Option<String>) -> Result<(), String> {
    cancel_buddy_oauth(&WORKBUDDY_PLATFORM, login_id)
}

#[tauri::command]
pub async fn switch_codebuddy_account(
    _app: AppHandle,
    settings: Option<String>,
) -> Result<(), String> {
    switch_account(&CODEBUDDY_PLATFORM, settings).await
}

#[tauri::command]
pub async fn switch_codebuddy_cn_account(
    _app: AppHandle,
    settings: Option<String>,
) -> Result<(), String> {
    switch_account(&CODEBUDDY_CN_PLATFORM, settings).await
}

#[tauri::command]
pub async fn switch_workbuddy_account(
    _app: AppHandle,
    settings: Option<String>,
) -> Result<(), String> {
    switch_account(&WORKBUDDY_PLATFORM, settings).await
}

#[tauri::command]
pub async fn refresh_codebuddy_token(_app: AppHandle, settings: Option<String>) -> Result<Value, String> {
    refresh_buddy_config(&CODEBUDDY_PLATFORM, settings).await
}

#[tauri::command]
pub async fn refresh_codebuddy_cn_token(
    _app: AppHandle,
    settings: Option<String>,
) -> Result<Value, String> {
    refresh_buddy_config(&CODEBUDDY_CN_PLATFORM, settings).await
}

#[tauri::command]
pub async fn refresh_workbuddy_token(_app: AppHandle, settings: Option<String>) -> Result<Value, String> {
    refresh_buddy_config(&WORKBUDDY_PLATFORM, settings).await
}

#[tauri::command]
pub async fn get_checkin_status_codebuddy_cn(
    _app: AppHandle,
    settings: Option<String>,
) -> Result<BuddyCheckinStatus, String> {
    get_buddy_checkin_status(&CODEBUDDY_CN_PLATFORM, settings).await
}

#[tauri::command]
pub async fn get_checkin_status_workbuddy(
    _app: AppHandle,
    settings: Option<String>,
) -> Result<BuddyCheckinStatus, String> {
    get_buddy_checkin_status(&WORKBUDDY_PLATFORM, settings).await
}

#[tauri::command]
pub async fn checkin_codebuddy_cn(
    _app: AppHandle,
    settings: Option<String>,
) -> Result<BuddyCheckinResponse, String> {
    checkin_buddy(&CODEBUDDY_CN_PLATFORM, settings).await
}

#[tauri::command]
pub async fn checkin_workbuddy(
    _app: AppHandle,
    settings: Option<String>,
) -> Result<BuddyCheckinResponse, String> {
    checkin_buddy(&WORKBUDDY_PLATFORM, settings).await
}
