import type { Question, Subject } from "../types";

export interface WeeklySummary {
  newQuestions: number;
  analyzedQuestions: number;
  weakPointCount: number;
  masteredPointCount: number;
}

export interface ExamPrediction {
  knowledgeName: string;
  questionCount: number;
  avgMastery: number;
  risk: "high" | "medium" | "low";
}

export interface SubjectDistribution {
  subject: Subject;
  count: number;
  avgMastery: number;
}

function isThisWeek(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const daysDiff = diff / (1000 * 60 * 60 * 24);
  // Consider anything within the last 7 days as "this week"
  return daysDiff >= 0 && daysDiff < 7;
}

export function getWeeklySummary(questions: Question[]): WeeklySummary {
  let newQuestions = 0;
  let analyzedQuestions = 0;
  let weakPointCount = 0;
  let masteredPointCount = 0;

  for (const q of questions) {
    if (isThisWeek(q.created_at)) {
      newQuestions++;
    }
    if (q.error_cause) {
      analyzedQuestions++;
    }
    if (q.mastery_score < 30) {
      weakPointCount++;
    } else if (q.mastery_score >= 70) {
      masteredPointCount++;
    }
  }

  return {
    newQuestions,
    analyzedQuestions,
    weakPointCount,
    masteredPointCount,
  };
}

export function predictExamWeakPoints(
  questions: Question[],
  knowledgeMap: Map<number, { name: string; questionIds: number[] }>
): ExamPrediction[] {
  if (questions.length === 0) return [];

  const result: ExamPrediction[] = [];

  for (const [, info] of knowledgeMap) {
    const relatedQuestions = questions.filter((q) =>
      info.questionIds.includes(q.id)
    );
    if (relatedQuestions.length === 0) continue;

    const avgMastery =
      relatedQuestions.reduce((sum, q) => sum + q.mastery_score, 0) /
      relatedQuestions.length;

    let risk: "high" | "medium" | "low";
    if (avgMastery < 30) {
      risk = "high";
    } else if (avgMastery < 70) {
      risk = "medium";
    } else {
      risk = "low";
    }

    result.push({
      knowledgeName: info.name,
      questionCount: relatedQuestions.length,
      avgMastery: Math.round(avgMastery),
      risk,
    });
  }

  // Sort by question count descending, then by avgMastery ascending
  return result.sort((a, b) => {
    if (b.questionCount !== a.questionCount) {
      return b.questionCount - a.questionCount;
    }
    return a.avgMastery - b.avgMastery;
  });
}

export function calculateSubjectDistribution(questions: Question[]): SubjectDistribution[] {
  if (questions.length === 0) return [];

  const groups = new Map<Subject, { count: number; totalMastery: number }>();

  for (const q of questions) {
    const existing = groups.get(q.subject);
    if (existing) {
      existing.count++;
      existing.totalMastery += q.mastery_score;
    } else {
      groups.set(q.subject, { count: 1, totalMastery: q.mastery_score });
    }
  }

  return Array.from(groups.entries()).map(([subject, data]) => ({
    subject,
    count: data.count,
    avgMastery: Math.round(data.totalMastery / data.count),
  }));
}
