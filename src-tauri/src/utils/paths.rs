/// 路径工具
///
/// 提供跨平台的路径查找和管理功能
use std::path::PathBuf;

/// 获取 IDE 数据库路径列表
///
/// 返回所有可能的 VSCode/Cursor/VSCodium/Antigravity 数据库路径
pub fn get_ide_database_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // Windows - LOCALAPPDATA
        if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
            paths.extend(vec![
                PathBuf::from(&local_appdata)
                    .join("Programs")
                    .join("Microsoft VS Code")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
                PathBuf::from(&local_appdata)
                    .join("Programs")
                    .join("Cursor")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
                PathBuf::from(&local_appdata)
                    .join("Programs")
                    .join("VSCodium")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
            ]);
        }

        // Windows - APPDATA (Antigravity 和其他 IDE 使用这个路径)
        if let Ok(appdata) = std::env::var("APPDATA") {
            paths.extend(vec![
                // Antigravity IDE - 重要！
                PathBuf::from(&appdata)
                    .join("Antigravity")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
                // VSCode 系列
                PathBuf::from(&appdata)
                    .join("Code")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
                PathBuf::from(&appdata)
                    .join("Cursor")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
                PathBuf::from(&appdata)
                    .join("VSCodium")
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb"),
            ]);
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS
        if let Ok(home) = std::env::var("HOME") {
            paths.extend(vec![
                PathBuf::from(&home)
                    .join("Library/Application Support/Antigravity/User/globalStorage/state.vscdb"),
                PathBuf::from(&home)
                    .join("Library/Application Support/Code/User/globalStorage/state.vscdb"),
                PathBuf::from(&home)
                    .join("Library/Application Support/Cursor/User/globalStorage/state.vscdb"),
                PathBuf::from(&home)
                    .join("Library/Application Support/VSCodium/User/globalStorage/state.vscdb"),
            ]);
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux
        if let Ok(home) = std::env::var("HOME") {
            paths.extend(vec![
                PathBuf::from(&home).join(".config/Antigravity/User/globalStorage/state.vscdb"),
                PathBuf::from(&home).join(".config/Code/User/globalStorage/state.vscdb"),
                PathBuf::from(&home).join(".config/Cursor/User/globalStorage/state.vscdb"),
                PathBuf::from(&home).join(".config/VSCodium/User/globalStorage/state.vscdb"),
            ]);
        }
    }

    paths
}
