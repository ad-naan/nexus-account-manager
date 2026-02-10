use crate::utils::logger::{log_info, log_error, log_warn};
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::path::PathBuf;

/// Get Claude config file path
/// Can be overridden by CLAUDE_CONFIG_PATH environment variable
fn get_claude_config_path() -> Result<PathBuf, String> {
    // Check for environment variable override
    if let Ok(env_path) = env::var("CLAUDE_CONFIG_PATH") {
        log_info(&format!("Using Claude config path from environment: {}", env_path));
        return Ok(PathBuf::from(env_path));
    }
    
    // Default path
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Failed to get home directory".to_string())?;
    
    let config_path = home_dir.join(".claude").join("settings.json");
    Ok(config_path)
}

/// Switch Claude account by updating environment variables and config file
#[tauri::command]
pub async fn switch_claude_account(
    settings: Option<String>,
) -> Result<(), String> {
    log_info("Switching Claude account...");

    // Update Claude config file
    let config_path = get_claude_config_path()?;
    
    // Ensure .claude directory exists
    if let Some(parent) = config_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
            log_info(&format!("Created directory: {}", parent.display()));
        }
    }

    // Parse settings from parameter
    let config: Value = if let Some(settings_str) = settings {
        serde_json::from_str(&settings_str)
            .map_err(|e| format!("Failed to parse settings JSON: {}", e))?
    } else {
        return Err("Settings parameter is required".to_string());
    };

    // Write config to file
    let config_str = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fn write_atomic(path: &PathBuf, content: &str) -> Result<(), String> {
        let tmp = path.with_extension("tmp");
        fs::write(&tmp, content)
            .map_err(|e| format!("write tmp failed: {}", e))?;
        fs::rename(tmp, path)
            .map_err(|e| format!("rename failed: {}", e))?;
        Ok(())
    }

    log_info("Write config to file3");
    
    write_atomic(&config_path, &config_str)?;
    
    log_info(&format!("Successfully updated Claude config at: {}", config_path.display()));

    Ok(())
}

/// Get current Claude configuration
#[tauri::command]
pub async fn get_claude_config() -> Result<Value, String> {
    let config_path = get_claude_config_path()?;
    
    if !config_path.exists() {
        return Ok(json!({}));
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;
    
    let config: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))?;
    
    Ok(config)
}
