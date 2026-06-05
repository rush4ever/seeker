import { resolveModel } from "./models";

const OLLAMA_BASE = "http://localhost:11434";

/**
 * Fix: JSON parser interprets \f in LaTeX commands (\frac, \dfrac, etc.)
 * as form-feed (0x0C). Replace form-feed with literal \f to restore LaTeX.
 */
function fixLatex(s: string): string {
  return s ? s.replace(/\f/g, "\\f") : s;
}

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
      knowledgePoints: (parsed.knowledgePoints || []).map(fixLatex),
      errorCause: parsed.errorCause || "unknown",
      difficulty: parsed.difficulty || "medium",
      solutionApproach: fixLatex(parsed.solutionApproach || ""),
      solutionSteps: Array.isArray(parsed.solutionSteps)
        ? parsed.solutionSteps.map(fixLatex)
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
5. 解题步骤：拆成 3-6 步，每步用中文文字描述。如果涉及公式，请用 $...$ 包裹 LaTeX（例如：$\\frac{1}{4-a}$，不要写没有 $ 符号的 \frac）

重要提示：
- 错题内容中的 □（白色方框）表示题目中被撕掉/遮盖的部分，是需要学生求解的未知内容
- □（$...$）中的 $...$ 是 AI 对公式图片的自动识别结果，□ 在 $...$ 内部表示它属于这个数学表达式的一部分

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
        knowledgePoints: (parsed.knowledgePoints || []).map(fixLatex),
        errorCause: parsed.errorCause || "unknown",
        difficulty: parsed.difficulty || "medium",
        solutionApproach: fixLatex(parsed.solutionApproach || ""),
        solutionSteps: Array.isArray(parsed.solutionSteps)
          ? parsed.solutionSteps.map(fixLatex)
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
    solutionApproach: fixLatex(text.slice(0, 200)),
    solutionSteps: [],
  };
}
