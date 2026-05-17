use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportRequest {
    pub student_name: String,
    pub questions: Vec<ExportQuestionInput>,
    pub mode: ExportMode,
    pub title: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportMode {
    QuestionsOnly,
    FullAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportQuestionInput {
    pub id: i64,
    pub content: String,
    pub correct_answer: Option<String>,
    pub student_answer: Option<String>,
    pub error_cause: Option<String>,
    pub error_cause_label: Option<String>,
    pub difficulty: Option<String>,
    pub difficulty_label: Option<String>,
    pub chapter: Option<String>,
    pub knowledge_points: Vec<String>,
    pub question_type: String,
}
