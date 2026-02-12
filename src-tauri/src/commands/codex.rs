use crate::utils::logger::log_info;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle};

fn get_codex_config_toml_path(_app: &AppHandle) -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Failed to get home directory".to_string())?;
    
    let config_path = home_dir.join(".codex").join("config.toml");
    Ok(config_path)
}

fn get_codex_auth_json_path(_app: &AppHandle) -> Result<PathBuf, String> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Failed to get home directory".to_string())?;
    
    let config_path = home_dir.join(".codex").join("auth.json");
    Ok(config_path)
}

/// Write Codex config.toml file
fn write_config_toml(_app: &AppHandle, base_url: &str) -> Result<(), String> {
    let config_path = get_codex_config_toml_path(_app)?;
    
    // Ensure config directory exists
    if let Some(parent) = config_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
            log_info(&format!("Created directory: {}", parent.display()));
        }
    }

    // Build TOML content
    let toml_content = format!("[api]\nbase_url = \"{}\"\n", base_url);

    // Write config to file
    fs::write(&config_path, toml_content)
        .map_err(|e| format!("Failed to write config.toml: {}", e))?;
    
    log_info(&format!("Successfully updated Codex config.toml at: {}", config_path.display()));
    Ok(())
}

/// Write Codex accounts.json file
fn write_accounts_json(_app: &AppHandle, api_key: &str) -> Result<(), String> {
    let config_path = get_codex_auth_json_path(_app)?;
    
    // Ensure config directory exists
    if let Some(parent) = config_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }
    }

    // Build accounts.json content
    let accounts_json = json!({
        "OPENAI_API_KEY": api_key
    });
    
    // Write config to file
    let config_str = serde_json::to_string_pretty(&accounts_json)
        .map_err(|e| format!("Failed to serialize accounts.json: {}", e))?;

    fs::write(&config_path, config_str)
        .map_err(|e| format!("Failed to write accounts.json: {}", e))?;
    
    log_info(&format!("Successfully updated Codex accounts.json at: {}", config_path.display()));
    Ok(())
}

/// Switch Codex account by updating active status and config file
#[tauri::command]
pub async fn switch_codex_account(
    app: AppHandle,
    settings: Option<String>,
) -> Result<(), String> {
    log_info("Switching Codex account...");

    // Parse settings JSON
    let settings_str = settings.ok_or_else(|| "Settings parameter is required".to_string())?;
    let settings_value: Value = serde_json::from_str(&settings_str)
        .map_err(|e| format!("Failed to parse settings JSON: {}", e))?;

    // Extract env object
    let env = settings_value.get("env")
        .and_then(|v| v.as_object())
        .ok_or_else(|| "Missing 'env' object in settings".to_string())?;

    // Extract OPENAI_API_KEY
    let api_key = env.get("OPENAI_API_KEY")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'OPENAI_API_KEY' in env".to_string())?;

    // Extract OPENAI_BASE_URL
    let base_url = env.get("OPENAI_BASE_URL")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'OPENAI_BASE_URL' in env".to_string())?;

    log_info(&format!("Updating Codex config with base_url: {}", base_url));

    // Write config.toml with base_url
    write_config_toml(&app, base_url)?;

    // Write accounts.json with api_key
    write_accounts_json(&app, api_key)?;

    log_info("Codex account switched successfully");
    Ok(())
}

/// Get current Codex configuration
#[tauri::command]
pub async fn get_codex_config(app: AppHandle) -> Result<Value, String> {
    // Try to read accounts.json first
    let accounts_path = get_codex_auth_json_path(&app)?;
    
    if accounts_path.exists() {
        let content = fs::read_to_string(&accounts_path)
            .map_err(|e| format!("Failed to read accounts.json: {}", e))?;
        
        let config: Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse accounts.json: {}", e))?;
        
        return Ok(config);
    }
    
    // Fallback to config.toml if accounts.json doesn't exist
    let toml_path = get_codex_config_toml_path(&app)?;
    
    if toml_path.exists() {
        let content = fs::read_to_string(&toml_path)
            .map_err(|e| format!("Failed to read config.toml: {}", e))?;
        
        // Simple TOML parsing for [api] section
        let mut config = serde_json::Map::new();
        
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("env_key = ") {
                if let Some(value) = extract_toml_string_value(line) {
                    config.insert("OPENAI_API_KEY".to_string(), json!(value));
                }
            } else if line.starts_with("base_url = ") {
                if let Some(value) = extract_toml_string_value(line) {
                    config.insert("base_url".to_string(), json!(value));
                }
            }
        }
        
        return Ok(Value::Object(config));
    }
    
    Ok(json!({}))
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
