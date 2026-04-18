use crate::commands::state_db::{
    find_string_recursive, get_cli_version, get_item_value, open_state_db, WINDSURF_APP,
};
use serde_json::{json, Value};
use tauri::AppHandle;

#[tauri::command]
pub async fn get_windsurf_config(_app: AppHandle) -> Result<Value, String> {
    let (connection, db_path) = open_state_db(WINDSURF_APP)?;
    let raw_auth_status =
        get_item_value(&connection, "windsurfAuthStatus", WINDSURF_APP.display_name)?
            .ok_or_else(|| "No Windsurf auth status found in local state database".to_string())?;

    let parsed: Value = serde_json::from_str(&raw_auth_status)
        .map_err(|error| format!("Failed to parse Windsurf auth status JSON: {}", error))?;

    let mut result = match parsed {
        Value::Object(map) => map,
        _ => return Err("Windsurf auth status must be a JSON object".to_string()),
    };

    if !result.contains_key("email") {
        if let Some(email) = find_string_recursive(
            &Value::Object(result.clone()),
            &["email", "userEmail", "cachedEmail"],
        ) {
            result.insert("email".to_string(), json!(email));
        }
    }

    if !result.contains_key("name") {
        if let Some(name) = find_string_recursive(
            &Value::Object(result.clone()),
            &["name", "displayName", "fullName"],
        ) {
            result.insert("name".to_string(), json!(name));
        }
    }

    if !result.contains_key("providerId") {
        if let Some(plan) = find_string_recursive(
            &Value::Object(result.clone()),
            &["plan", "subscriptionType", "membershipType", "tier"],
        ) {
            result.insert("providerId".to_string(), json!(plan));
        } else {
            result.insert("providerId".to_string(), json!("Windsurf"));
        }
    }

    result.insert("source".to_string(), json!("local"));
    result.insert(
        "localPath".to_string(),
        json!(db_path.to_string_lossy().to_string()),
    );

    if !result.contains_key("rawAuthStatus") {
        result.insert("rawAuthStatus".to_string(), json!(raw_auth_status));
    }

    Ok(Value::Object(result))
}

#[tauri::command]
pub async fn windsurf_import_from_local(app: AppHandle) -> Result<Value, String> {
    get_windsurf_config(app).await
}

pub fn get_windsurf_version() -> Option<String> {
    get_cli_version(WINDSURF_APP)
}
