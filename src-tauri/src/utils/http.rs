//! HTTP 客户端工具
//! 
//! 提供全局单例 HTTP 客户端，支持连接池复用，提升性能

use reqwest::Client;
use std::time::Duration;
use once_cell::sync::Lazy;

/// 全局 HTTP 客户端单例（性能优化：复用连接池）
/// 
/// 特性：
/// - 超时时间：30 秒
/// - 连接池：每个主机最多保持 10 个空闲连接
/// - 空闲超时：90 秒
static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .pool_max_idle_per_host(10) // 连接池：每个主机最多保持 10 个空闲连接
        .pool_idle_timeout(Duration::from_secs(90)) // 空闲连接超时 90 秒
        .build()
        .expect("Failed to create HTTP client")
});

/// 获取全局 HTTP 客户端
/// 
/// # 示例
/// 
/// ```rust
/// use crate::utils::http::get_client;
/// 
/// async fn fetch_data() -> Result<String, String> {
///     let client = get_client();
///     let response = client.get("https://api.example.com/data")
///         .send()
///         .await
///         .map_err(|e| e.to_string())?;
///     
///     response.text().await.map_err(|e| e.to_string())
/// }
/// ```
pub fn get_client() -> &'static Client {
    &HTTP_CLIENT
}

/// 获取长超时 HTTP 客户端（兼容旧代码）
/// 
/// 注意：当前实现与 get_client() 相同，超时已设置为 30 秒
#[deprecated(since = "1.0.0", note = "请使用 get_client() 代替")]
#[allow(dead_code)]
pub fn get_long_client() -> &'static Client {
    &HTTP_CLIENT
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_singleton() {
        let client1 = get_client();
        let client2 = get_client();
        
        // 验证是同一个实例
        assert!(std::ptr::eq(client1, client2));
    }
}
