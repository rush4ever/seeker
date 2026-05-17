import { describe, it, expect } from "vitest";
import {
  buildQuickPracticeTitle,
  formatWeakPointNames,
  buildQuickPracticeQuery,
} from "./quickPractice";
import type { KnowledgeStat } from "../types";

describe("buildQuickPracticeTitle", () => {
  it("returns default title when no weak points", () => {
    expect(buildQuickPracticeTitle([])).toBe("薄弱点快练");
  });

  it("uses single knowledge point name for one weak point", () => {
    const points: KnowledgeStat[] = [
      { knowledgeId: 1, name: "分式的乘除", avgMastery: 25, questionCount: 3 },
    ];
    expect(buildQuickPracticeTitle(points)).toBe("分式的乘除专项练习");
  });

  it("joins multiple names for several weak points", () => {
    const points: KnowledgeStat[] = [
      { knowledgeId: 1, name: "分式的乘除", avgMastery: 25, questionCount: 3 },
      { knowledgeId: 2, name: "分式化简", avgMastery: 30, questionCount: 2 },
    ];
    expect(buildQuickPracticeTitle(points)).toBe(
      "薄弱点快练（分式的乘除、分式化简）"
    );
  });
});

describe("formatWeakPointNames", () => {
  it("returns full names when under max length", () => {
    const points: KnowledgeStat[] = [
      { knowledgeId: 1, name: "分式", avgMastery: 25, questionCount: 1 },
    ];
    expect(formatWeakPointNames(points, 30)).toBe("分式");
  });

  it("truncates with ellipsis when over max length", () => {
    const points: KnowledgeStat[] = [
      { knowledgeId: 1, name: "分式的乘除", avgMastery: 25, questionCount: 1 },
      { knowledgeId: 2, name: "分式化简", avgMastery: 30, questionCount: 1 },
      { knowledgeId: 3, name: "约分", avgMastery: 35, questionCount: 1 },
    ];
    const result = formatWeakPointNames(points, 10);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(11);
  });
});

describe("buildQuickPracticeQuery", () => {
  it("builds correct SQL with placeholders", () => {
    const { sql, params } = buildQuickPracticeQuery([1, 2, 3], 42, 6);
    expect(sql).toContain("SELECT DISTINCT q.* FROM questions q");
    expect(sql).toContain("JOIN question_knowledge qk ON q.id = qk.question_id");
    expect(sql).toContain("q.student_id = ?");
    expect(sql).toContain("qk.knowledge_id IN (?,?,?)");
    expect(sql).toContain("ORDER BY q.mastery_score ASC");
    expect(sql).toContain("LIMIT 6");
    expect(params).toEqual([42, 1, 2, 3]);
  });

  it("uses custom limit when provided", () => {
    const { sql } = buildQuickPracticeQuery([1], 1, 10);
    expect(sql).toContain("LIMIT 10");
  });
});
