mod commands;
mod db;
mod models;

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:seeker.db", db::get_migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::student::list_students,
            commands::grading::save_answer_photo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
