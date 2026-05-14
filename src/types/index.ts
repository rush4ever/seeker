export interface Student {
  id: number;
  name: string;
  current_grade: number;
  current_semester: number;
  textbook_version: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStudentRequest {
  name: string;
  current_grade: number;
  current_semester: number;
  textbook_version: string;
}

export interface UpdateStudentRequest {
  id: number;
  name?: string;
  current_grade?: number;
  current_semester?: number;
  textbook_version?: string;
}

export type RoleMode = "student" | "parent";

export type QuestionType = "objective" | "subjective";
export type Subject = "math" | "physics";
export type ErrorCause = "concept" | "calculation" | "careless" | "misread" | "unknown";
export type Difficulty = "easy" | "medium" | "hard";
export type QuestionStatus = "active" | "graduated" | "archived";

export interface Question {
  id: number;
  student_id: number;
  subject: Subject;
  source_type: "word_import" | "manual";
  source_file: string | null;
  number_in_source: number | null;
  question_type: QuestionType;
  chapter: string | null;
  answer_date: string | null;
  content: string;
  content_images: string | null;
  student_answer: string | null;
  correct_answer: string | null;
  error_cause: ErrorCause | null;
  difficulty: Difficulty | null;
  mastery_score: number;
  status: QuestionStatus;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeNode {
  id: number;
  subject: Subject;
  grade: number;
  semester: number;
  chapter: string;
  name: string;
  parent_id: number | null;
  is_preset: number;
  description: string | null;
}
