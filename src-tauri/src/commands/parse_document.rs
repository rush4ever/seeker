use serde::{Deserialize, Serialize};
use std::process::Command;

/// Result from parsing a document through MinerU.
#[derive(Debug, Serialize, Deserialize)]
pub struct ParseDocumentResult {
    pub markdown: String,
    pub title: String,
    pub question_count: usize,
}

/// Error response.
#[derive(Debug, Serialize, Deserialize)]
pub struct ParseError {
    pub message: String,
}

/// Parse a PDF or DOCX file using the MinerU CLI wrapper.
///
/// The Rust command calls `scripts/mineru_parse.py <file>` which
/// runs MinerU and outputs a JSON meta line followed by the markdown.
#[tauri::command]
pub fn parse_document(file_path: &str) -> Result<ParseDocumentResult, String> {
    let script_path = get_script_path();

    let output = Command::new("python3")
        .arg(&script_path)
        .arg(file_path)
        .output()
        .map_err(|e| format!("Failed to run MinerU: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("MinerU failed: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let (meta_line, rest) = stdout.split_once('\n').unwrap_or((&stdout, ""));

    // Parse the JSON meta line
    #[derive(Deserialize)]
    struct Meta {
        status: String,
        #[allow(dead_code)]
        output_dir: Option<String>,
        #[allow(dead_code)]
        markdown_path: Option<String>,
        #[allow(dead_code)]
        size_bytes: Option<usize>,
        message: Option<String>,
    }

    let meta: Meta =
        serde_json::from_str(meta_line).map_err(|e| format!("Failed to parse MinerU output: {}", e))?;

    if meta.status != "ok" {
        return Err(meta.message.unwrap_or_else(|| "Unknown error".to_string()));
    }

    let markdown = rest.trim().to_string();
    let title = markdown
        .lines()
        .next()
        .and_then(|l| l.strip_prefix("# "))
        .unwrap_or("")
        .to_string();

    // Count questions by looking for ## 原错题 markers
    let question_count = markdown
        .lines()
        .filter(|l| l.contains("原错题") && l.contains("题目来源"))
        .count();

    Ok(ParseDocumentResult {
        markdown,
        title,
        question_count,
    })
}

/// Resolve the path to the Python wrapper script.
/// In development, it's relative to the project root.
fn get_script_path() -> String {
    // Try relative to CARGO_MANIFEST_DIR first (for Tauri builds)
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let path = format!("{}/../scripts/mineru_parse.py", manifest_dir);
        if std::path::Path::new(&path).exists() {
            return path;
        }
    }
    // Fallback: relative to current directory
    "scripts/mineru_parse.py".to_string()
}
