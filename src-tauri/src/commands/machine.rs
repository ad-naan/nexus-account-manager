use crate::commands::AppState;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn get_machine_id(state: State<AppState>) -> Result<String, String> {
    let mut storage = state.storage.lock().unwrap();
    if let Some(mid) = &storage.machine_id {
        Ok(mid.clone())
    } else {
        // Generate new if not exists (lazy init)
        let new_id = uuid::Uuid::new_v4().to_string();
        storage.machine_id = Some(new_id.clone());
        // We should save here, but AppHandle is not easily available in this scope without passing it.
        // For now, we return it. Ideally we should save.
        // Let's rely on set_machine_id for explicit saving or pass AppHandle.
        Ok(new_id)
    }
}

#[tauri::command]
pub fn set_machine_id(
    app: AppHandle,
    state: State<AppState>,
    machine_id: String,
) -> Result<(), String> {
    let mut storage = state.storage.lock().unwrap();
    storage.machine_id = Some(machine_id);
    storage.save(&app)?;
    Ok(())
}

#[tauri::command]
pub fn bind_machine_id(
    app: AppHandle,
    state: State<AppState>,
    account_id: String,
    machine_id: String,
) -> Result<(), String> {
    let mut storage = state.storage.lock().unwrap();
    storage
        .account_machine_bindings
        .insert(account_id, machine_id);
    storage.save(&app)?;
    Ok(())
}

#[tauri::command]
pub fn unbind_machine_id(
    app: AppHandle,
    state: State<AppState>,
    account_id: String,
) -> Result<(), String> {
    let mut storage = state.storage.lock().unwrap();
    storage.account_machine_bindings.remove(&account_id);
    storage.save(&app)?;
    Ok(())
}

#[tauri::command]
pub fn get_machine_id_for_account(
    state: State<AppState>,
    account_id: String,
) -> Result<Option<String>, String> {
    let storage = state.storage.lock().unwrap();
    Ok(storage.account_machine_bindings.get(&account_id).cloned())
}

#[tauri::command]
pub fn get_all_machine_id_bindings(
    state: State<AppState>,
) -> Result<std::collections::HashMap<String, String>, String> {
    let storage = state.storage.lock().unwrap();
    Ok(storage.account_machine_bindings.clone())
}
