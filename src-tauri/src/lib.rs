mod commands;
mod db;
mod models;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:seeker.db", db::get_migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::student::list_students,
            commands::grading::save_answer_photo,
            commands::grading::save_uploaded_photo,
            commands::save_file::save_file,
            commands::backup::create_local_snapshot,
            commands::backup::list_local_snapshots,
            commands::backup::restore_snapshot,
            commands::backup::cleanup_old_snapshots,
            commands::backup::backup_to_sync_folder,
            commands::parse_document::parse_document,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let _ = commands::backup::create_local_snapshot(window.app_handle().clone());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
