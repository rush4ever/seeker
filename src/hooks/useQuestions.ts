import { useState, useEffect, useCallback } from "react";
import type { Question } from "../types";
import { getDb } from "../lib/db";

export function useQuestions(studentId?: number) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const db = await getDb();
      const data = await db.select<Question[]>(
        "SELECT * FROM questions WHERE student_id = $1 ORDER BY created_at DESC",
        [studentId]
      );
      setQuestions(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addQuestions = useCallback(
    async (newQuestions: Omit<Question, "id" | "created_at" | "updated_at">[]) => {
      const db = await getDb();
      for (const q of newQuestions) {
        await db.execute(
          `INSERT INTO questions (
            student_id, subject, source_type, source_file, number_in_source,
            question_type, chapter, answer_date, content, content_html, content_html_original, content_images,
            correct_answer, error_cause, difficulty, mastery_score, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            q.student_id,
            q.subject,
            q.source_type,
            q.source_file,
            q.number_in_source,
            q.question_type,
            q.chapter,
            q.answer_date,
            q.content,
            q.content_html ?? null,
            q.content_html_original ?? null,
            q.content_images,
            q.correct_answer,
            q.error_cause,
            q.difficulty,
            q.mastery_score ?? 0,
            q.status ?? "active",
          ]
        );
      }
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: number) => {
      const db = await getDb();
      await db.execute("DELETE FROM questions WHERE id = $1", [id]);
      await refresh();
    },
    [refresh]
  );

  return { questions, loading, error, refresh, addQuestions, remove };
}
