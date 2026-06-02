import { describe, it, expect } from "vitest";
import {
  buildPracticeSheet,
  formatForPrint,
  groupBySubject,
} from "./practiceSheet";
import type { Question } from "../types";

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 1,
    student_id: 1,
    subject: "math",
    source_type: "word_import",
    source_file: null,
    number_in_source: 1,
    question_type: "objective",
    chapter: "分式的乘除",
    answer_date: "2026-05-14",
    content: "计算: (a/b) * (c/d)",
    content_html: null,
    content_images: null,
    student_answer: "错误答案",
    correct_answer: "ac/bd",
    error_cause: "concept",
    difficulty: "medium",
    mastery_score: 30,
    status: "active",
    created_at: "2026-05-14T10:00:00Z",
    updated_at: "2026-05-14T10:00:00Z",
    ...overrides,
  };
}

describe("buildPracticeSheet", () => {
  it("returns empty sheet for empty question list", () => {
    const sheet = buildPracticeSheet(
      [],
      "questions_only",
      new Map()
    );
    expect(sheet.items).toHaveLength(0);
    expect(sheet.title).toBeTruthy();
    expect(sheet.mode).toBe("questions_only");
  });

  it("includes all selected questions in order", () => {
    const q1 = makeQuestion({ id: 1, content: "题1" });
    const q2 = makeQuestion({ id: 2, content: "题2" });
    const sheet = buildPracticeSheet(
      [q1, q2],
      "questions_only",
      new Map()
    );
    expect(sheet.items).toHaveLength(2);
    expect(sheet.items[0].question.id).toBe(1);
    expect(sheet.items[1].question.id).toBe(2);
  });

  it("attaches knowledge point names from the map", () => {
    const q = makeQuestion({ id: 5 });
    const knowledgeMap = new Map([[5, ["分式化简", "约分"]]]);
    const sheet = buildPracticeSheet([q], "full_analysis", knowledgeMap);
    expect(sheet.items[0].knowledgePointNames).toEqual(["分式化简", "约分"]);
  });

  it("uses empty knowledge points when not in map", () => {
    const q = makeQuestion({ id: 99 });
    const sheet = buildPracticeSheet([q], "full_analysis", new Map());
    expect(sheet.items[0].knowledgePointNames).toEqual([]);
  });

  it("preserves the specified mode", () => {
    const q = makeQuestion();
    const sheetFull = buildPracticeSheet([q], "full_analysis", new Map());
    const sheetOnly = buildPracticeSheet([q], "questions_only", new Map());
    expect(sheetFull.mode).toBe("full_analysis");
    expect(sheetOnly.mode).toBe("questions_only");
  });

  it("sets generatedAt to a valid ISO date string", () => {
    const sheet = buildPracticeSheet([], "questions_only", new Map());
    expect(new Date(sheet.generatedAt).toISOString()).toBe(sheet.generatedAt);
  });
});

describe("formatForPrint", () => {
  it("renders sheet title and student name", () => {
    const sheet = buildPracticeSheet(
      [makeQuestion({ content: "题A" })],
      "questions_only",
      new Map()
    );
    const html = formatForPrint(sheet, "邵瀚文");
    expect(html).toContain("邵瀚文");
    expect(html).toContain(sheet.title);
  });

  it("questions_only mode does not include analysis labels", () => {
    const sheet = buildPracticeSheet(
      [makeQuestion({ correct_answer: "正确答案" })],
      "questions_only",
      new Map()
    );
    const html = formatForPrint(sheet, "学生");
    // Check body content only, not CSS styles
    const bodyStart = html.indexOf("<body>");
    const bodyContent = html.slice(bodyStart);
    expect(bodyContent).not.toContain("analysis-section");
    expect(bodyContent).not.toContain("解析");
    expect(bodyContent).not.toContain("错因");
    expect(bodyContent).toContain("notes-area"); // should have note-taking area
  });

  it("full_analysis mode includes answers, error cause, and knowledge points", () => {
    const q = makeQuestion({
      correct_answer: "正确",
      error_cause: "concept",
      chapter: "分式",
    });
    const sheet = buildPracticeSheet(
      [q],
      "full_analysis",
      new Map([[1, ["分式化简"]]])
    );
    const html = formatForPrint(sheet, "学生");
    expect(html).toContain("正确");
    expect(html).toContain("概念不清");
    expect(html).toContain("分式化简");
  });

  it("renders question content for each item", () => {
    const sheet = buildPracticeSheet(
      [
        makeQuestion({ id: 1, content: "第一题" }),
        makeQuestion({ id: 2, content: "第二题" }),
      ],
      "questions_only",
      new Map()
    );
    const html = formatForPrint(sheet, "学生");
    expect(html).toContain("第一题");
    expect(html).toContain("第二题");
  });
});

describe("groupBySubject", () => {
  it("groups items by their question subject", () => {
    const mathQ = makeQuestion({ id: 1, subject: "math" });
    const physicsQ = makeQuestion({ id: 2, subject: "physics" });
    const sheet = buildPracticeSheet(
      [mathQ, physicsQ, mathQ],
      "questions_only",
      new Map()
    );
    const grouped = groupBySubject(sheet.items);
    expect(grouped.get("math")).toHaveLength(2);
    expect(grouped.get("physics")).toHaveLength(1);
  });

  it("returns empty map for empty items", () => {
    const grouped = groupBySubject([]);
    expect(grouped.size).toBe(0);
  });
});
