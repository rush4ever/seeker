import type { Question } from "../types";

export interface KnowledgeStat {
  knowledgeId: number;
  name: string;
  avgMastery: number;
  questionCount: number;
}

export function getWeakestKnowledgePoints(
  stats: KnowledgeStat[],
  count: number
): KnowledgeStat[] {
  // Filter out unlearned (no questions) and sort by avgMastery ascending
  const learned = stats.filter((s) => s.questionCount > 0);
  const sorted = learned.sort((a, b) => a.avgMastery - b.avgMastery);
  return sorted.slice(0, count);
}

export function selectQuestionsForPractice(
  questions: Question[],
  count: number
): Question[] {
  return questions.slice(0, count);
}

export function calculateMastery(
  questionCount: number,
  avgScore: number,
  daysSinceLastWrong: number
): number {
  if (questionCount === 0) return 0;

  // Decay factor: exp(-days / 30), half-life of 30 days
  const decayFactor = Math.exp(-daysSinceLastWrong / 30);

  // Base score is the average score, decayed by time
  let score = avgScore * decayFactor;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function shouldGraduate(mastery: number): boolean {
  return mastery >= 90;
}
