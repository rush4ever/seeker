export type QuestionLite = { id: number; mastery_score: number };
export type TreeLike = {
  node: { id: number };
  children: TreeLike[];
};

/**
 * Builds the SQL + params for fetching active questions matching ANY of the
 * given knowledge IDs, ordered weakest-first and capped at `limit`.
 *
 * SQL placeholders are `?` (positional) because callers may pass the result to
 * either sql.js or tauri-plugin-sql; both accept `?`.
 */
export function buildExamPrepQuery(
  studentId: number,
  knowledgeIds: number[],
  limit = 50
): { sql: string; params: unknown[] } {
  const placeholders = knowledgeIds.map(() => "?").join(",");
  return {
    sql: `
      SELECT DISTINCT q.*
      FROM questions q
      JOIN question_knowledge qk ON q.id = qk.question_id
      WHERE q.student_id = ?
        AND q.status = 'active'
        AND qk.knowledge_id IN (${placeholders})
      ORDER BY q.mastery_score ASC
      LIMIT ?
    `,
    params: [studentId, ...knowledgeIds, limit],
  };
}

export function sortQuestionsByMastery<T extends { mastery_score: number }>(
  questions: T[],
  order: "asc" | "desc"
): T[] {
  const sorted = [...questions];
  sorted.sort((a, b) =>
    order === "asc"
      ? a.mastery_score - b.mastery_score
      : b.mastery_score - a.mastery_score
  );
  return sorted;
}

/**
 * Walks a forest of TreeLike nodes and returns the IDs of every leaf
 * (children.length === 0). Useful when a parent knowledge-point selection
 * should fan out to all the actual leaf knowledge points its questions are
 * tagged with.
 */
export function getLeafKnowledgeIds(tree: TreeLike[]): number[] {
  const out: number[] = [];
  function walk(node: TreeLike) {
    if (node.children.length === 0) {
      out.push(node.node.id);
    } else {
      node.children.forEach(walk);
    }
  }
  tree.forEach(walk);
  return out;
}
