import { describe, it, expect } from "vitest";
import {
  buildExamPrepQuery,
  sortQuestionsByMastery,
  getLeafKnowledgeIds,
} from "./examPrep";

describe("buildExamPrepQuery", () => {
  it("uses IN clause for multiple knowledge ids", () => {
    const { sql, params } = buildExamPrepQuery(42, [1, 2, 3]);
    expect(sql).toContain("WHERE q.student_id = ?");
    expect(sql).toContain("AND qk.knowledge_id IN (?,?,?)");
    expect(sql).toContain("ORDER BY q.mastery_score ASC");
    expect(params).toEqual([42, 1, 2, 3, 50]);
  });

  it("uses default limit of 50", () => {
    const { sql } = buildExamPrepQuery(1, [1]);
    expect(sql).toContain("LIMIT ?");
  });

  it("respects custom limit", () => {
    const { sql, params } = buildExamPrepQuery(1, [1], 10);
    expect(sql).toContain("LIMIT ?");
    expect(params).toEqual([1, 1, 10]);
  });
});

describe("sortQuestionsByMastery", () => {
  it("sorts ascending (weakest first)", () => {
    const qs: { id: number; mastery_score: number }[] = [
      { id: 1, mastery_score: 80 },
      { id: 2, mastery_score: 30 },
      { id: 3, mastery_score: 60 },
    ];
    const sorted = sortQuestionsByMastery(qs, "asc");
    expect(sorted.map((q) => q.id)).toEqual([2, 3, 1]);
  });

  it("sorts descending (strongest first)", () => {
    const qs: { id: number; mastery_score: number }[] = [
      { id: 1, mastery_score: 80 },
      { id: 2, mastery_score: 30 },
    ];
    expect(sortQuestionsByMastery(qs, "desc").map((q) => q.id)).toEqual([1, 2]);
  });
});

describe("getLeafKnowledgeIds", () => {
  it("returns ids of nodes with no children", () => {
    const tree = [
      {
        node: { id: 1 },
        children: [
          { node: { id: 2 }, children: [] },
          { node: { id: 3 }, children: [{ node: { id: 4 }, children: [] }] },
        ],
      },
    ] as any;
    const ids = getLeafKnowledgeIds(tree);
    expect(ids.sort()).toEqual([2, 4].sort());
  });

  it("returns empty array for empty tree", () => {
    expect(getLeafKnowledgeIds([])).toEqual([]);
  });
});
