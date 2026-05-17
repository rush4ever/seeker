/**
 * Helpers to inject test data into the browser-mode SQLite database.
 * These functions are evaluated in the browser context.
 */

export interface TestStudent {
  id?: number;
  name: string;
  grade: number;
  semester: number;
}

export interface TestQuestion {
  id?: number;
  student_id: number;
  subject: "math" | "physics";
  content: string;
  correct_answer: string;
  error_cause?: string;
  difficulty?: string;
  mastery_score: number;
  chapter?: string;
}

/**
 * Generate a page.evaluate script to seed test data.
 */
export async function seedTestData(page: any, data: {
  students?: TestStudent[];
  questions?: TestQuestion[];
}): Promise<void> {
  await page.evaluate(async (seedData) => {
    const { getDb } = await import("/src/lib/db.ts");
    const db = await getDb();

    for (const student of seedData.students || []) {
      await db.execute(
        `INSERT INTO students (name, current_grade, current_semester, textbook_version)
         VALUES (?, ?, ?, '苏科版')`,
        [student.name, student.grade, student.semester]
      );
    }

    for (const q of seedData.questions || []) {
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type, content,
          correct_answer, error_cause, difficulty, mastery_score, chapter, status)
         VALUES (?, ?, 'manual', 'objective', ?, ?, ?, ?, ?, ?, 'active')`,
        [q.student_id, q.subject, q.content, q.correct_answer,
         q.error_cause || null, q.difficulty || null, q.mastery_score, q.chapter || null]
      );
    }
  }, data);
}

/**
 * Clear all test data.
 */
export async function clearTestData(page: any): Promise<void> {
  await page.evaluate(async () => {
    const { getDb } = await import("/src/lib/db.ts");
    const db = await getDb();
    await db.execute("DELETE FROM questions");
    await db.execute("DELETE FROM students WHERE id > 0");
    await db.execute("DELETE FROM mastery_history");
    await db.execute("DELETE FROM practice_sessions");
    await db.execute("DELETE FROM practice_answers");
    await db.execute("DELETE FROM review_schedule");
  });
}
