import { resolveModel } from "./models";

const OLLAMA_BASE = "http://localhost:11434";

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

export interface OllamaTag {
  name: string;
  model: string;
}

export interface AnalysisResult {
  knowledgePoints: string[];
  errorCause: "concept" | "calculation" | "careless" | "misread" | "unknown";
  difficulty: "easy" | "medium" | "hard";
  solutionApproach: string;
  solutionSteps: string[];
}

export async function checkOllamaStatus(): Promise<{
  available: boolean;
  model?: string;
  fallbackAvailable?: boolean;
}> {
  const availability = await resolveModel("reasoning");
  if (availability) {
    return {
      available: true,
      model: availability.model,
      fallbackAvailable: availability.isFallback,
    };
  }
  return { available: false };
}

export async function analyzeQuestion(
  questionContent: string,
  knowledgeNodes: { id: number; name: string }[],
  model?: string
): Promise<AnalysisResult> {
  const m = model || (await resolveModel("reasoning"))?.model || "qwen2.5:7b";

  const prompt = buildAnalysisPrompt(questionContent, knowledgeNodes);

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

  const data = (await res.json()) as OllamaResponse;

  try {
    const parsed = JSON.parse(data.response) as AnalysisResult;
    return {
      knowledgePoints: parsed.knowledgePoints || [],
      errorCause: parsed.errorCause || "unknown",
      difficulty: parsed.difficulty || "medium",
      solutionApproach: parsed.solutionApproach || "",
      solutionSteps: Array.isArray(parsed.solutionSteps)
        ? parsed.solutionSteps
        : [],
    };
  } catch {
    // If JSON parse fails, try to extract from raw text
    return extractFromRawText(data.response);
  }
}

function buildAnalysisPrompt(
  questionContent: string,
  knowledgeNodes: { id: number; name: string }[]
): string {
  const nodeList = knowledgeNodes.map((n) => `- ${n.name}`).join("\n");

  return `你是一位资深的中学数学/物理教师。请分析下面的错题，完成以下任务：

1. 从预置知识树中选择最匹配的知识点（可复选）
2. 判断错因类型：concept(概念不清) / calculation(计算错误) / careless(粗心) / misread(审题失误) / unknown(完全不会)
3. 评估难度：easy / medium / hard
4. 解题思路：用 2-4 句中文说明这类题的一般解法/切入点
5. 解题步骤：拆成 3-6 步，每步用文字或 LaTeX（$...$）表达，如果需要表示数学公式请用 LaTeX

预置知识树：
${nodeList}

错题内容：
${questionContent}

请以 JSON 格式返回：
{
  "knowledgePoints": ["..."],
  "errorCause": "concept|calculation|careless|misread|unknown",
  "difficulty": "easy|medium|hard",
  "solutionApproach": "...",
  "solutionSteps": ["步骤 1", "步骤 2", "..."]
}`;
}

function extractFromRawText(text: string): AnalysisResult {
  // Try to find JSON block
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;
      return {
        knowledgePoints: parsed.knowledgePoints || [],
        errorCause: parsed.errorCause || "unknown",
        difficulty: parsed.difficulty || "medium",
        solutionApproach: parsed.solutionApproach || "",
        solutionSteps: Array.isArray(parsed.solutionSteps)
          ? parsed.solutionSteps
          : [],
      };
    } catch {
      // fall through
    }
  }

  // Fallback: return empty result
  return {
    knowledgePoints: [],
    errorCause: "unknown",
    difficulty: "medium",
    solutionApproach: text.slice(0, 200),
    solutionSteps: [],
  };
}
