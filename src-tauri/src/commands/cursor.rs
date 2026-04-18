use crate::commands::state_db::{
    get_cli_version, get_item_value, open_state_db, set_item_value, CURSOR_APP,
};
use crate::utils::logger::log_info;
use serde_json::{json, Value};
use tauri::AppHandle;

fn extract_text(settings: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| settings.get(*key).and_then(|value| value.as_str()))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[tauri::command]
pub async fn get_cursor_config(_app: AppHandle) -> Result<Value, String> {
    let (connection, db_path) = open_state_db(CURSOR_APP)?;

    let access_token = get_item_value(
        &connection,
        "cursorAuth/accessToken",
        CURSOR_APP.display_name,
    )?;
    let refresh_token = get_item_value(
        &connection,
        "cursorAuth/refreshToken",
        CURSOR_APP.display_name,
    )?;
    let email = get_item_value(
        &connection,
        "cursorAuth/cachedEmail",
        CURSOR_APP.display_name,
    )?;
    let auth_id = get_item_value(&connection, "cursorAuth/authId", CURSOR_APP.display_name)?;
    let membership_type = get_item_value(
        &connection,
        "cursorAuth/stripeMembershipType",
        CURSOR_APP.display_name,
    )?;
    let subscription_status = get_item_value(
        &connection,
        "cursorAuth/stripeSubscriptionStatus",
        CURSOR_APP.display_name,
    )?;
    let sign_up_type = get_item_value(
        &connection,
        "cursorAuth/cachedSignUpType",
        CURSOR_APP.display_name,
    )?;

    if access_token.is_none() && refresh_token.is_none() && email.is_none() {
        return Err("No Cursor account data found in local state database".to_string());
    }

    let mut result = serde_json::Map::new();

    if let Some(value) = access_token {
        result.insert("accessToken".to_string(), json!(value));
    }
    if let Some(value) = refresh_token {
        result.insert("refreshToken".to_string(), json!(value));
    }
    if let Some(value) = email {
        result.insert("email".to_string(), json!(value));
    }
    if let Some(value) = auth_id {
        result.insert("authId".to_string(), json!(value));
    }
    if let Some(value) = membership_type.clone() {
        result.insert("stripeMembershipType".to_string(), json!(value));
        result.insert("providerId".to_string(), json!(value));
    } else {
        result.insert("providerId".to_string(), json!("Cursor"));
    }
    if let Some(value) = subscription_status {
        result.insert("stripeSubscriptionStatus".to_string(), json!(value));
    }
    if let Some(value) = sign_up_type {
        result.insert("cachedSignUpType".to_string(), json!(value));
    }

    result.insert("source".to_string(), json!("local"));
    result.insert(
        "localPath".to_string(),
        json!(db_path.to_string_lossy().to_string()),
    );

    Ok(Value::Object(result))
}

#[tauri::command]
pub async fn cursor_import_from_local(app: AppHandle) -> Result<Value, String> {
    get_cursor_config(app).await
}

#[tauri::command]
pub async fn switch_cursor_account(
    _app: AppHandle,
    settings: Option<String>,
) -> Result<(), String> {
    log_info("Switching Cursor account...");

    let settings_str = settings.ok_or_else(|| "Settings parameter is required".to_string())?;
    let settings_value: Value = serde_json::from_str(&settings_str)
        .map_err(|error| format!("Failed to parse settings JSON: {}", error))?;

    let access_token = extract_text(&settings_value, &["accessToken", "access_token", "token"])
        .ok_or_else(|| "Missing Cursor access token in settings".to_string())?;
    let refresh_token = extract_text(&settings_value, &["refreshToken", "refresh_token"]);
    let email = extract_text(&settings_value, &["email", "cachedEmail", "userEmail"])
        .ok_or_else(|| "Missing Cursor email in settings".to_string())?;
    let auth_id = extract_text(&settings_value, &["authId", "auth_id"]);
    let membership_type = extract_text(
        &settings_value,
        &[
            "stripeMembershipType",
            "membershipType",
            "providerId",
            "plan",
        ],
    );
    let subscription_status = extract_text(
        &settings_value,
        &["stripeSubscriptionStatus", "subscriptionStatus"],
    );
    let sign_up_type = extract_text(
        &settings_value,
        &["cachedSignUpType", "signUpType", "signupType"],
    );

    let (mut connection, db_path) = open_state_db(CURSOR_APP)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Failed to start Cursor transaction: {}", error))?;

    set_item_value(
        &transaction,
        "cursorAuth/accessToken",
        Some(&access_token),
        CURSOR_APP.display_name,
    )?;
    set_item_value(
        &transaction,
        "cursorAuth/refreshToken",
        refresh_token.as_deref(),
        CURSOR_APP.display_name,
    )?;
    set_item_value(
        &transaction,
        "cursorAuth/cachedEmail",
        Some(&email),
        CURSOR_APP.display_name,
    )?;
    set_item_value(
        &transaction,
        "cursorAuth/authId",
        auth_id.as_deref(),
        CURSOR_APP.display_name,
    )?;
    set_item_value(
        &transaction,
        "cursorAuth/stripeMembershipType",
        membership_type.as_deref(),
        CURSOR_APP.display_name,
    )?;
    set_item_value(
        &transaction,
        "cursorAuth/stripeSubscriptionStatus",
        subscription_status.as_deref(),
        CURSOR_APP.display_name,
    )?;
    set_item_value(
        &transaction,
        "cursorAuth/cachedSignUpType",
        sign_up_type.as_deref(),
        CURSOR_APP.display_name,
    )?;
    set_item_value(
        &transaction,
        "cursor.accessToken",
        Some(&access_token),
        CURSOR_APP.display_name,
    )?;
    set_item_value(
        &transaction,
        "cursor.email",
        Some(&email),
        CURSOR_APP.display_name,
    )?;

    transaction
        .commit()
        .map_err(|error| format!("Failed to commit Cursor account switch: {}", error))?;

    log_info(&format!(
        "Cursor account switched successfully via {}",
        db_path.display()
    ));
    Ok(())
}

pub fn get_cursor_version() -> Option<String> {
    get_cli_version(CURSOR_APP)
}
