mod core;
mod commands;
mod utils;

use commands::*;
use core::Storage;
use std::sync::Mutex;
use tauri::{Manager, Emitter, menu::{Menu, MenuItem}, tray::TrayIconBuilder};
use utils::logger::{log_info, log_error};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let _ = app.emit("single-instance", args.clone());
            
            // Show window when another instance is launched
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            
            if let Some(url) = args.iter().find(|a| a.starts_with("kiro://")) {
                use tauri::Manager;
                match app.state::<core::kiro::DeepLinkState>().sender.lock() {
                    Ok(sender_guard) => {
                        if let Some(sender) = sender_guard.as_ref() {
                            let _ = sender.try_send(url.clone());
                        }
                    },
                    Err(_) => {}
                }
            }
        }))
        .setup(|app| {
            // Initialize logger first
            if let Err(e) = utils::logger::init_logger() {
                eprintln!("Failed to initialize logger: {}", e);
            }
            
            app.manage(core::StorageConfig {
                custom_path: std::sync::Mutex::new(None),
            });
            app.manage(core::kiro::DeepLinkState {
                sender: std::sync::Mutex::new(None),
            });

            // Windows Registry for Deep Link
            #[cfg(target_os = "windows")]
            {
                use winreg::enums::*;
                use winreg::RegKey;
                use std::env;

                let hkcu = RegKey::predef(HKEY_CURRENT_USER);
                let path = std::path::Path::new("Software").join("Classes").join("kiro");
                let (key, _) = hkcu.create_subkey(&path).unwrap_or((hkcu.open_subkey(&path).unwrap(), winreg::enums::RegDisposition::REG_OPENED_EXISTING_KEY));
                
                let _ = key.set_value("", &"URL:Kiro Protocol");
                let _ = key.set_value("URL Protocol", &"");
                
                let (cmd_key, _) = key.create_subkey("shell\\open\\command").unwrap();
                if let Ok(exe_path) = env::current_exe() {
                    let cmd = format!("\"{}\" \"%1\"", exe_path.to_string_lossy());
                    let _ = cmd_key.set_value("", &cmd);
                }
            }

            // Initialize storage
            let storage = Storage::load(&app.handle())
                .unwrap_or_else(|e| {
                    log_error(&format!("Failed to load storage: {}", e));
                    Storage::new()
                });
            
            app.manage(AppState {
                storage: Mutex::new(storage),
            });

            // =============================
            // Setup System Tray
            // =============================
            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Save menu item IDs
            let show_id = show_item.id().0.clone();
            let quit_id = quit_item.id().0.clone();

            // Load tray icon from app icon
            let icon = app.default_window_icon().cloned().expect("Failed to get app icon");

            // Build tray icon
            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("Nexus Account Manager")
                .on_menu_event(move |app, event| {
                    let event_id = event.id().as_ref();
                    match event_id {
                        id if id == show_id => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                log_info("Window shown from tray menu");
                            }
                        }
                        id if id == quit_id => {
                            log_info("Quit from tray menu");
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            log_info("Window shown from tray click");
                        }
                    }
                })
                .build(app)?;

            // Handle window close event - hide window and keep running in background
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        log_info("Close requested - hiding window");
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_accounts,
            add_account,
            update_account,
            delete_account,
            export_accounts,
            import_accounts,
            get_log_file_path,
            core::storage::set_storage_path,
            core::storage::get_current_storage_path,
            core::storage::select_storage_directory,
            import::import_from_db,
            machine::get_machine_id,
            machine::set_machine_id,
            machine::bind_machine_id,
            machine::unbind_machine_id,
            machine::get_machine_id_for_account,
            machine::get_all_machine_id_bindings,
            // Antigravity 命令
            antigravity::antigravity_prepare_oauth_url,
            antigravity::antigravity_complete_oauth,
            antigravity::antigravity_add_by_token,
            antigravity::antigravity_refresh_token,
            antigravity::antigravity_get_quota,
            antigravity::antigravity_scan_databases,
            antigravity::select_db_file,
            antigravity::antigravity_switch_account,
            // Kiro 命令
            kiro::kiro_start_device_auth,
            kiro::kiro_poll_token,
            kiro::kiro_check_quota,
            kiro::kiro_refresh_token,
            kiro::kiro_cancel_auth,
            kiro::kiro_import_sso_token,
            kiro::kiro_verify_credentials,
            kiro::kiro_social_login,
            kiro::switch_kiro_account,
            kiro::open_url_in_private_mode,
            // Claude 命令
            claude::switch_claude_account,
            claude::get_claude_config,
            claude::verify_claude_api_key,
            // Codex 命令
            codex::switch_codex_account,
            codex::get_codex_config,
            // Gemini 命令
            gemini::switch_gemini_account,
            gemini::get_gemini_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
