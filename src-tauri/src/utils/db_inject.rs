//! Antigravity IDE 数据库 Token 注入
//! 
//! 将账号的 Token 注入到 Antigravity IDE 的 state.vscdb 数据库中

use rusqlite::Connection;
use base64::{engine::general_purpose, Engine as _};
use std::path::PathBuf;
use crate::utils::logger::log_info;

/// 获取 Antigravity IDE 数据库路径
pub fn get_db_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")
            .map_err(|_| "APPDATA environment variable not found".to_string())?;
        let db_path = PathBuf::from(appdata)
            .join("Antigravity")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb");
        
        if !db_path.exists() {
            return Err(format!("Database not found at: {}", db_path.display()));
        }
        
        Ok(db_path)
    }
    
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME")
            .map_err(|_| "HOME environment variable not found".to_string())?;
        let db_path = PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("Antigravity")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb");
        
        if !db_path.exists() {
            return Err(format!("Database not found at: {}", db_path.display()));
        }
        
        Ok(db_path)
    }
    
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME")
            .map_err(|_| "HOME environment variable not found".to_string())?;
        let db_path = PathBuf::from(home)
            .join(".config")
            .join("Antigravity")
            .join("User")
            .join("globalStorage")
            .join("state.vscdb");
        
        if !db_path.exists() {
            return Err(format!("Database not found at: {}", db_path.display()));
        }
        
        Ok(db_path)
    }
}

/// 注入 Token 到数据库
/// 
/// 参数：
/// - db_path: 数据库文件路径
/// - access_token: 访问令牌
/// - refresh_token: 刷新令牌
/// - expiry_timestamp: 过期时间戳（毫秒）
/// - email: 用户邮箱
pub fn inject_token(
    db_path: &PathBuf,
    access_token: &str,
    refresh_token: &str,
    expiry_timestamp: i64,
    email: &str,
) -> Result<(), String> {
    log_info(&format!("Injecting token for: {}", email));
    
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    // 尝试旧格式注入（兼容性最好）
    let old_format_result = inject_old_format(
        &conn,
        access_token,
        refresh_token,
        expiry_timestamp,
        email,
    );
    
    // 如果旧格式失败，尝试新格式
    if old_format_result.is_err() {
        log_info("Old format failed, trying new format");
        inject_new_format(&conn, access_token, refresh_token, expiry_timestamp)?;
    }
    
    // 注入 Onboarding 标志
    conn.execute(
        "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)",
        ["antigravityOnboarding", "true"],
    )
    .map_err(|e| format!("Failed to write onboarding flag: {}", e))?;
    
    log_info("Token injected successfully");
    Ok(())
}

/// 旧格式注入（< 1.16.5）
fn inject_old_format(
    conn: &Connection,
    access_token: &str,
    refresh_token: &str,
    expiry: i64,
    email: &str,
) -> Result<(), String> {
    use rusqlite::Error as SqliteError;
    
    // 读取当前数据
    let current_data: String = conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = ?",
            ["jetskiStateSync.agentManagerInitState"],
            |row| row.get(0),
        )
        .map_err(|e| match e {
            SqliteError::QueryReturnedNoRows => {
                "Old format key does not exist".to_string()
            }
            _ => format!("Failed to read data: {}", e),
        })?;
    
    // Base64 解码
    let blob = general_purpose::STANDARD
        .decode(&current_data)
        .map_err(|e| format!("Base64 decoding failed: {}", e))?;
    
    // 移除旧字段
    let mut clean_data = remove_field(&blob, 1)?; // UserID
    clean_data = remove_field(&clean_data, 2)?;   // Email
    clean_data = remove_field(&clean_data, 6)?;   // OAuthTokenInfo
    
    // 创建新字段
    let new_email_field = create_email_field(email);
    let new_oauth_field = create_oauth_field(access_token, refresh_token, expiry);
    
    // 合并数据
    let final_data = [clean_data, new_email_field, new_oauth_field].concat();
    let final_b64 = general_purpose::STANDARD.encode(&final_data);
    
    // 写入数据库
    conn.execute(
        "UPDATE ItemTable SET value = ? WHERE key = ?",
        [&final_b64, "jetskiStateSync.agentManagerInitState"],
    )
    .map_err(|e| format!("Failed to write data: {}", e))?;
    
    log_info("Old format injection successful");
    Ok(())
}

/// 新格式注入（>= 1.16.5）
fn inject_new_format(
    conn: &Connection,
    access_token: &str,
    refresh_token: &str,
    expiry: i64,
) -> Result<(), String> {
    // 创建 OAuthTokenInfo（二进制）
    let oauth_info = create_oauth_info(access_token, refresh_token, expiry);
    let oauth_info_b64 = general_purpose::STANDARD.encode(&oauth_info);
    
    // InnerMessage2: field 1 = base64(oauth_info)
    let inner2 = encode_string_field(1, &oauth_info_b64);
    
    // InnerMessage: field 1 = sentinel key, field 2 = inner2
    let inner1 = encode_string_field(1, "oauthTokenInfoSentinelKey");
    let inner = [inner1, encode_len_delim_field(2, &inner2)].concat();
    
    // OuterMessage: field 1 = inner
    let outer = encode_len_delim_field(1, &inner);
    let outer_b64 = general_purpose::STANDARD.encode(&outer);
    
    conn.execute(
        "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)",
        ["antigravityUnifiedStateSync.oauthToken", &outer_b64],
    )
    .map_err(|e| format!("Failed to write new format: {}", e))?;
    
    log_info("New format injection successful");
    Ok(())
}

