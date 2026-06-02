use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct SnapshotInfo {
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
}

fn snapshots_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("seeker.db"))
}

fn timestamp() -> String {
    let now = chrono::Utc::now();
    now.format("%Y%m%d-%H%M%S").to_string()
}

fn snapshot_for_db(db: &PathBuf, suffix: &str) -> Result<SnapshotInfo, String> {
    let dir = db.parent().unwrap().join("backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let dest = dir.join(format!("snapshot-{}.db", suffix));
    fs::copy(db, &dest).map_err(|e| e.to_string())?;
    let meta = fs::metadata(&dest).map_err(|e| e.to_string())?;
    Ok(SnapshotInfo {
        path: dest.to_string_lossy().to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        size_bytes: meta.len(),
    })
}

fn cleanup_old_snapshots_inner(dir: &PathBuf, keep: usize) -> Result<usize, String> {
    let mut entries: Vec<_> = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name()
                .to_string_lossy()
                .starts_with("snapshot-")
        })
        .collect();
    entries.sort_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
    let mut deleted = 0;
    if entries.len() > keep {
        for e in &entries[..entries.len() - keep] {
            if fs::remove_file(e.path()).is_ok() {
                deleted += 1;
            }
        }
    }
    Ok(deleted)
}

#[tauri::command]
pub fn create_local_snapshot(app: AppHandle) -> Result<SnapshotInfo, String> {
    let dir = snapshots_dir(&app)?;
    let db = db_path(&app)?;
    let info = snapshot_for_db(&db, &timestamp())?;
    cleanup_old_snapshots_inner(&dir, 10)?;
    Ok(info)
}

#[tauri::command]
pub fn cleanup_old_snapshots(app: AppHandle, keep: usize) -> Result<usize, String> {
    let dir = snapshots_dir(&app)?;
    cleanup_old_snapshots_inner(&dir, keep)
}

#[tauri::command]
pub fn list_local_snapshots(app: AppHandle) -> Result<Vec<SnapshotInfo>, String> {
    let dir = snapshots_dir(&app)?;
    let mut out: Vec<SnapshotInfo> = Vec::new();
    for e in fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
    {
        let name = e.file_name().to_string_lossy().to_string();
        if !name.starts_with("snapshot-") {
            continue;
        }
        let meta = e.metadata().map_err(|e| e.to_string())?;
        let modified = meta.modified().unwrap_or(SystemTime::now());
        let dt: chrono::DateTime<chrono::Utc> = modified.into();
        out.push(SnapshotInfo {
            path: e.path().to_string_lossy().to_string(),
            created_at: dt.to_rfc3339(),
            size_bytes: meta.len(),
        });
    }
    out.sort_by(|a, b| a.created_at.cmp(&b.created_at).reverse());
    Ok(out)
}

#[tauri::command]
pub fn restore_snapshot(app: AppHandle, path: String) -> Result<(), String> {
    // Safety net: snapshot the current db before overwriting.
    let _ = create_local_snapshot(app.clone());
    let db = db_path(&app)?;
    fs::copy(&path, &db).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn backup_to_sync_folder(
    app: AppHandle,
    sync_folder: String,
) -> Result<SnapshotInfo, String> {
    fs::create_dir_all(&sync_folder).map_err(|e| e.to_string())?;
    let db = db_path(&app)?;
    let dest = PathBuf::from(&sync_folder).join(format!("seeker-{}.db", timestamp()));
    fs::copy(&db, &dest).map_err(|e| e.to_string())?;
    let meta = fs::metadata(&dest).map_err(|e| e.to_string())?;
    Ok(SnapshotInfo {
        path: dest.to_string_lossy().to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        size_bytes: meta.len(),
    })
}
