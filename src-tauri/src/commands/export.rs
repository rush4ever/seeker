use std::path::Path;

use crate::export::*;
use crate::export::pdf::generate_pdf;
use crate::export::word::generate_word;

#[tauri::command]
pub async fn export_pdf(
    request: ExportRequest,
    path: String,
) -> Result<(), String> {
    let output_path = Path::new(&path);
    generate_pdf(&request, output_path)?;
    Ok(())
}

#[tauri::command]
pub async fn export_word(
    request: ExportRequest,
    path: String,
) -> Result<(), String> {
    let output_path = Path::new(&path);
    generate_word(&request, output_path)?;
    Ok(())
}
