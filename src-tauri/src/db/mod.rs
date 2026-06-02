use tauri_plugin_sql::{Migration, MigrationKind};

pub mod seed_knowledge;

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("./schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_similar_questions",
            sql: include_str!("./migrations/v2_add_similar_questions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_app_config",
            sql: include_str!("./migrations/v4_add_app_config.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_question_analysis",
            sql: include_str!("./migrations/v5_add_question_analysis.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
