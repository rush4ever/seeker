import { describe, it, expect } from "vitest";
import {
  buildOCRPrompt,
  buildGradingPrompt,
  parseGradingResult,
} from "./grading";

describe("buildOCRPrompt", () => {
  it("returns a prompt containing key OCR instructions", () => {
    const prompt = buildOCRPrompt();
    expect(prompt).toContain("手写");
    expect(prompt).toContain("LaTeX");
    expect(prompt).toContain("[无法识别]");
  });
});

describe("buildGradingPrompt", () => {
  it("includes question, student answer, and correct answer for objective", () => {
    const prompt = buildGradingPrompt(
      "解方程 2x + 5 = 13",
      "x = 4",
      "x = 4",
      "objective"
    );
    expect(prompt).toContain("解方程 2x + 5 = 13");
    expect(prompt).toContain("x = 4");
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("客观题");
  });

  it("requests self-assessment guidance for subjective questions", () => {
    const prompt = buildGradingPrompt(
      "证明三角形全等",
      "∵AB=CD...",
      "详见解析",
      "subjective"
    );
    expect(prompt).toContain("评分要点");
    expect(prompt).toContain("主观题");
  });
});

describe("parseGradingResult", () => {
  it("parses valid JSON result", () => {
    const raw = '{"isCorrect": 1, "explanation": "正确"}';
    const result = parseGradingResult(raw);
    expect(result.isCorrect).toBe(1);
    expect(result.explanation).toBe("正确");
  });

  it("handles JSON inside markdown code block", () => {
    const raw = '```json\n{"isCorrect": 0, "explanation": "错误"}\n```';
    const result = parseGradingResult(raw);
    expect(result.isCorrect).toBe(0);
    expect(result.explanation).toBe("错误");
  });

  it("returns unknown for unparseable output", () => {
    const result = parseGradingResult("some random text");
    expect(result.isCorrect).toBe(3);
    expect(result.explanation).toBe("some random text");
  });

  it("clamps isCorrect to valid range", () => {
    const result = parseGradingResult('{"isCorrect": 5, "explanation": ""}');
    expect(result.isCorrect).toBe(3);
  });

  it("extracts scoringPoints when present", () => {
    const raw = '{"isCorrect": 3, "explanation": "待自评", "scoringPoints": ["步骤1", "步骤2"]}';
    const result = parseGradingResult(raw);
    expect(result.scoringPoints).toEqual(["步骤1", "步骤2"]);
  });
});
