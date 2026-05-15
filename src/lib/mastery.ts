export function updateMastery(currentMastery: number, isCorrect: boolean): number {
  const delta = getMasteryDelta(isCorrect);
  return Math.max(0, Math.min(100, currentMastery + delta));
}

export function checkGraduationStatus(mastery: number): "graduated" | "active" {
  return mastery >= 90 ? "graduated" : "active";
}

export function getMasteryDelta(isCorrect: boolean): number {
  return isCorrect ? 20 : -10;
}
