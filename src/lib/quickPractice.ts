import type { Question, KnowledgeStat } from "../types";

export interface QuickPracticeResult {
  questions: Question[];
  title: string;
}

/**
 * Build a descriptive title for the quick practice sheet.
 */
export function buildQuickPracticeTitle(weakPoints: KnowledgeStat[]): string {
  if (weakPoints.length === 0) return "薄弱点快练";
  if (weakPoints.length === 1) return `${weakPoints[0].name}专项练习`;
  const names = weakPoints.map((p) => p.name).join("、");
  return `薄弱点快练（${names}）`;
}

/**
 * Format weak point names for display, truncating if too long.
 */
export function formatWeakPointNames(
  weakPoints: KnowledgeStat[],
  maxLength: number = 30
): string {
  const names = weakPoints.map((p) => p.name).join("、");
  if (names.length <= maxLength) return names;
  return names.slice(0, maxLength) + "…";
}

/**
 * Build SQL query for fetching quick practice questions.
 * Returns the SQL string and parameter array.
 */
export function buildQuickPracticeQuery(
  weakIds: number[],
  studentId: number,
  limit: number = 6
): { sql: string; params: (string | number)[] } {
  const placeholders = weakIds.map(() => "?").join(",");
  const sql = `SELECT DISTINCT q.* FROM questions q
    JOIN question_knowledge qk ON q.id = qk.question_id
    WHERE q.student_id = ? AND qk.knowledge_id IN (${placeholders})
    ORDER BY q.mastery_score ASC
    LIMIT ${limit}`;
  return { sql, params: [studentId, ...weakIds] };
}
