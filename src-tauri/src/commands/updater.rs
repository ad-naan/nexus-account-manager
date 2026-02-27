use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_notes: Option<String>,
    pub download_url: Option<String>,
}

/// 检查更新
#[tauri::command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let current_version = app.package_info().version.to_string();
    
    // 使用 Tauri 的更新插件检查更新
    #[cfg(not(debug_assertions))]
    {
        use tauri_plugin_updater::UpdaterExt;
        
        match app.updater() {
            Ok(updater) => {
                match updater.check().await {
                    Ok(Some(update)) => {
                        Ok(UpdateInfo {
                            current_version: current_version.clone(),
                            latest_version: update.version.clone(),
                            has_update: true,
                            release_notes: Some(update.body.clone().unwrap_or_default()),
                            download_url: Some(update.download_url.clone()),
                        })
                    }
                    Ok(None) => {
                        Ok(UpdateInfo {
                            current_version: current_version.clone(),
                            latest_version: current_version.clone(),
                            has_update: false,
                            release_notes: None,
                            download_url: None,
                        })
                    }
                    Err(e) => Err(format!("Failed to check for updates: {}", e)),
                }
            }
            Err(e) => Err(format!("Updater not available: {}", e)),
        }
    }
    
    // 开发模式下返回模拟数据
    #[cfg(debug_assertions)]
    {
        Ok(UpdateInfo {
            current_version: current_version.clone(),
            latest_version: current_version.clone(),
            has_update: false,
            release_notes: Some("Development mode - updates disabled".to_string()),
            download_url: None,
        })
    }
}

/// 下载并安装更新
#[tauri::command]
pub async fn download_and_install_update(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(not(debug_assertions))]
    {
        use tauri_plugin_updater::UpdaterExt;
        
        match app.updater() {
            Ok(updater) => {
                match updater.check().await {
                    Ok(Some(update)) => {
                        // 下载并安装更新
                        update
                            .download_and_install(|_chunk_length, _content_length| {
                                // 可以在这里发送进度事件
                            })
                            .await
                            .map_err(|e| format!("Failed to download and install update: {}", e))?;
                        
                        Ok(())
                    }
                    Ok(None) => Err("No update available".to_string()),
                    Err(e) => Err(format!("Failed to check for updates: {}", e)),
                }
            }
            Err(e) => Err(format!("Updater not available: {}", e)),
        }
    }
    
    #[cfg(debug_assertions)]
    {
        Err("Updates are disabled in development mode".to_string())
    }
}
