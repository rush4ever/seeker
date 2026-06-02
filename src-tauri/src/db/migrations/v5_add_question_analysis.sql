-- Store structured AI analysis on each question.
ALTER TABLE questions ADD COLUMN solution_approach TEXT;
ALTER TABLE questions ADD COLUMN solution_steps TEXT;
