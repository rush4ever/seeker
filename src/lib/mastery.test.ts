import { describe, it, expect } from "vitest";
import {
  updateMastery,
  checkGraduationStatus,
  getMasteryDelta,
} from "./mastery";

describe("updateMastery", () => {
  it("increases mastery on correct answer", () => {
    expect(updateMastery(30, true)).toBe(50);
    expect(updateMastery(50, true)).toBe(70);
  });

  it("decreases mastery on wrong answer", () => {
    expect(updateMastery(50, false)).toBe(40);
    expect(updateMastery(30, false)).toBe(20);
  });

  it("caps at 100 for correct answers", () => {
    expect(updateMastery(90, true)).toBe(100);
    expect(updateMastery(100, true)).toBe(100);
  });

  it("floors at 0 for wrong answers", () => {
    expect(updateMastery(5, false)).toBe(0);
    expect(updateMastery(0, false)).toBe(0);
  });

  it("handles edge case of 0 mastery correctly", () => {
    expect(updateMastery(0, true)).toBe(20);
  });
});

describe("checkGraduationStatus", () => {
  it("returns 'graduated' for mastery >= 90", () => {
    expect(checkGraduationStatus(90)).toBe("graduated");
    expect(checkGraduationStatus(95)).toBe("graduated");
    expect(checkGraduationStatus(100)).toBe("graduated");
  });

  it("returns 'active' for mastery < 90", () => {
    expect(checkGraduationStatus(89)).toBe("active");
    expect(checkGraduationStatus(50)).toBe("active");
    expect(checkGraduationStatus(0)).toBe("active");
  });
});

describe("getMasteryDelta", () => {
  it("returns +20 for correct", () => {
    expect(getMasteryDelta(true)).toBe(20);
  });

  it("returns -10 for wrong", () => {
    expect(getMasteryDelta(false)).toBe(-10);
  });
});
