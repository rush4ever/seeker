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

export interface KnowledgeNodeWithStats extends KnowledgeNode {
  question_count: number;
  avg_mastery: number | null;
}

export interface KnowledgeTreeNode {
  node: KnowledgeNodeWithStats;
  children: KnowledgeTreeNode[];
}

export interface SimilarQuestion {
  content: string;
  answer: string;
  explanation: string;
}

export type PracticeMode = "questions_only" | "full_analysis";
export type ExportFormat = "pdf" | "word";

export interface ExportQuestionInput {
  id: number;
  content: string;
  correct_answer: string | null;
  student_answer: string | null;
  error_cause: ErrorCause | null;
  error_cause_label: string | null;
  difficulty: Difficulty | null;
  difficulty_label: string | null;
  chapter: string | null;
  knowledge_points: string[];
  question_type: QuestionType;
}

export interface ExportRequest {
  student_name: string;
  questions: ExportQuestionInput[];
  mode: PracticeMode;
  title: string;
}

export interface GeneratedQuestion {
  content: string;
  answer: string;
  explanation: string;
  questionType: QuestionType;
}

export interface GradingResult {
  isCorrect: 0 | 1 | 2 | 3; // 0=错, 1=对, 2=部分对, 3=待自评
  explanation: string;
  scoringPoints?: string[];
}

export interface OCRResult {
  text: string;
  confidence?: number;
}

export type GradingStatus = "pending" | "uploaded" | "ocr_done" | "graded" | "confirmed";

export interface GradingItem {
  index: number;
  question: GeneratedQuestion;
  photoPath?: string;
  ocrResult?: OCRResult;
  aiResult?: GradingResult;
  finalResult?: GradingResult;
  status: GradingStatus;
}
