import { describe, it, expect } from "vitest";
import {
  getStatusMessage,
  getStatusColor,
  type OllamaState,
} from "./ollamaStatus";

describe("getStatusMessage", () => {
  it("returns checking message", () => {
    const state: OllamaState = { status: "checking", model: null, checked: false };
    expect(getStatusMessage(state)).toBe("正在检测 Ollama...");
  });

  it("returns ready message with model", () => {
    const state: OllamaState = { status: "ready", model: "qwen2.5:32b", checked: true };
    expect(getStatusMessage(state)).toBe("Ollama 就绪 (qwen2.5:32b)");
  });

  it("returns ready message without model", () => {
    const state: OllamaState = { status: "ready", model: null, checked: true };
    expect(getStatusMessage(state)).toBe("Ollama 就绪");
  });

  it("returns not running message", () => {
    const state: OllamaState = { status: "not_running", model: null, checked: true };
    expect(getStatusMessage(state)).toBe("Ollama 未运行，AI 分析功能不可用");
  });

  it("returns no model message", () => {
    const state: OllamaState = { status: "no_model", model: null, checked: true };
    expect(getStatusMessage(state)).toBe("Ollama 运行中但未安装模型");
  });
});

describe("getStatusColor", () => {
  it("returns green for ready", () => {
    const state: OllamaState = { status: "ready", model: null, checked: true };
    expect(getStatusColor(state)).toContain("green");
  });

  it("returns amber for checking", () => {
    const state: OllamaState = { status: "checking", model: null, checked: false };
    expect(getStatusColor(state)).toContain("amber");
  });

  it("returns red for not_running", () => {
    const state: OllamaState = { status: "not_running", model: null, checked: true };
    expect(getStatusColor(state)).toContain("red");
  });

  it("returns red for no_model", () => {
    const state: OllamaState = { status: "no_model", model: null, checked: true };
    expect(getStatusColor(state)).toContain("red");
  });
});
