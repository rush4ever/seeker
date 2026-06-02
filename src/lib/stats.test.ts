import { describe, it, expect } from "vitest";
import {
  getWeeklySummary,
  predictExamWeakPoints,
  calculateSubjectDistribution,
} from "./stats";
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("getWeeklySummary", () => {
  it("returns zeros for empty question list", () => {
    const summary = getWeeklySummary([]);
    expect(summary.newQuestions).toBe(0);
    expect(summary.analyzedQuestions).toBe(0);
    expect(summary.weakPointCount).toBe(0);
    expect(summary.masteredPointCount).toBe(0);
  });

  it("counts questions created this week as new", () => {
    const today = new Date().toISOString();
    const old = "2024-01-01T00:00:00Z";
    const questions = [
      makeQuestion({ id: 1, created_at: today }),
      makeQuestion({ id: 2, created_at: today }),
      makeQuestion({ id: 3, created_at: old }),
    ];
    const summary = getWeeklySummary(questions);
    expect(summary.newQuestions).toBe(2);
  });

  it("counts analyzed questions (those with error_cause)", () => {
    const questions = [
      makeQuestion({ id: 1, error_cause: "concept" }),
      makeQuestion({ id: 2, error_cause: null }),
      makeQuestion({ id: 3, error_cause: "careless" }),
    ];
    const summary = getWeeklySummary(questions);
    expect(summary.analyzedQuestions).toBe(2);
  });

  it("counts weak points (mastery < 30) and mastered (>= 70)", () => {
    const questions = [
      makeQuestion({ id: 1, mastery_score: 20 }),
      makeQuestion({ id: 2, mastery_score: 50 }),
      makeQuestion({ id: 3, mastery_score: 80 }),
    ];
    const summary = getWeeklySummary(questions);
    expect(summary.weakPointCount).toBe(1);
    expect(summary.masteredPointCount).toBe(1);
  });
});

describe("predictExamWeakPoints", () => {
  it("returns empty for no questions", () => {
    const result = predictExamWeakPoints([], new Map());
    expect(result).toEqual([]);
  });

  it("ranks knowledge points by question count descending", () => {
    const q1 = makeQuestion({ id: 1, mastery_score: 20 });
    const q2 = makeQuestion({ id: 2, mastery_score: 25 });
    const q3 = makeQuestion({ id: 3, mastery_score: 80 });
    const knowledgeMap = new Map([
      [1, { name: "分式", questionIds: [1, 2] }],
      [2, { name: "函数", questionIds: [3] }],
    ]);
    const result = predictExamWeakPoints([q1, q2, q3], knowledgeMap);
    expect(result).toHaveLength(2);
    expect(result[0].knowledgeName).toBe("分式");
    expect(result[0].questionCount).toBe(2);
  });

  it("marks high risk for low mastery + high question count", () => {
    const q = makeQuestion({ mastery_score: 15 });
    const knowledgeMap = new Map([[1, { name: "薄弱点", questionIds: [1] }]]);
    const result = predictExamWeakPoints([q], knowledgeMap);
    expect(result[0].risk).toBe("high");
  });

  it("marks low risk for high mastery", () => {
    const q = makeQuestion({ mastery_score: 85 });
    const knowledgeMap = new Map([[1, { name: "掌握点", questionIds: [1] }]]);
    const result = predictExamWeakPoints([q], knowledgeMap);
    expect(result[0].risk).toBe("low");
  });
});

describe("calculateSubjectDistribution", () => {
  it("returns empty for no questions", () => {
    const result = calculateSubjectDistribution([]);
    expect(result).toEqual([]);
  });

  it("groups by subject and calculates averages", () => {
    const questions = [
      makeQuestion({ id: 1, subject: "math", mastery_score: 30 }),
      makeQuestion({ id: 2, subject: "math", mastery_score: 50 }),
      makeQuestion({ id: 3, subject: "physics", mastery_score: 70 }),
    ];
    const result = calculateSubjectDistribution(questions);
    expect(result).toHaveLength(2);

    const math = result.find((r) => r.subject === "math");
    expect(math?.count).toBe(2);
    expect(math?.avgMastery).toBe(40);

    const physics = result.find((r) => r.subject === "physics");
    expect(physics?.count).toBe(1);
    expect(physics?.avgMastery).toBe(70);
  });
});
