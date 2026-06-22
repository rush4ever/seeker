import { useState, useEffect, useCallback } from "react";
import type { Student, CreateStudentRequest, UpdateStudentRequest } from "../types";
import { getDb } from "../lib/db";

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDb();
      const data = await db.select<Student[]>(
        "SELECT * FROM students ORDER BY created_at DESC"
      );
      setStudents(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (req: CreateStudentRequest): Promise<Student> => {
    const db = await getDb();
    const result = await db.execute(
      "INSERT INTO students (name, current_grade, current_semester, textbook_version) VALUES ($1, $2, $3, $4)",
      [req.name, req.current_grade, req.current_semester, req.textbook_version]
    );
    const newStudent: Student = {
      id: result.lastInsertId ?? 0,
      name: req.name,
      current_grade: req.current_grade,
      current_semester: req.current_semester,
      textbook_version: req.textbook_version,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await refresh();
    return newStudent;
  }, [refresh]);

  const update = useCallback(async (req: UpdateStudentRequest) => {
    const db = await getDb();
    const fields: string[] = [];
    const values: unknown[] = [];
    if (req.name) { fields.push("name = $" + (fields.length + 1)); values.push(req.name); }
    if (req.current_grade) { fields.push("current_grade = $" + (fields.length + 1)); values.push(req.current_grade); }
    if (req.current_semester) { fields.push("current_semester = $" + (fields.length + 1)); values.push(req.current_semester); }
    if (req.textbook_version) { fields.push("textbook_version = $" + (fields.length + 1)); values.push(req.textbook_version); }
    if (fields.length === 0) return;
    fields.push("updated_at = datetime('now')");
    values.push(req.id);
    await db.execute(
      `UPDATE students SET ${fields.join(", ")} WHERE id = $${fields.length}`,
      values
    );
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: number) => {
    const db = await getDb();
    await db.execute("DELETE FROM students WHERE id = $1", [id]);
    await refresh();
  }, [refresh]);

  return { students, loading, error, refresh, add, update, remove };
}
