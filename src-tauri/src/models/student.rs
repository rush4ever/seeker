use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Student {
    pub id: i64,
    pub name: String,
    pub current_grade: i32,
    pub current_semester: i32,
    pub textbook_version: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateStudentRequest {
    pub name: String,
    pub current_grade: i32,
    pub current_semester: i32,
    pub textbook_version: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateStudentRequest {
    pub id: i64,
    pub name: Option<String>,
    pub current_grade: Option<i32>,
    pub current_semester: Option<i32>,
    pub textbook_version: Option<String>,
}
