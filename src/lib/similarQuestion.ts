import { resolveModel } from "./models";

const OLLAMA_BASE = "http://localhost:11434";

export interface SimilarQuestion {
  content: string;
  answer: string;
  explanation: string;
}

export function buildSimilarQuestionPrompt(
  originalQuestion: string,
  knowledgePoints: string[],
  count: number
): string {
  const kpList = knowledgePoints.map((kp) => `- ${kp}`).join("\n");

  return `你是一位资深的中学数学/物理教师。请基于下面的错题，生成 ${count} 道相似练习题。

要求：
1. 保持相同的知识点和难度水平
2. 改变数字、情境或问法，但不要改变核心解题方法
3. 确保生成的题目有明确的标准答案
4. 给出简要的解题思路说明

涉及知识点：
${kpList}

原错题：
${originalQuestion}

请以 JSON 数组格式返回，每个元素包含字段：content(题目内容), answer(标准答案), explanation(解题思路)。`;
}

/**
 * Fix: JSON parser interprets \f in LaTeX commands (\frac, \dfrac, etc.)
 * as form-feed (0x0C). Replace form-feed with literal \f to restore LaTeX.
 */
function fixLatex(s: string): string {
  return s ? s.replace(/\f/g, "\\f") : s;
}

export function parseSimilarQuestionResponse(response: string): SimilarQuestion[] {
  // Try to extract JSON from markdown code block
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : response.trim();

  try {
    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item: Record<string, unknown>) => ({
      content: fixLatex(typeof item.content === "string" ? item.content : ""),
      answer: fixLatex(typeof item.answer === "string" ? item.answer : ""),
      explanation: fixLatex(typeof item.explanation === "string" ? item.explanation : ""),
    }));
  } catch {
    return [];
  }
}

export async function generateSimilarQuestions(
  originalQuestion: string,
  knowledgePoints: string[],
  count: number,
  model?: string
): Promise<SimilarQuestion[]> {
  const m = model || (await resolveModel("reasoning"))?.model || "qwen2.5:7b";
  const prompt = buildSimilarQuestionPrompt(originalQuestion, knowledgePoints, count);

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: m,
      prompt,
      stream: false,
      format: "json",
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { response: string };
  return parseSimilarQuestionResponse(data.response);
}
