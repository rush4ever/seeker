#[tauri::command]
pub async fn list_students() -> Result<Vec<String>, String> {
    Ok(vec![])
}