// ============================================================================
// Protobuf 编码工具函数
// ============================================================================

/// 编码 Protobuf Varint
fn encode_varint(mut value: u64) -> Vec<u8> {
    let mut buf = Vec::new();
    while value >= 0x80 {
        buf.push((value & 0x7F | 0x80) as u8);
        value >>= 7;
    }
    buf.push(value as u8);
    buf
}

/// 读取 Protobuf Varint
fn read_varint(data: &[u8], offset: usize) -> Result<(u64, usize), String> {
    let mut result = 0u64;
    let mut shift = 0;
    let mut pos = offset;

    loop {
        if pos >= data.len() {
            return Err("incomplete_data".to_string());
        }
        let byte = data[pos];
        result |= ((byte & 0x7F) as u64) << shift;
        pos += 1;
        if byte & 0x80 == 0 {
            break;
        }
        shift += 7;
    }

    Ok((result, pos))
}

/// 跳过 Protobuf 字段
fn skip_field(data: &[u8], offset: usize, wire_type: u8) -> Result<usize, String> {
    match wire_type {
        0 => {
            // Varint
            let (_, new_offset) = read_varint(data, offset)?;
            Ok(new_offset)
        }
        1 => {
            // 64-bit
            Ok(offset + 8)
        }
        2 => {
            // Length-delimited
            let (length, content_offset) = read_varint(data, offset)?;
            Ok(content_offset + length as usize)
        }
        5 => {
            // 32-bit
            Ok(offset + 4)
        }
        _ => Err(format!("unknown_wire_type: {}", wire_type)),
    }
}

/// 移除指定的 Protobuf 字段
fn remove_field(data: &[u8], field_num: u32) -> Result<Vec<u8>, String> {
    let mut result = Vec::new();
    let mut offset = 0;

    while offset < data.len() {
        let start_offset = offset;
        let (tag, new_offset) = read_varint(data, offset)?;
        let wire_type = (tag & 7) as u8;
        let current_field = (tag >> 3) as u32;

        if current_field == field_num {
            // 跳过此字段
            offset = skip_field(data, new_offset, wire_type)?;
        } else {
            // 保留其他字段
            let next_offset = skip_field(data, new_offset, wire_type)?;
            result.extend_from_slice(&data[start_offset..next_offset]);
            offset = next_offset;
        }
    }

    Ok(result)
}

/// 创建 OAuthTokenInfo（Field 6）
/// 
/// 结构：
/// message OAuthTokenInfo {
///     optional string access_token = 1;
///     optional string token_type = 2;
///     optional string refresh_token = 3;
///     optional Timestamp expiry = 4;
/// }
fn create_oauth_field(access_token: &str, refresh_token: &str, expiry: i64) -> Vec<u8> {
    // Field 1: access_token
    let field1 = encode_string_field(1, access_token);
    
    // Field 2: token_type = "Bearer"
    let field2 = encode_string_field(2, "Bearer");
    
    // Field 3: refresh_token
    let field3 = encode_string_field(3, refresh_token);
    
    // Field 4: expiry（嵌套的 Timestamp 消息）
    let timestamp_tag = (1 << 3) | 0;
    let mut timestamp_msg = encode_varint(timestamp_tag);
    timestamp_msg.extend(encode_varint(expiry as u64));
    let field4 = encode_len_delim_field(4, &timestamp_msg);
    
    // 合并所有字段为 OAuthTokenInfo 消息
    let oauth_info = [field1, field2, field3, field4].concat();

    // 包装为 Field 6（length-delimited）
    let tag6 = (6 << 3) | 2;
    let mut field6 = encode_varint(tag6);
    field6.extend(encode_varint(oauth_info.len() as u64));
    field6.extend(oauth_info);

    field6
}

/// 创建 Email（Field 2）
fn create_email_field(email: &str) -> Vec<u8> {
    encode_string_field(2, email)
}

/// 编码长度分隔字段（wire_type = 2）
fn encode_len_delim_field(field_num: u32, data: &[u8]) -> Vec<u8> {
    let tag = (field_num << 3) | 2;
    let mut f = encode_varint(tag as u64);
    f.extend(encode_varint(data.len() as u64));
    f.extend_from_slice(data);
    f
}

/// 编码字符串字段（wire_type = 2）
fn encode_string_field(field_num: u32, value: &str) -> Vec<u8> {
    encode_len_delim_field(field_num, value.as_bytes())
}

/// 创建 OAuthTokenInfo 消息（不包含 Field 6 包装，用于新格式）
fn create_oauth_info(access_token: &str, refresh_token: &str, expiry: i64) -> Vec<u8> {
    // Field 1: access_token
    let field1 = encode_string_field(1, access_token);
    
    // Field 2: token_type = "Bearer"
    let field2 = encode_string_field(2, "Bearer");
    
    // Field 3: refresh_token
    let field3 = encode_string_field(3, refresh_token);
    
    // Field 4: expiry（嵌套的 Timestamp 消息）
    let timestamp_tag = (1 << 3) | 0;
    let mut timestamp_msg = encode_varint(timestamp_tag);
    timestamp_msg.extend(encode_varint(expiry as u64));
    let field4 = encode_len_delim_field(4, &timestamp_msg);
    
    // 合并所有字段为 OAuthTokenInfo 消息
    [field1, field2, field3, field4].concat()
}
