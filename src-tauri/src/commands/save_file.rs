use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
pub struct SaveFileResult {
    pub saved: bool,
    pub path: Option<String>,
}

/// Open the native save dialog and write `bytes` to the chosen path.
///
/// `kind` is "pdf" or "docx" — controls the file filter and the
/// default extension on the suggested filename.
///
/// Replaces the previous `export_pdf` / `export_word` commands. Those
/// did the rendering in Rust; we now render the bytes in the
/// frontend (browser and Tauri both use the same JS code path) and
/// only need Rust to handle the OS-level save dialog + filesystem
/// write.
#[tauri::command]
pub async fn save_file(
    bytes: Vec<u8>,
    suggested_name: String,
    kind: String,
    app: AppHandle,
) -> Result<SaveFileResult, String> {
    let ext = if kind == "pdf" { "pdf" } else { "docx" };
    let filter_label = if ext == "pdf" { "PDF" } else { "Word" };

    let chosen = app
        .dialog()
        .file()
        .set_file_name(&suggested_name)
        .add_filter(filter_label, &[ext])
        .blocking_save_file();

    let Some(file_path) = chosen else {
        return Ok(SaveFileResult { saved: false, path: None });
    };

    let path: PathBuf = file_path
        .into_path()
        .map_err(|e| format!("invalid save path: {e}"))?;
    fs::write(&path, &bytes).map_err(|e| format!("写入失败: {e}"))?;
    Ok(SaveFileResult {
        saved: true,
        path: Some(path.to_string_lossy().into_owned()),
    })
}
