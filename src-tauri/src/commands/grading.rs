use std::fs;
use tauri::Manager;

#[tauri::command]
pub async fn save_answer_photo(
    app_handle: tauri::AppHandle,
    student_id: i64,
    session_id: i64,
    question_index: i64,
    base64_image: String,
) -> Result<String, String> {
    // Remove data URL prefix if present
    let image_data = base64_image
        .strip_prefix("data:image/jpeg;base64,")
        .or_else(|| base64_image.strip_prefix("data:image/png;base64,"))
        .or_else(|| base64_image.strip_prefix("data:image/jpg;base64,"))
        .unwrap_or(&base64_image);

    let decoded = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        image_data,
    )
    .map_err(|e| format!("Base64 decode error: {}", e))?;

    // Build path: app_data/answers/{student_id}/{session_id}/{question_index}.jpg
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {}", e))?;

    let dir = app_data_dir
        .join("answers")
        .join(student_id.to_string())
        .join(session_id.to_string());

    fs::create_dir_all(&dir).map_err(|e| format!("Create dir error: {}", e))?;

    let file_path = dir.join(format!("{}.jpg", question_index));
    fs::write(&file_path, decoded).map_err(|e| format!("Write file error: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}
