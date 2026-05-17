export interface SubjectMastery {
  subject: string;
  label: string;
  avgMastery: number;
}

export interface WeakPoint {
  name: string;
  subject: string;
  subjectLabel: string;
  mastery: number;
}

export interface DashboardStats {
  subjectMastery: SubjectMastery[];
  weakPointCount: number;
  weeklyPracticeCount: number;
  topWeakPoints: WeakPoint[];
  totalQuestions: number;
  graduatedQuestions: number;
}

const SUBJECT_LABELS: Record<string, string> = {
  math: "数学",
  physics: "物理",
};

export function buildSubjectMasteryQuery(studentId: number): { sql: string; params: (string | number)[] } {
  return {
    sql: `SELECT subject, ROUND(AVG(mastery_score), 1) as avg_mastery
          FROM questions
          WHERE student_id = ? AND status = 'active'
          GROUP BY subject`,
    params: [studentId],
  };
}

export function buildWeakPointCountQuery(studentId: number): { sql: string; params: (string | number)[] } {
  return {
    sql: `SELECT COUNT(DISTINCT kn.id) as count
          FROM knowledge_nodes kn
          JOIN question_knowledge qk ON kn.id = qk.knowledge_id
          JOIN questions q ON qk.question_id = q.id
          WHERE q.student_id = ? AND q.mastery_score < 30 AND q.status = 'active'`,
    params: [studentId],
  };
}

export function buildWeeklyPracticeQuery(studentId: number): { sql: string; params: (string | number)[] } {
  return {
    sql: `SELECT COUNT(*) as count
          FROM practice_sessions
          WHERE student_id = ? AND created_at >= datetime('now', '-7 days')`,
    params: [studentId],
  };
}

export function buildTopWeakPointsQuery(studentId: number, limit: number = 5): { sql: string; params: (string | number)[] } {
  return {
    sql: `SELECT kn.name, kn.subject, ROUND(AVG(q.mastery_score), 1) as avg_mastery
          FROM knowledge_nodes kn
          JOIN question_knowledge qk ON kn.id = qk.knowledge_id
          JOIN questions q ON qk.question_id = q.id
          WHERE q.student_id = ? AND q.status = 'active'
            AND kn.parent_id IS NOT NULL
            AND kn.name NOT IN ('数学', '物理')
          GROUP BY kn.id
          HAVING avg_mastery < 60
          ORDER BY avg_mastery ASC
          LIMIT ?`,
    params: [studentId, limit],
  };
}

export function buildTotalQuestionsQuery(studentId: number): { sql: string; params: (string | number)[] } {
  return {
    sql: `SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'graduated' THEN 1 ELSE 0 END) as graduated
          FROM questions
          WHERE student_id = ?`,
    params: [studentId],
  };
}

export function formatSubjectMastery(rows: { subject: string; avg_mastery: number }[]): SubjectMastery[] {
  return rows.map((r) => ({
    subject: r.subject,
    label: SUBJECT_LABELS[r.subject] ?? r.subject,
    avgMastery: Math.round(r.avg_mastery),
  }));
}

export function formatWeakPoints(rows: { name: string; subject: string; avg_mastery: number }[]): WeakPoint[] {
  return rows.map((r) => ({
    name: r.name,
    subject: r.subject,
    subjectLabel: SUBJECT_LABELS[r.subject] ?? r.subject,
    mastery: Math.round(r.avg_mastery),
  }));
}
