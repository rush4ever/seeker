import { describe, it, expect } from "vitest";
import {
  getWeakestKnowledgePoints,
  selectQuestionsForPractice,
  calculateMastery,
  shouldGraduate,
} from "./scheduler";
import type { Question } from "../types";

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 1,
    student_id: 1,
    subject: "math" as const,
    source_type: "word_import",
    source_file: null,
    number_in_source: 1,
    question_type: "objective",
    chapter: "分式",
    answer_date: "2026-05-14",
    content: "题",
    content_html: null,
    content_images: null,
    student_answer: null,
    correct_answer: "A",
    error_cause: "concept",
    difficulty: "medium",
    mastery_score: 30,
    status: "active",
    created_at: "2026-05-14T10:00:00Z",
    updated_at: "2026-05-14T10:00:00Z",
    ...overrides,
  };
}

describe("getWeakestKnowledgePoints", () => {
  it("returns empty for empty stats", () => {
    const result = getWeakestKnowledgePoints([], 3);
    expect(result).toEqual([]);
  });

  it("returns all stats when count exceeds available", () => {
    const stats = [
      { knowledgeId: 1, name: "A", avgMastery: 50, questionCount: 2 },
    ];
    const result = getWeakestKnowledgePoints(stats, 5);
    expect(result).toHaveLength(1);
  });

  it("sorts by avgMastery ascending (weakest first)", () => {
    const stats = [
      { knowledgeId: 1, name: "Strong", avgMastery: 80, questionCount: 2 },
      { knowledgeId: 2, name: "Weak", avgMastery: 20, questionCount: 2 },
      { knowledgeId: 3, name: "Medium", avgMastery: 50, questionCount: 2 },
    ];
    const result = getWeakestKnowledgePoints(stats, 3);
    expect(result[0].name).toBe("Weak");
    expect(result[1].name).toBe("Medium");
    expect(result[2].name).toBe("Strong");
  });

  it("returns exactly count items", () => {
    const stats = [
      { knowledgeId: 1, name: "A", avgMastery: 10, questionCount: 1 },
      { knowledgeId: 2, name: "B", avgMastery: 20, questionCount: 1 },
      { knowledgeId: 3, name: "C", avgMastery: 30, questionCount: 1 },
      { knowledgeId: 4, name: "D", avgMastery: 40, questionCount: 1 },
    ];
    const result = getWeakestKnowledgePoints(stats, 2);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("A");
    expect(result[1].name).toBe("B");
  });

  it("filters out unlearned stats (zero question count)", () => {
    const stats = [
      { knowledgeId: 1, name: "Learned", avgMastery: 20, questionCount: 2 },
      { knowledgeId: 2, name: "Unlearned", avgMastery: 0, questionCount: 0 },
    ];
    const result = getWeakestKnowledgePoints(stats, 3);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Learned");
  });
});

describe("selectQuestionsForPractice", () => {
  it("returns empty for empty question list", () => {
    const result = selectQuestionsForPractice([], 5);
    expect(result).toEqual([]);
  });

  it("selects questions up to the requested count", () => {
    const questions = [
      makeQuestion({ id: 1, content: "Q1" }),
      makeQuestion({ id: 2, content: "Q2" }),
      makeQuestion({ id: 3, content: "Q3" }),
    ];
    const result = selectQuestionsForPractice(questions, 2);
    expect(result).toHaveLength(2);
  });

  it("returns all questions when count exceeds available", () => {
    const questions = [makeQuestion({ id: 1, content: "Q1" })];
    const result = selectQuestionsForPractice(questions, 5);
    expect(result).toHaveLength(1);
  });
});

describe("calculateMastery", () => {
  it("returns 0 for no questions", () => {
    expect(calculateMastery(0, 0, 0)).toBe(0);
  });

  it("returns higher score for higher avg score", () => {
    const low = calculateMastery(5, 20, 10);
    const high = calculateMastery(5, 80, 10);
    expect(high).toBeGreaterThan(low);
  });

  it("applies decay for older mistakes", () => {
    const recent = calculateMastery(5, 50, 1);
    const old = calculateMastery(5, 50, 60);
    expect(recent).toBeGreaterThan(old);
  });

  it("caps at 100", () => {
    expect(calculateMastery(1, 100, 0)).toBeLessThanOrEqual(100);
  });

  it("is at least 0", () => {
    expect(calculateMastery(10, 0, 365)).toBeGreaterThanOrEqual(0);
  });
});

describe("shouldGraduate", () => {
  it("returns false for mastery below 90", () => {
    expect(shouldGraduate(89)).toBe(false);
    expect(shouldGraduate(50)).toBe(false);
    expect(shouldGraduate(0)).toBe(false);
  });

  it("returns true for mastery at or above 90", () => {
    expect(shouldGraduate(90)).toBe(true);
    expect(shouldGraduate(95)).toBe(true);
    expect(shouldGraduate(100)).toBe(true);
  });
});
