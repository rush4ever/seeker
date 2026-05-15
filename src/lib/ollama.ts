const OLLAMA_BASE = "http://localhost:11434";
const DEFAULT_MODEL = "qwen2.5:32b";
const FALLBACK_MODEL = "qwen2.5:7b";

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
  explanation: string;
}

export async function checkOllamaStatus(): Promise<{
  available: boolean;
  model?: string;
  fallbackAvailable?: boolean;
}> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { method: "GET" });
    if (!res.ok) return { available: false };

    const data = (await res.json()) as { models: OllamaTag[] };
    const models = data.models.map((m) => m.name);

    if (models.includes(DEFAULT_MODEL)) {
      return { available: true, model: DEFAULT_MODEL };
    }
    if (models.includes(FALLBACK_MODEL)) {
      return {
        available: true,
        model: FALLBACK_MODEL,
        fallbackAvailable: true,
      };
    }
    return { available: false };
  } catch {
    return { available: false };
  }
}

export async function analyzeQuestion(
  questionContent: string,
  knowledgeNodes: { id: number; name: string }[],
  model?: string
): Promise<AnalysisResult> {
  const m = model || DEFAULT_MODEL;

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
      explanation: parsed.explanation || "",
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
4. 给出简要分析说明

预置知识树：
${nodeList}

错题内容：
${questionContent}

请以 JSON 格式返回，包含字段：knowledgePoints(字符串数组), errorCause, difficulty, explanation`;
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
        explanation: parsed.explanation || "",
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
    explanation: text.slice(0, 200),
  };
}
