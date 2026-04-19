use serde_json::{json, Value};
use tauri::AppHandle;

#[cfg(target_os = "macos")]
const ZED_SERVER_URL: &str = "https://zed.dev";

#[cfg(target_os = "macos")]
fn security_command_output(args: &[&str]) -> Result<std::process::Output, String> {
    std::process::Command::new("security")
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run security command: {}", error))
}

#[cfg(target_os = "macos")]
fn parse_account_from_security_output(text: &str) -> Option<String> {
    for line in text.lines() {
        if let Some(rest) = line.split("\"acct\"<blob>=\"").nth(1) {
            if let Some(value) = rest.split('"').next() {
                let trimmed = value.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }

    None
}

#[cfg(target_os = "macos")]
fn read_credentials_from_keychain() -> Result<Option<(String, String)>, String> {
    let meta_output = security_command_output(&["find-internet-password", "-s", ZED_SERVER_URL])?;
    if !meta_output.status.success() {
        let stderr = String::from_utf8_lossy(&meta_output.stderr);
        if stderr.contains("could not be found") {
            return Ok(None);
        }

        return Err(format!(
            "Failed to read Zed Keychain metadata: status={}, stderr={}",
            meta_output.status,
            stderr.trim()
        ));
    }

    let password_output =
        security_command_output(&["find-internet-password", "-s", ZED_SERVER_URL, "-w"])?;
    if !password_output.status.success() {
        let stderr = String::from_utf8_lossy(&password_output.stderr);
        return Err(format!(
            "Failed to read Zed Keychain password: status={}, stderr={}",
            password_output.status,
            stderr.trim()
        ));
    }

    let meta_text = format!(
        "{}\n{}",
        String::from_utf8_lossy(&meta_output.stdout),
        String::from_utf8_lossy(&meta_output.stderr)
    );
    let user_id = parse_account_from_security_output(&meta_text)
        .ok_or_else(|| "Failed to parse Zed user ID from Keychain".to_string())?;
    let access_token = String::from_utf8_lossy(&password_output.stdout)
        .trim()
        .to_string();

    if access_token.is_empty() {
        return Err("Zed Keychain access token is empty".to_string());
    }

    Ok(Some((user_id, access_token)))
}

#[cfg(not(target_os = "macos"))]
fn read_credentials_from_keychain() -> Result<Option<(String, String)>, String> {
    Err("Zed local import is currently only supported on macOS".to_string())
}

#[cfg(target_os = "macos")]
fn clear_credentials_from_keychain() -> Result<(), String> {
    loop {
        let output = security_command_output(&["delete-internet-password", "-s", ZED_SERVER_URL])?;
        if output.status.success() {
            continue;
        }

        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("could not be found") {
            return Ok(());
        }

        return Err(format!(
            "Failed to delete Zed Keychain credentials: status={}, stderr={}",
            output.status,
            stderr.trim()
        ));
    }
}

#[cfg(target_os = "macos")]
fn write_credentials_to_keychain(user_id: &str, access_token: &str) -> Result<(), String> {
    let normalized_user_id = user_id.trim();
    let normalized_token = access_token.trim();

    if normalized_user_id.is_empty() {
        return Err("Zed userId cannot be empty".to_string());
    }
    if normalized_token.is_empty() {
        return Err("Zed access token cannot be empty".to_string());
    }

    clear_credentials_from_keychain()?;

    let output = security_command_output(&[
        "add-internet-password",
        "-U",
        "-a",
        normalized_user_id,
        "-s",
        ZED_SERVER_URL,
        "-w",
        normalized_token,
    ])?;
    if !output.status.success() {
        return Err(format!(
            "Failed to write Zed Keychain credentials: status={}, stderr={}",
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn write_credentials_to_keychain(_user_id: &str, _access_token: &str) -> Result<(), String> {
    Err("Zed account switching is currently only supported on macOS".to_string())
}

#[tauri::command]
pub async fn zed_import_from_local(_app: AppHandle) -> Result<Value, String> {
    let (user_id, access_token) = read_credentials_from_keychain()?
        .ok_or_else(|| "No local Zed account found in Keychain".to_string())?;

    Ok(json!({
        "email": user_id,
        "name": "Zed",
        "providerId": "Zed",
        "userId": user_id,
        "accessToken": access_token,
        "source": "local",
    }))
}

#[tauri::command]
pub async fn switch_zed_account(
    _app: AppHandle,
    settings: Option<String>,
) -> Result<(), String> {
    let settings_str = settings.ok_or_else(|| "Settings parameter is required".to_string())?;
    let settings_value: Value = serde_json::from_str(&settings_str)
        .map_err(|error| format!("Failed to parse settings JSON: {}", error))?;

    let user_id = settings_value
        .get("userId")
        .or_else(|| settings_value.get("user_id"))
        .or_else(|| settings_value.get("email"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Missing Zed userId in settings".to_string())?;
    let access_token = settings_value
        .get("accessToken")
        .or_else(|| settings_value.get("access_token"))
        .or_else(|| settings_value.get("token"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Missing Zed access token in settings".to_string())?;

    write_credentials_to_keychain(user_id, access_token)
}
