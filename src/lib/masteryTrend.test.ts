import { describe, it, expect } from "vitest";
import {
  buildMasteryTrendQuery,
  formatMasteryTrend,
  type MasteryTrendRow,
} from "./masteryTrend";

describe("buildMasteryTrendQuery", () => {
  it("selects weekly avg mastery by subject", () => {
    const { sql, params } = buildMasteryTrendQuery(42);
    expect(sql).toContain("strftime('%Y-W%W', mh.recorded_at)");
    expect(sql).toContain("kn.subject");
    expect(sql).toContain("GROUP BY week, kn.subject");
    expect(params).toEqual([42]);
  });
});

describe("formatMasteryTrend", () => {
  it("returns empty for no data", () => {
    expect(formatMasteryTrend([])).toEqual([]);
  });

  it("groups single subject by week", () => {
    const rows: MasteryTrendRow[] = [
      { week: "2026-W20", subject: "math", avg_score: 45.5 },
      { week: "2026-W21", subject: "math", avg_score: 55.0 },
    ];
    const result = formatMasteryTrend(rows);
    expect(result).toHaveLength(2);
    expect(result[0].overall).toBe(46);
    expect(result[0].math).toBe(46);
    expect(result[0].physics).toBeUndefined();
  });

  it("combines math and physics into one point per week", () => {
    const rows: MasteryTrendRow[] = [
      { week: "2026-W20", subject: "math", avg_score: 40 },
      { week: "2026-W20", subject: "physics", avg_score: 60 },
    ];
    const result = formatMasteryTrend(rows);
    expect(result).toHaveLength(1);
    expect(result[0].overall).toBe(50); // (40+60)/2
    expect(result[0].math).toBe(40);
    expect(result[0].physics).toBe(60);
  });

  it("rounds scores to integers", () => {
    const rows: MasteryTrendRow[] = [
      { week: "2026-W20", subject: "math", avg_score: 33.7 },
    ];
    const result = formatMasteryTrend(rows);
    expect(result[0].overall).toBe(34);
    expect(result[0].math).toBe(34);
  });
});
