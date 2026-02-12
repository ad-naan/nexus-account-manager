//! 通用工具函数
//! 
//! 提供跨平台复用的工具函数

use uuid::Uuid;

/// 生成账号 ID
pub fn generate_account_id() -> String {
    Uuid::new_v4().to_string()
}

/// 从邮箱提取用户名
pub fn extract_username_from_email(email: &str) -> Option<String> {
    email.split('@').next().map(|s| s.to_string())
}

/// 验证 Token 格式（基础检查）
#[allow(dead_code)]
pub fn is_valid_token_format(token: &str) -> bool {
    !token.is_empty() && token.len() > 10
}

/// 计算 Token 过期时间戳（毫秒）
pub fn calculate_expiry_timestamp(expires_in_seconds: i64) -> i64 {
    chrono::Utc::now().timestamp_millis() + (expires_in_seconds * 1000)
}

/// 检查 Token 是否即将过期（默认 5 分钟内）
#[allow(dead_code)]
pub fn is_token_expiring(expiry_timestamp: i64, threshold_seconds: i64) -> bool {
    let now = chrono::Utc::now().timestamp_millis();
    let threshold_ms = threshold_seconds * 1000;
    expiry_timestamp - now < threshold_ms
}

/// 检查 Token 是否已过期
#[allow(dead_code)]
pub fn is_token_expired(expiry_timestamp: i64) -> bool {
    let now = chrono::Utc::now().timestamp_millis();
    expiry_timestamp < now
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_account_id() {
        let id1 = generate_account_id();
        let id2 = generate_account_id();
        assert_ne!(id1, id2);
        assert_eq!(id1.len(), 36); // UUID v4 format
    }

    #[test]
    fn test_extract_username() {
        assert_eq!(
            extract_username_from_email("user@example.com"),
            Some("user".to_string())
        );
        assert_eq!(extract_username_from_email("invalid"), Some("invalid".to_string()));
    }

    #[test]
    fn test_token_validation() {
        assert!(is_valid_token_format("valid_token_12345"));
        assert!(!is_valid_token_format(""));
        assert!(!is_valid_token_format("short"));
    }

    #[test]
    fn test_token_expiry() {
        let future = chrono::Utc::now().timestamp_millis() + 10000;
        let past = chrono::Utc::now().timestamp_millis() - 10000;
        
        assert!(!is_token_expired(future));
        assert!(is_token_expired(past));
        assert!(is_token_expiring(future, 20)); // 20 seconds threshold
    }
}
