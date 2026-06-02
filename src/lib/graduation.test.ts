import { describe, it, expect } from "vitest";
import { calculateMastery, shouldGraduate, recomputeQuestionMastery } from "./graduation";

describe("calculateMastery", () => {
  it("returns 0 for no answers", () => {
    expect(calculateMastery([])).toBe(0);
  });

  it("returns 100 when all answers are correct (isCorrect=1)", () => {
    const answers = [
      { is_correct: 1 }, { is_correct: 1 }, { is_correct: 1 },
    ] as any;
    expect(calculateMastery(answers)).toBe(100);
  });

  it("treats isCorrect=2 (部分对) as 0.5 weight", () => {
    const answers = [
      { is_correct: 2 }, { is_correct: 1 },
    ] as any;
    // (0.5 + 1) / 2 = 0.75 → 75
    expect(calculateMastery(answers)).toBe(75);
  });

  it("treats isCorrect=3 (待自评) as 0", () => {
    const answers = [
      { is_correct: 3 }, { is_correct: 1 },
    ] as any;
    // (0 + 1) / 2 = 0.5 → 50
    expect(calculateMastery(answers)).toBe(50);
  });

  it("treats isCorrect=0 (错) as 0", () => {
    const answers = [
      { is_correct: 0 }, { is_correct: 1 },
    ] as any;
    expect(calculateMastery(answers)).toBe(50);
  });
});

describe("shouldGraduate", () => {
  it("returns true for mastery >= 90", () => {
    expect(shouldGraduate(90)).toBe(true);
    expect(shouldGraduate(100)).toBe(true);
  });

  it("returns false for mastery < 90", () => {
    expect(shouldGraduate(89)).toBe(false);
    expect(shouldGraduate(0)).toBe(false);
  });
});

describe("recomputeQuestionMastery", () => {
  it("returns graduated status when mastery >= 90", () => {
    const answers = [
      { is_correct: 1 }, { is_correct: 1 }, { is_correct: 1 }, { is_correct: 1 },
    ] as any;
    expect(recomputeQuestionMastery(answers)).toEqual({
      newMastery: 100,
      newStatus: "graduated",
    });
  });

  it("returns active status when mastery < 90", () => {
    const answers = [
      { is_correct: 1 }, { is_correct: 0 },
    ] as any;
    expect(recomputeQuestionMastery(answers)).toEqual({
      newMastery: 50,
      newStatus: "active",
    });
  });
});
