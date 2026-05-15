import { describe, it, expect, vi } from "vitest";
import {
  buildSimilarQuestionPrompt,
  parseSimilarQuestionResponse,
  generateSimilarQuestions,
} from "./similarQuestion";

describe("buildSimilarQuestionPrompt", () => {
  it("includes the original question content", () => {
    const prompt = buildSimilarQuestionPrompt(
      "计算: 2+2=",
      ["整数加法"],
      1
    );
    expect(prompt).toContain("2+2=");
  });

  it("includes knowledge points in the prompt", () => {
    const prompt = buildSimilarQuestionPrompt(
      "某题",
      ["分式的乘除", "约分"],
      2
    );
    expect(prompt).toContain("分式的乘除");
    expect(prompt).toContain("约分");
  });

  it("specifies the requested number of questions", () => {
    const prompt = buildSimilarQuestionPrompt("某题", ["知识点"], 3);
    expect(prompt).toContain("3");
  });

  it("requests JSON output with required fields", () => {
    const prompt = buildSimilarQuestionPrompt("某题", ["知识点"], 1);
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("content");
    expect(prompt).toContain("answer");
    expect(prompt).toContain("explanation");
  });
});

describe("parseSimilarQuestionResponse", () => {
  it("parses valid JSON array response", () => {
    const response = JSON.stringify([
      {
        content: "新题1",
        answer: "答案1",
        explanation: "解析1",
      },
      {
        content: "新题2",
        answer: "答案2",
        explanation: "解析2",
      },
    ]);

    const result = parseSimilarQuestionResponse(response);
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("新题1");
    expect(result[0].answer).toBe("答案1");
    expect(result[0].explanation).toBe("解析1");
  });

  it("parses JSON object wrapped in markdown code block", () => {
    const response =
      '```json\n' +
      JSON.stringify([
        { content: "题", answer: "答", explanation: "解" },
      ]) +
      '\n```';

    const result = parseSimilarQuestionResponse(response);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("题");
  });

  it("returns empty array for invalid JSON", () => {
    const result = parseSimilarQuestionResponse("not json at all");
    expect(result).toEqual([]);
  });

  it("returns empty array for JSON that is not an array", () => {
    const result = parseSimilarQuestionResponse('{"foo": "bar"}');
    expect(result).toEqual([]);
  });

  it("fills missing fields with empty strings", () => {
    const response = JSON.stringify([{ content: "只有题目" }]);
    const result = parseSimilarQuestionResponse(response);
    expect(result[0].content).toBe("只有题目");
    expect(result[0].answer).toBe("");
    expect(result[0].explanation).toBe("");
  });
});

describe("generateSimilarQuestions", () => {
  it("calls Ollama API and returns parsed similar questions", async () => {
    const mockResponse = {
      model: "qwen2.5:7b",
      response: JSON.stringify([
        { content: "相似题1", answer: "A", explanation: "因为..." },
      ]),
      done: true,
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateSimilarQuestions(
      "原题",
      ["知识点A"],
      1,
      "qwen2.5:7b"
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("http://localhost:11434/api/generate");

    const body = JSON.parse(callArgs[1].body);
    expect(body.model).toBe("qwen2.5:7b");
    expect(body.format).toBe("json");
    expect(body.stream).toBe(false);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("相似题1");
    expect(result[0].answer).toBe("A");

    vi.unstubAllGlobals();
  });

  it("throws when Ollama API returns error status", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      generateSimilarQuestions("原题", ["知识点"], 1)
    ).rejects.toThrow("Ollama API error");

    vi.unstubAllGlobals();
  });
});
