use crate::utils::logger::log_info;
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle};

/// Get Gemini config.toml file path
fn get_gemini_config_path(_app: &AppHandle) -> Result<PathBuf, String> {
    // Check for environment variable override
    if let Ok(env_path) = env::var("GEMINI_CONFIG_PATH") {
        log_info(&format!("Using Gemini config path from environment: {}", env_path));
        return Ok(PathBuf::from(env_path));
    }
    
    // Default path: ~/.gemini/config.toml
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Failed to get home directory".to_string())?;
    
    let config_path = home_dir.join(".gemini").join("config.toml");
    Ok(config_path)
}

/// Write Gemini config.toml file from settings JSON
fn write_gemini_config_from_settings(app: &AppHandle, settings: &Value) -> Result<(), String> {
    let config_path = get_gemini_config_path(app)?;
    
    // Ensure .gemini directory exists
    if let Some(parent) = config_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create .gemini directory: {}", e))?;
            log_info(&format!("Created directory: {}", parent.display()));
        }
    }

    // Extract env object from settings
    let env_obj = settings.get("env")
        .ok_or_else(|| "Missing 'env' object in settings".to_string())?;
    
    // Get API keys
    let gemini_api_key = env_obj.get("GEMINI_API_KEY")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "GEMINI_API_KEY not found in settings".to_string())?;
    
    let google_api_key = env_obj.get("GOOGLE_API_KEY")
        .and_then(|v| v.as_str())
        .unwrap_or(gemini_api_key);
    
    // Get base URL (optional)
    let base_url = env_obj.get("GOOGLE_GEMINI_BASE_URL")
        .and_then(|v| v.as_str())
        .unwrap_or("https://generativelanguage.googleapis.com");
    
    // Get model (optional)
    let model = env_obj.get("GEMINI_MODEL")
        .and_then(|v| v.as_str())
        .unwrap_or("gemini-2.0-flash-exp");

    // Build TOML content
    let toml_content = format!(
        r#"[api]
key = "{}"
base_url = "{}"

[model]
default = "{}"

# Environment variables for compatibility
[env]
GEMINI_API_KEY = "{}"
GOOGLE_API_KEY = "{}"
GEMINI_MODEL = "{}"
GOOGLE_GEMINI_BASE_URL = "{}"
"#,
        gemini_api_key,
        base_url,
        model,
        gemini_api_key,
        google_api_key,
        model,
        base_url
    );

    // Write config to file
    fs::write(&config_path, toml_content)
        .map_err(|e| format!("Failed to write config.toml: {}", e))?;
    
    log_info(&format!("Successfully updated Gemini config.toml at: {}", config_path.display()));
    Ok(())
}

/// Switch Gemini account by updating config file with settings
#[tauri::command]
pub async fn switch_gemini_account(
    app: AppHandle,
    settings: String,
) -> Result<(), String> {
    log_info("Switching Gemini account");

    // Parse settings JSON string
    let settings_value: Value = serde_json::from_str(&settings)
        .map_err(|e| format!("Failed to parse settings JSON: {}", e))?;

    // Write config.toml with new settings
    write_gemini_config_from_settings(&app, &settings_value)?;

    log_info("Gemini account switched successfully");
    Ok(())
}

/// Get current Gemini configuration
#[tauri::command]
pub async fn get_gemini_config(app: AppHandle) -> Result<Value, String> {
    let config_path = get_gemini_config_path(&app)?;
    
    if !config_path.exists() {
        return Ok(json!({}));
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;
    
    // Simple TOML parsing for [api] and [model] sections
    let mut config = serde_json::Map::new();
    
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("key = ") {
            if let Some(value) = extract_toml_string_value(line) {
                config.insert("GEMINI_API_KEY".to_string(), json!(value));
                config.insert("GOOGLE_API_KEY".to_string(), json!(value));
            }
        } else if line.starts_with("base_url = ") {
            if let Some(value) = extract_toml_string_value(line) {
                config.insert("base_url".to_string(), json!(value));
            }
        } else if line.starts_with("default = ") {
            if let Some(value) = extract_toml_string_value(line) {
                config.insert("GEMINI_MODEL".to_string(), json!(value));
            }
        }
    }
    
    Ok(Value::Object(config))
}

/// Extract string value from TOML line (e.g., key = "value")
fn extract_toml_string_value(line: &str) -> Option<String> {
    let parts: Vec<&str> = line.splitn(2, '=').collect();
    if parts.len() == 2 {
        let value = parts[1].trim();
        // Remove quotes
        if value.starts_with('"') && value.ends_with('"') {
            return Some(value[1..value.len()-1].to_string());
        }
    }
    None
}
