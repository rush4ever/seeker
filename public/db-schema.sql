-- All tables for the wrong question analysis system

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  current_grade INTEGER NOT NULL DEFAULT 8,
  current_semester INTEGER NOT NULL DEFAULT 2,
  textbook_version TEXT NOT NULL DEFAULT '苏科版',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL CHECK (subject IN ('math', 'physics')),
  grade INTEGER NOT NULL,
  semester INTEGER NOT NULL,
  chapter TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES knowledge_nodes(id),
  is_preset INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK (subject IN ('math', 'physics')),
  source_type TEXT NOT NULL CHECK (source_type IN ('word_import', 'manual')),
  source_file TEXT,
  number_in_source INTEGER,
  question_type TEXT NOT NULL CHECK (question_type IN ('objective', 'subjective')),
  chapter TEXT,
  answer_date TEXT,
  content TEXT NOT NULL,
  content_html TEXT,
  content_images TEXT,
  student_answer TEXT,
  correct_answer TEXT,
  error_cause TEXT CHECK (error_cause IN ('concept', 'calculation', 'careless', 'misread', 'unknown')),
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  mastery_score REAL NOT NULL DEFAULT 0 CHECK (mastery_score >= 0 AND mastery_score <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS question_knowledge (
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  knowledge_id INTEGER NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1.0),
  PRIMARY KEY (question_id, knowledge_id)
);

CREATE TABLE IF NOT EXISTS mastery_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  knowledge_id INTEGER NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('daily', 'exam_prep', 'ad_hoc')),
  target_knowledge_ids TEXT,
  generated_questions TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS practice_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  generated_question_index INTEGER,
  answer_image_path TEXT,
  ocr_result TEXT,
  is_correct INTEGER CHECK (is_correct IN (0, 1, 2, 3)),
  self_assessment TEXT,
  graded_at TEXT
);

CREATE TABLE IF NOT EXISTS review_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  scheduled_at TEXT NOT NULL,
  completed_at TEXT,
  priority REAL NOT NULL DEFAULT 0
);

-- Migration: add content_html if not exists (safe to re-run)
ALTER TABLE questions ADD COLUMN content_html TEXT;

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_questions_student ON questions(student_id);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
CREATE INDEX IF NOT EXISTS idx_mastery_history_student ON mastery_history(student_id);
CREATE INDEX IF NOT EXISTS idx_review_schedule_student ON review_schedule(student_id);
