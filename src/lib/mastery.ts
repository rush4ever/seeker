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

export type MasteryLevel = "weak" | "medium" | "strong";

export function getMasteryLevel(score: number): MasteryLevel {
  if (score < 30) return "weak";
  if (score < 70) return "medium";
  return "strong";
}

const TEXT_CLASSES: Record<MasteryLevel, string> = {
  weak: "text-red-500",
  medium: "text-amber-500",
  strong: "text-green-500",
};

const BG_CLASSES: Record<MasteryLevel, string> = {
  weak: "bg-red-50",
  medium: "bg-amber-50",
  strong: "bg-green-50",
};

const BAR_CLASSES: Record<MasteryLevel, string> = {
  weak: "bg-red-400",
  medium: "bg-amber-400",
  strong: "bg-green-400",
};

const HEX_COLORS: Record<MasteryLevel, string> = {
  weak: "#ef4444",
  medium: "#f59e0b",
  strong: "#22c55e",
};

const LABELS: Record<MasteryLevel, string> = {
  weak: "薄弱",
  medium: "一般",
  strong: "掌握",
};

export function masteryTextClass(score: number): string {
  return TEXT_CLASSES[getMasteryLevel(score)];
}

export function masteryBgClass(score: number): string {
  return BG_CLASSES[getMasteryLevel(score)];
}

export function masteryBarClass(score: number): string {
  return BAR_CLASSES[getMasteryLevel(score)];
}

export function masteryColorHex(score: number): string {
  return HEX_COLORS[getMasteryLevel(score)];
}

export function masteryLabel(score: number): string {
  return LABELS[getMasteryLevel(score)];
}
