import type { GradingResult } from "../types";
import { resolveModel } from "./models";

const OLLAMA_BASE = "http://localhost:11434";

export function buildOCRPrompt(): string {
  return `你是一位擅长识别手写文字的助手。请识别这张照片中的手写答案。

要求：
1. 只返回答案内容，不要任何解释
2. 如果是数学公式，尽量用 LaTeX 表示
3. 如果看不清，返回 "[无法识别]"

请直接输出答案：`;
}

export function buildGradingPrompt(
  questionContent: string,
  studentAnswer: string,
  correctAnswer: string,
  questionType: "objective" | "subjective"
): string {
  const isObjective = questionType === "objective";

  return `你是一位资深中学教师。请批改学生的答案。

【题目】
${questionContent}

【学生答案】
${studentAnswer}

【标准答案】
${correctAnswer}

${isObjective
    ? "这是一道客观题（选择/填空/简单计算）。请判断学生答案是否正确。允许等价答案（如 x=4 和 4 视为等价）。"
    : "这是一道主观题（解答/证明）。请给出参考答案和评分要点，由学生对照自评。"
  }

请以 JSON 格式返回：
{
  "isCorrect": ${isObjective ? "0 或 1（0=错，1=对）" : "3（表示待自评）"},
  "explanation": "简要说明",
  "scoringPoints": ${isObjective ? "null" : "[\"要点1\", \"要点2\", ...]"}
}`;
}

export function parseGradingResult(raw: string): GradingResult {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                    raw.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr) as Partial<GradingResult>;
      const isCorrect = Number(parsed.isCorrect);
      return {
        isCorrect: (isCorrect >= 0 && isCorrect <= 3 ? isCorrect : 3) as GradingResult["isCorrect"],
        explanation: parsed.explanation || "",
        scoringPoints: parsed.scoringPoints,
      };
    } catch {
      // fall through
    }
  }

  return {
    isCorrect: 3,
    explanation: raw.slice(0, 500),
  };
}

export async function ocrAnswer(
  imageBase64: string,
  model?: string
): Promise<string> {
  const m = model || (await resolveModel("vision"))?.model || "llava:13b";
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: m,
      messages: [
        {
          role: "user",
          content: buildOCRPrompt(),
          images: [imageBase64.replace(/^data:image\/\w+;base64,/, "")],
        },
      ],
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`OCR API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    message?: { content?: string };
  };
  return data.message?.content?.trim() || "[无法识别]";
}

export async function gradeAnswer(
  questionContent: string,
  studentAnswer: string,
  correctAnswer: string,
  questionType: "objective" | "subjective",
  model?: string
): Promise<GradingResult> {
  const m = model || (await resolveModel("reasoning"))?.model || "qwen2.5:7b";
  const prompt = buildGradingPrompt(
    questionContent,
    studentAnswer,
    correctAnswer,
    questionType
  );

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
    throw new Error(`Grading API error: ${res.status}`);
  }

  const data = (await res.json()) as { response: string };
  return parseGradingResult(data.response);
}
