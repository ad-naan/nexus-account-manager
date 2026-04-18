use rusqlite::Connection;
use std::path::Path;
use tauri::command;

#[derive(serde::Serialize)]
pub struct ImportedToken {
    pub source: String,
    pub token: String,
}

#[command]
pub fn import_from_db(path: String) -> Result<Vec<ImportedToken>, String> {
    let db_path = Path::new(&path);
    if !db_path.exists() {
        return Err("Database file not found".to_string());
    }

    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM ItemTable WHERE key LIKE '%token%' OR key LIKE '%auth%'")
        .map_err(|e| e.to_string())?;

    let token_iter = stmt
        .query_map([], |row| {
            let key: String = row.get(0)?;
            let value: String = row.get(1)?;
            Ok((key, value))
        })
        .map_err(|e| e.to_string())?;

    let mut tokens = Vec::new();
    for token in token_iter {
        if let Ok((key, value)) = token {
            // Simple heuristic to filter potential tokens
            if value.len() > 20 && (value.starts_with("1//") || value.contains("ey")) {
                tokens.push(ImportedToken {
                    source: key,
                    token: value,
                });
            }
        }
    }

    Ok(tokens)
}
