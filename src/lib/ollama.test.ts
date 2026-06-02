import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock resolveModel so we don't need real network in test
vi.mock("./models", () => ({
  resolveModel: vi.fn().mockResolvedValue({ model: "qwen2.5:7b" }),
}));

import { analyzeQuestion } from "./ollama";

const originalFetch = global.fetch;

describe("analyzeQuestion", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses structured AnalysisResult with solutionApproach + solutionSteps", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          knowledgePoints: ["分式", "通分"],
          errorCause: "concept",
          difficulty: "medium",
          solutionApproach: "先通分再比较",
          solutionSteps: ["通分", "比较分子", "得出结论"],
        }),
      }),
    });

    const result = await analyzeQuestion("化简 1/(4-a)", [
      { id: 1, name: "分式" },
    ]);
    expect(result.knowledgePoints).toEqual(["分式", "通分"]);
    expect(result.errorCause).toBe("concept");
    expect(result.difficulty).toBe("medium");
    expect(result.solutionApproach).toBe("先通分再比较");
    expect(result.solutionSteps).toEqual(["通分", "比较分子", "得出结论"]);
  });

  it("falls back to extractFromRawText when response is not valid JSON", async () => {
    const raw = 'some text {not valid json} trailing';
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: raw,
      }),
    });

    const result = await analyzeQuestion("test", []);
    // Falls back: empty knowledge + medium + 'unknown' cause + steps [].
    // solutionApproach keeps the legacy behaviour of carrying the first
    // 200 chars of the raw text so the user still sees SOMETHING rather
    // than a blank cell.
    expect(result.knowledgePoints).toEqual([]);
    expect(result.errorCause).toBe("unknown");
    expect(result.difficulty).toBe("medium");
    expect(result.solutionApproach).toBe(raw.slice(0, 200));
    expect(result.solutionSteps).toEqual([]);
  });

  it("falls back to extractFromRawText which DOES find a valid JSON block", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response:
          'gibberish prefix {"knowledgePoints":["A"],"errorCause":"careless","difficulty":"easy","solutionApproach":"x","solutionSteps":["y"]} gibberish suffix',
      }),
    });

    const result = await analyzeQuestion("test", []);
    expect(result.knowledgePoints).toEqual(["A"]);
    expect(result.errorCause).toBe("careless");
    expect(result.difficulty).toBe("easy");
    expect(result.solutionApproach).toBe("x");
    expect(result.solutionSteps).toEqual(["y"]);
  });

  it("throws when Ollama returns non-ok status", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(analyzeQuestion("test", [])).rejects.toThrow(/500/);
  });

  it("tolerates missing solutionSteps field (defaults to [])", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          knowledgePoints: ["A"],
          errorCause: "unknown",
          difficulty: "medium",
          solutionApproach: "x",
          // solutionSteps missing
        }),
      }),
    });

    const result = await analyzeQuestion("test", []);
    expect(result.solutionApproach).toBe("x");
    expect(result.solutionSteps).toEqual([]);
  });
});
