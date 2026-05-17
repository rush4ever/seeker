import { describe, it, expect } from "vitest";
import {
  buildSubjectMasteryQuery,
  buildWeakPointCountQuery,
  buildWeeklyPracticeQuery,
  buildTopWeakPointsQuery,
  buildTotalQuestionsQuery,
  formatSubjectMastery,
  formatWeakPoints,
} from "./dashboardStats";

describe("buildSubjectMasteryQuery", () => {
  it("selects avg mastery grouped by subject", () => {
    const { sql, params } = buildSubjectMasteryQuery(42);
    expect(sql).toContain("SELECT subject, ROUND(AVG(mastery_score), 1)");
    expect(sql).toContain("WHERE student_id = ? AND status = 'active'");
    expect(sql).toContain("GROUP BY subject");
    expect(params).toEqual([42]);
  });
});

describe("buildWeakPointCountQuery", () => {
  it("counts weak knowledge points", () => {
    const { sql, params } = buildWeakPointCountQuery(42);
    expect(sql).toContain("COUNT(DISTINCT kn.id)");
    expect(sql).toContain("q.mastery_score < 30");
    expect(params).toEqual([42]);
  });
});

describe("buildWeeklyPracticeQuery", () => {
  it("counts sessions in last 7 days", () => {
    const { sql, params } = buildWeeklyPracticeQuery(42);
    expect(sql).toContain("created_at >= datetime('now', '-7 days')");
    expect(params).toEqual([42]);
  });
});

describe("buildTopWeakPointsQuery", () => {
  it("uses default limit of 5", () => {
    const { sql, params } = buildTopWeakPointsQuery(42);
    expect(sql).toContain("LIMIT ?");
    expect(params).toEqual([42, 5]);
  });

  it("uses custom limit", () => {
    const { sql, params } = buildTopWeakPointsQuery(42, 10);
    expect(params).toEqual([42, 10]);
  });
});

describe("buildTotalQuestionsQuery", () => {
  it("counts total and graduated questions", () => {
    const { sql, params } = buildTotalQuestionsQuery(42);
    expect(sql).toContain("COUNT(*) as total");
    expect(sql).toContain("SUM(CASE WHEN status = 'graduated' THEN 1 ELSE 0 END)");
    expect(params).toEqual([42]);
  });
});

describe("formatSubjectMastery", () => {
  it("maps subjects to labels and rounds mastery", () => {
    const input = [
      { subject: "math", avg_mastery: 67.3 },
      { subject: "physics", avg_mastery: 52.8 },
    ];
    const result = formatSubjectMastery(input);
    expect(result).toEqual([
      { subject: "math", label: "数学", avgMastery: 67 },
      { subject: "physics", label: "物理", avgMastery: 53 },
    ]);
  });

  it("uses raw subject name for unknown subjects", () => {
    const input = [{ subject: "chemistry", avg_mastery: 80.0 }];
    const result = formatSubjectMastery(input);
    expect(result[0].label).toBe("chemistry");
  });
});

describe("formatWeakPoints", () => {
  it("formats weak points with labels", () => {
    const input = [
      { name: "分式的乘除", subject: "math", avg_mastery: 35.2 },
    ];
    const result = formatWeakPoints(input);
    expect(result).toEqual([
      { name: "分式的乘除", subject: "math", subjectLabel: "数学", mastery: 35 },
    ]);
  });
});
