use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::utils::logger::{log_debug, log_info, log_warn};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlatformVersion {
    pub platform: String,
    pub installed: bool,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClaudeConfig {
    pub env: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CodexConfig {
    #[serde(flatten)]
    pub env: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeminiConfig {
    pub env: HashMap<String, String>,
}

fn get_claude_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    Ok(home.join(".claude").join("settings.json"))
}

fn get_codex_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    Ok(home.join(".codex").join("auth.json"))
}

fn get_gemini_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    Ok(home.join(".gemini").join(".env"))
}

fn backup_config(path: &PathBuf) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    let backup_path = path.with_extension("json.backup");
    fs::copy(path, &backup_path)
        .map_err(|e| format!("备份配置文件失败: {}", e))?;
    
    log_info(&format!("配置文件已备份到: {:?}", backup_path));
    Ok(())
}

#[tauri::command]
pub async fn get_claude_provider_config(_app: AppHandle) -> Result<ClaudeConfig, String> {
    log_debug("读取 Claude 配置");
    
    let config_path = get_claude_config_path()?;
    
    if !config_path.exists() {
        log_warn("Claude 配置文件不存在，返回空配置");
        return Ok(ClaudeConfig {
            env: HashMap::new(),
        });
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    
    let config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;
    
    log_info("成功读取 Claude 配置");
    Ok(config)
}

#[tauri::command]
pub async fn apply_claude_provider(
    _app: AppHandle,
    config: ClaudeConfig,
) -> Result<(), String> {
    log_info("应用 Claude Provider 配置");
    
    let config_path = get_claude_config_path()?;
    
    // 确保目录存在
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建配置目录失败: {}", e))?;
    }

    // 备份现有配置
    backup_config(&config_path)?;

    // 写入新配置
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    
    fs::write(&config_path, json)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    log_info(&format!("成功写入 Claude 配置到: {:?}", config_path));
    Ok(())
}

#[tauri::command]
pub async fn get_codex_provider_config(_app: AppHandle) -> Result<CodexConfig, String> {
    log_debug("读取 Codex 配置");
    
    let config_path = get_codex_config_path()?;
    
    if !config_path.exists() {
        log_warn("Codex 配置文件不存在，返回空配置");
        return Ok(CodexConfig {
            env: HashMap::new(),
        });
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    
    let config: CodexConfig = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;
    
    log_info("成功读取 Codex 配置");
    Ok(config)
}

#[tauri::command]
pub async fn apply_codex_provider(
    _app: AppHandle,
    config: CodexConfig,
) -> Result<(), String> {
    log_info("应用 Codex Provider 配置");
    
    let config_path = get_codex_config_path()?;
    
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建配置目录失败: {}", e))?;
    }

    backup_config(&config_path)?;

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    
    fs::write(&config_path, json)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    log_info(&format!("成功写入 Codex 配置到: {:?}", config_path));
    Ok(())
}

#[tauri::command]
pub async fn get_gemini_provider_config(_app: AppHandle) -> Result<GeminiConfig, String> {
    log_debug("读取 Gemini 配置");
    
    let config_path = get_gemini_config_path()?;
    
    if !config_path.exists() {
        log_warn("Gemini 配置文件不存在，返回空配置");
        return Ok(GeminiConfig {
            env: HashMap::new(),
        });
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    
    let mut env = HashMap::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        
        if let Some((key, value)) = line.split_once('=') {
            env.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    
    log_info("成功读取 Gemini 配置");
    Ok(GeminiConfig { env })
}

#[tauri::command]
pub async fn apply_gemini_provider(
    _app: AppHandle,
    config: GeminiConfig,
) -> Result<(), String> {
    log_info("应用 Gemini Provider 配置");
    
    let config_path = get_gemini_config_path()?;
    
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建配置目录失败: {}", e))?;
    }

    backup_config(&config_path)?;

    let mut lines = Vec::new();
    for (key, value) in &config.env {
        lines.push(format!("{}={}", key, value));
    }
    
    let content = lines.join("\n");
    fs::write(&config_path, content)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;
    
    log_info(&format!("成功写入 Gemini 配置到: {:?}", config_path));
    Ok(())
}

#[tauri::command]
pub async fn get_platform_versions(_app: AppHandle) -> Result<Vec<PlatformVersion>, String> {
    use crate::commands::{claude, codex, gemini, kiro, antigravity};
    
    log_debug("检查平台安装状态和版本");
    
    let mut versions = Vec::new();
    let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
    
    // Claude
    let claude_path = get_claude_config_path().ok();
    let claude_installed = claude_path.as_ref().map(|p| p.exists()).unwrap_or(false);
    versions.push(PlatformVersion {
        platform: "claude".to_string(),
        installed: claude_installed,
        version: if claude_installed { claude::get_claude_version() } else { None },
    });
    
    // Codex
    let codex_path = home.join(".codex");
    let codex_installed = codex_path.exists() && (
        codex_path.join("config.toml").exists() || 
        codex_path.join("auth.json").exists()
    );
    versions.push(PlatformVersion {
        platform: "codex".to_string(),
        installed: codex_installed,
        version: if codex_installed { codex::get_codex_version() } else { None },
    });
    
    // Gemini
    let gemini_path = home.join(".gemini");
    let gemini_installed = gemini_path.exists() && (
        gemini_path.join(".env").exists() || 
        gemini_path.join("config.json").exists() ||
        gemini_path.join("settings.json").exists()
    );
    versions.push(PlatformVersion {
        platform: "gemini".to_string(),
        installed: gemini_installed,
        version: if gemini_installed { gemini::get_gemini_version() } else { None },
    });
    
    // Kiro
    let kiro_path = home.join(".kiro");
    let sso_cache = home.join(".aws").join("sso").join("cache");
    let kiro_token_path = sso_cache.join("kiro-auth-token.json");
    let kiro_installed = kiro_path.exists() || kiro_token_path.exists();
    versions.push(PlatformVersion {
        platform: "kiro".to_string(),
        installed: kiro_installed,
        version: if kiro_installed { kiro::get_kiro_version() } else { None },
    });
    
    // Antigravity
    let antigravity_installed = match crate::utils::config::load_app_config() {
        Ok(config) => config.antigravity_executable.is_some(),
        Err(_) => false,
    };
    versions.push(PlatformVersion {
        platform: "antigravity".to_string(),
        installed: antigravity_installed,
        version: if antigravity_installed { antigravity::get_antigravity_version() } else { None },
    });
    
    log_info(&format!("平台版本检查完成: {:?}", versions));
    Ok(versions)
}
