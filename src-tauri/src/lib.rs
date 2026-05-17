mod commands;
mod db;
mod export;
mod models;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:seeker.db", db::get_migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::student::list_students,
            commands::grading::save_answer_photo,
            commands::export::export_pdf,
            commands::export::export_word,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
