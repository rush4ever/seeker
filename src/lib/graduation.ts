export type PracticeAnswerLite = {
  is_correct: 0 | 1 | 2 | 3;
};

const WEIGHTS: Record<0 | 1 | 2 | 3, number> = {
  0: 0,
  1: 1,
  2: 0.5,
  3: 0,
};

export function calculateMastery(answers: PracticeAnswerLite[]): number {
  if (answers.length === 0) return 0;
  const sum = answers.reduce((acc, a) => acc + WEIGHTS[a.is_correct], 0);
  return Math.round((sum / answers.length) * 100);
}

export function shouldGraduate(mastery: number): boolean {
  return mastery >= 90;
}

export function recomputeQuestionMastery(answers: PracticeAnswerLite[]): {
  newMastery: number;
  newStatus: "active" | "graduated";
} {
  const newMastery = calculateMastery(answers);
  return {
    newMastery,
    newStatus: shouldGraduate(newMastery) ? "graduated" : "active",
  };
}
