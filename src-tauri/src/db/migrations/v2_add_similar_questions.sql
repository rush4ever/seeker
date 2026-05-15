-- Add similar_questions JSON field to questions table
ALTER TABLE questions ADD COLUMN similar_questions TEXT;
