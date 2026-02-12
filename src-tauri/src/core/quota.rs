use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::core::oauth;
use crate::utils::logger::log_error;

const QUOTA_API_URL: &str = "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels";
const CLOUD_CODE_BASE_URL: &str = "https://daily-cloudcode-pa.sandbox.googleapis.com";
const USER_AGENT: &str = "Google-Cloud-Code/1.0.0 (Antigravity)"; 

#[derive(Debug, Serialize, Deserialize)]
struct QuotaResponse {
    #[serde(default)]
    models: std::collections::HashMap<String, ModelInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ModelInfo {
    #[serde(rename = "quotaInfo")]
    quota_info: Option<QuotaInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
struct QuotaInfo {
    #[serde(rename = "remainingFraction")]
    remaining_fraction: Option<f64>,
    #[serde(rename = "resetTime")]
    reset_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LoadProjectResponse {
    #[serde(rename = "cloudaicompanionProject")]
    project_id: Option<String>,
    #[serde(rename = "currentTier")]
    current_tier: Option<Tier>,
    #[serde(rename = "paidTier")]
    paid_tier: Option<Tier>,
}

#[derive(Debug, Deserialize)]
struct Tier {
    id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuotaData {
    pub models: Vec<ModelQuota>,
    pub subscription_tier: Option<String>,
    pub is_forbidden: bool,
    pub last_updated: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelQuota {
    pub name: String,
    pub percentage: i32,
    pub reset_time: String,
}

impl QuotaData {
    pub fn new() -> Self {
        Self {
            models: Vec::new(),
            subscription_tier: None,
            is_forbidden: false,
            last_updated: chrono::Utc::now().timestamp_millis(),
        }
    }
}

pub async fn fetch_project_id(access_token: &str) -> (Option<String>, Option<String>) {
    let client = oauth::get_client();
    let meta = json!({"metadata": {"ideType": "ANTIGRAVITY"}});

    let res = client
        .post(format!("{}/v1internal:loadCodeAssist", CLOUD_CODE_BASE_URL))
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .header("User-Agent", USER_AGENT)
        .json(&meta)
        .send()
        .await;

    match res {
        Ok(res) => {
            if res.status().is_success() {
                if let Ok(data) = res.json::<LoadProjectResponse>().await {
                    let project_id = data.project_id.clone();
                    let tier = data.paid_tier.and_then(|t| t.id).or_else(|| data.current_tier.and_then(|t| t.id));
                    return (project_id, tier);
                }
            }
        }
        Err(e) => log_error(&format!("loadCodeAssist error: {}", e)),
    }
    
    (None, None)
}

pub async fn fetch_quota(access_token: &str, project_id: Option<&str>) -> Result<(QuotaData, Option<String>), String> {
    // Fetch project_id and subscription_tier if not provided
    let (final_project_id, subscription_tier) = match project_id {
        Some(p) => (p.to_string(), None),
        None => {
            let (fetched_pid, fetched_tier) = fetch_project_id(access_token).await;
            (fetched_pid.unwrap_or_else(|| "bamboo-precept-lgxtn".to_string()), fetched_tier)
        }
    };

    let client = oauth::get_client();
    let payload = json!({ "project": final_project_id });

    let response = client
        .post(QUOTA_API_URL)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", USER_AGENT)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        if response.status().as_u16() == 403 {
            let mut q = QuotaData::new();
            q.is_forbidden = true;
            q.subscription_tier = subscription_tier;
            return Ok((q, Some(final_project_id)));
        }
        return Err(format!("Quota API error: {}", response.status()));
    }

    let quota_res: QuotaResponse = response.json().await.map_err(|e| e.to_string())?;
    let mut quota_data = QuotaData::new();

    for (name, info) in quota_res.models {
        if let Some(quota_info) = info.quota_info {
            let percentage = quota_info.remaining_fraction
                .map(|f| (f * 100.0) as i32)
                .unwrap_or(0);
            
            // Filter interesting models
            if name.contains("gemini") || name.contains("claude") {
                quota_data.models.push(ModelQuota {
                    name,
                    percentage,
                    reset_time: quota_info.reset_time.unwrap_or_default(),
                });
            }
        }
    }
    
    // Set subscription tier
    quota_data.subscription_tier = subscription_tier;
    
    Ok((quota_data, Some(final_project_id)))
}
