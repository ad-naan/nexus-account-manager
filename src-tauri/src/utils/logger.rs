//! 统一日志系统
//! 
//! 提供统一的日志输出接口，同时输出到控制台和文件

use std::fmt::Display;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use chrono::Local;

/// 日志级别
#[allow(dead_code)]
pub enum LogLevel {
    Info,
    Warn,
    Error,
    Debug,
}

/// 全局日志文件路径
static LOG_FILE_PATH: Lazy<Mutex<Option<PathBuf>>> = Lazy::new(|| Mutex::new(None));

/// 初始化日志系统
pub fn init_logger() -> Result<(), String> {
    let log_dir = get_log_dir()?;
    
    // 确保日志目录存在
    if !log_dir.exists() {
        fs::create_dir_all(&log_dir)
            .map_err(|e| format!("Failed to create log directory: {}", e))?;
    }
    
    // 日志文件路径
    let log_file = log_dir.join("app.log");
    
    // 保存到全局变量
    if let Ok(mut path) = LOG_FILE_PATH.lock() {
        *path = Some(log_file.clone());
    }
    
    // 写入启动日志
    write_to_file(&log_file, "INFO", &format!("=== Application started at {} ===", Local::now().format("%Y-%m-%d %H:%M:%S")));
    write_to_file(&log_file, "INFO", &format!("Log file: {}", log_file.display()));
    
    Ok(())
}

/// 获取日志目录
fn get_log_dir() -> Result<PathBuf, String> {
    let app_data = dirs::data_dir()
        .ok_or_else(|| "Failed to get app data directory".to_string())?;
    
    Ok(app_data.join("com.nexus.account-manager").join("logs"))
}

/// 写入日志到文件
fn write_to_file(path: &PathBuf, level: &str, message: &str) {
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
        let _ = writeln!(file, "[{}] [{}] {}", timestamp, level, message);
    }
}

/// 写入日志（同时输出到控制台和文件）
fn log_message<T: Display>(level: &str, message: T, to_stderr: bool) {
    let msg = message.to_string();
    
    // 输出到控制台
    if to_stderr {
        eprintln!("[{}] {}", level, msg);
    } else {
        println!("[{}] {}", level, msg);
    }
    
    // 输出到文件
    if let Ok(path_guard) = LOG_FILE_PATH.lock() {
        if let Some(log_file) = path_guard.as_ref() {
            write_to_file(log_file, level, &msg);
        }
    }
}

/// 输出信息日志
pub fn log_info<T: Display>(message: T) {
    log_message("INFO", message, false);
}

/// 输出警告日志
pub fn log_warn<T: Display>(message: T) {
    log_message("WARN", message, false);
}

/// 输出错误日志
pub fn log_error<T: Display>(message: T) {
    log_message("ERROR", message, true);
}

/// 输出调试日志
#[allow(dead_code)]
pub fn log_debug<T: Display>(message: T) {
    log_message("DEBUG", message, false);
}

/// 获取日志文件路径（用于前端查询）
pub fn get_log_file_path() -> Option<PathBuf> {
    LOG_FILE_PATH.lock().ok()?.clone()
}
