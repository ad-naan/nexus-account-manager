use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
use aes_gcm::aead::generic_array::GenericArray;
#[cfg(target_os = "windows")]
use aes_gcm::aead::{Aead, AeadCore, OsRng};
#[cfg(target_os = "windows")]
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
#[cfg(target_os = "windows")]
use base64::{engine::general_purpose, Engine as _};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{LocalFree, HLOCAL};
#[cfg(target_os = "windows")]
use windows::Win32::Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB};

const V10_PREFIX: &[u8] = b"v10";

fn resolve_data_root_from_state_db_path(db_path: &Path) -> Result<PathBuf, String> {
    db_path
        .parent()
        .and_then(|path| path.parent())
        .and_then(|path| path.parent())
        .map(Path::to_path_buf)
        .ok_or_else(|| {
            format!(
                "Cannot determine app data root from state database path: {}",
                db_path.display()
            )
        })
}

fn decode_buffer_data(buffer: &Value) -> Result<Vec<u8>, String> {
    let data = buffer
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| "Secret storage payload is not a Buffer".to_string())?;

    data.iter()
        .enumerate()
        .map(|(index, value)| {
            value
                .as_u64()
                .ok_or_else(|| format!("Secret storage byte at index {} is invalid", index))
                .and_then(|number| {
                    if number > 255 {
                        Err(format!(
                            "Secret storage byte at index {} is out of range",
                            index
                        ))
                    } else {
                        Ok(number as u8)
                    }
                })
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn get_local_state_path(data_root: &Path) -> PathBuf {
    data_root.join("Local State")
}

#[cfg(target_os = "windows")]
fn get_windows_encryption_key(data_root: &Path) -> Result<Vec<u8>, String> {
    let local_state_path = get_local_state_path(data_root);
    let local_state = std::fs::read_to_string(&local_state_path).map_err(|error| {
        format!(
            "Failed to read Local State '{}': {}",
            local_state_path.display(),
            error
        )
    })?;

    let parsed: Value = serde_json::from_str(&local_state)
        .map_err(|error| format!("Failed to parse Local State JSON: {}", error))?;

    let encrypted_key = parsed["os_crypt"]["encrypted_key"]
        .as_str()
        .ok_or_else(|| "Cannot find os_crypt.encrypted_key in Local State".to_string())?;

    let bytes = general_purpose::STANDARD
        .decode(encrypted_key)
        .map_err(|error| format!("Failed to decode encrypted_key: {}", error))?;

    if bytes.len() < 6 || &bytes[..5] != b"DPAPI" {
        return Err("Local State encrypted_key is not a DPAPI payload".to_string());
    }

    dpapi_decrypt(&bytes[5..])
}

#[cfg(target_os = "windows")]
fn dpapi_decrypt(encrypted: &[u8]) -> Result<Vec<u8>, String> {
    unsafe {
        let mut input = CRYPT_INTEGER_BLOB {
            cbData: encrypted.len() as u32,
            pbData: encrypted.as_ptr() as *mut u8,
        };
        let mut output = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };

        CryptUnprotectData(&mut input, None, None, None, None, 0, &mut output)
            .map_err(|_| "DPAPI CryptUnprotectData failed".to_string())?;

        let result = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(HLOCAL(output.pbData as *mut _));
        Ok(result)
    }
}

#[cfg(target_os = "windows")]
fn decrypt_windows_secret_payload(data_root: &Path, encrypted: &[u8]) -> Result<Vec<u8>, String> {
    if encrypted.len() < 31 || &encrypted[..3] != V10_PREFIX {
        return Err("Unsupported secret storage payload format".to_string());
    }

    let key = get_windows_encryption_key(data_root)?;
    let cipher = Aes256Gcm::new(GenericArray::from_slice(&key));
    let nonce = Nonce::from_slice(&encrypted[3..15]);

    cipher
        .decrypt(nonce, &encrypted[15..])
        .map_err(|error| format!("Failed to decrypt secret storage payload: {}", error))
}

#[cfg(target_os = "windows")]
fn encrypt_windows_secret_payload(data_root: &Path, plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let key = get_windows_encryption_key(data_root)?;
    let cipher = Aes256Gcm::new(GenericArray::from_slice(&key));
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|error| format!("Failed to encrypt secret storage payload: {}", error))?;

    let mut result = Vec::with_capacity(3 + 12 + ciphertext.len());
    result.extend_from_slice(V10_PREFIX);
    result.extend_from_slice(nonce.as_slice());
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

fn decode_secret_storage_value(data_root: &Path, raw_value: &str) -> Result<String, String> {
    let parsed: Value = serde_json::from_str(raw_value).unwrap_or_else(|_| Value::String(raw_value.to_string()));

    if let Some(value) = parsed.as_str() {
        return Ok(value.to_string());
    }

    if parsed.get("data").is_some() {
        let encrypted = decode_buffer_data(&parsed)?;

        #[cfg(target_os = "windows")]
        {
            let decrypted = decrypt_windows_secret_payload(data_root, &encrypted)?;
            return String::from_utf8(decrypted)
                .map_err(|error| format!("Secret storage payload is not valid UTF-8: {}", error));
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = (data_root, encrypted);
            return Err("Secret storage decoding currently supports Windows only".to_string());
        }
    }

    Ok(raw_value.to_string())
}

pub fn read_secret_storage_value_by_db_path(
    db_path: &Path,
    db_key: &str,
) -> Result<Option<String>, String> {
    if !db_path.exists() {
        return Ok(None);
    }

    let data_root = resolve_data_root_from_state_db_path(db_path)?;
    let connection = Connection::open(db_path)
        .map_err(|error| format!("Failed to open state database '{}': {}", db_path.display(), error))?;

    let raw_value: Option<String> = connection
        .query_row(
            "SELECT value FROM ItemTable WHERE key = ?1",
            params![db_key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("Failed to read secret storage key '{}': {}", db_key, error))?;

    raw_value
        .map(|value| decode_secret_storage_value(&data_root, &value))
        .transpose()
}

pub fn write_secret_storage_value_by_db_path(
    db_path: &Path,
    db_key: &str,
    plaintext: &str,
) -> Result<(), String> {
    let data_root = resolve_data_root_from_state_db_path(db_path)?;

    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Failed to create state database parent directory '{}': {}",
                parent.display(),
                error
            )
        })?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (&data_root, db_key, plaintext);
        return Err("Secret storage writing currently supports Windows only".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let encrypted = encrypt_windows_secret_payload(&data_root, plaintext.as_bytes())?;
        let buffer_json = serde_json::json!({
            "type": "Buffer",
            "data": encrypted,
        });
        let serialized = serde_json::to_string(&buffer_json)
            .map_err(|error| format!("Failed to serialize encrypted payload: {}", error))?;

        let connection = Connection::open(db_path).map_err(|error| {
            format!(
                "Failed to open state database '{}' for writing: {}",
                db_path.display(),
                error
            )
        })?;

        connection
            .execute(
                "CREATE TABLE IF NOT EXISTS ItemTable (key TEXT PRIMARY KEY, value TEXT)",
                [],
            )
            .map_err(|error| format!("Failed to initialize ItemTable: {}", error))?;

        connection
            .execute(
                "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?1, ?2)",
                params![db_key, serialized],
            )
            .map_err(|error| format!("Failed to write secret storage key '{}': {}", db_key, error))?;

        Ok(())
    }
}
