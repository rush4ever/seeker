import { useState, useCallback } from "react";
import type { Question, ErrorCause, Difficulty } from "../types";
import { getDb } from "../lib/db";
import { checkOllamaStatus, analyzeQuestion } from "../lib/ollama";
import { contentHtmlToExportText } from "../lib/export/buildRequest";
import { INLINE_IMAGE_MARKER } from "../lib/textMarkers";
import { getAllKnowledgeNodes } from "../lib/knowledgeTree";

/**
 * Build the richest available text for AI analysis.
 *
 * Merges vision-identified LaTeX into the position of each □ marker,
 * so the LLM sees each formula label right next to its □ instead of
 * having to count positions.
 *
 * Example output:
 *   ...中"□（$(-1)\times\frac{1}{5-a}=\frac{1}{a-4}$）"代表的是（ ）
 *   □（$\frac{1}{4-a}$）A. □（$\frac{9-2a}{a-4}$）B. ...
 */
function analysisText(question: Question): string {
  const base = question.content;
  if (!base) return "";

  // Get ordered formula labels from content_html
  const labels: string[] = [];
  if (question.content_html) {
    const rich = contentHtmlToExportText(question.content_html);
    // Split into segments by □, keeping the text that follows each □
    // Format: "□（...）any text□（...） □ □（...）..."
    const parts = rich.split(INLINE_IMAGE_MARKER);
    // parts[0] is text before first □ (empty or whitespace)
    // parts[1] is what follows the first □ up to the second □
    // ... etc
    for (let i = 1; i < parts.length; i++) {
      // Extract just the （...） part from what follows □
      const parenMatch = parts[i].match(/^（([^）]*)）/);
      if (parenMatch) {
        labels.push(parenMatch[1]); // e.g. "$(-1)\times\frac{1}{5-a}=\frac{1}{a-4}$"
      } else {
        // Just a bare □ with no label
        labels.push("");
      }
    }
  }

  if (labels.length === 0) return base;

  // Replace each □ in base text with □（label）
  let labelIdx = 0;
  let result = base.replace(new RegExp(INLINE_IMAGE_MARKER, "g"), () => {
    const label = labelIdx < labels.length ? labels[labelIdx] : "";
    labelIdx++;
    if (label) {
      return `${INLINE_IMAGE_MARKER}（${label}）`;
    }
    return INLINE_IMAGE_MARKER;
  });

  // Second pass: merge adjacent bare □ + labeled □ into one.
  // In the Word doc, the □ character and its surrounding math expression
  // are often split into two separate images (e.g., a 302B □ PNG and a
  // 53KB formula PNG). The bare □ is the torn-corner marker, and the
  // labeled □ is the formula that contains it. We merge them so the
  // LLM sees □ INSIDE the formula expression.
  //
  // Example: □ □（$(-1)\times\frac{1}{5-a}=\frac{1}{a-4}$）
  // becomes: □（$(□-1)\times\frac{1}{5-a}=\frac{1}{a-4}$）
  //
  // Handles both single $...$ and double $$...$$ wrapping.
  result = result.replace(
    /□\s*□（\${1,2}([^$]+)\${1,2}）/g,
    (_match: string, formula: string) => `□（$(□${formula}$）`,
  );

  return result;
}

interface AnalysisState {
  analyzing: boolean;
  ollamaAvailable: boolean | null;
  modelName: string | null;
  error: string | null;
}

export function useQuestionAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    analyzing: false,
    ollamaAvailable: null,
    modelName: null,
    error: null,
  });

  const checkOllama = useCallback(async () => {
    const status = await checkOllamaStatus();
    setState((prev) => ({
      ...prev,
      ollamaAvailable: status.available,
      modelName: status.model || null,
    }));
    return status;
  }, []);

  const analyzeSingle = useCallback(
    async (question: Question): Promise<boolean> => {
      setState((prev) => ({ ...prev, analyzing: true, error: null }));

      try {
        const status = await checkOllamaStatus();
        if (!status.available) {
          throw new Error(
            "Ollama 未运行或未安装模型。请先启动 Ollama 并拉取模型。"
          );
        }

        // Get knowledge nodes for prompt context
        const allNodes = getAllKnowledgeNodes();
        const knowledgeNodes = allNodes
          .filter((n) => n.parent_id !== null)
          .map((n) => ({ id: n.id, name: n.name }));

        // Call Ollama
        const result = await analyzeQuestion(
          analysisText(question),
          knowledgeNodes,
          status.model
        );

        // Match knowledge point names to node IDs
        const matchedKnowledgeIds: number[] = [];
        for (const kpName of result.knowledgePoints) {
          const match = allNodes.find(
            (n) =>
              n.name === kpName ||
              kpName.includes(n.name) ||
              n.name.includes(kpName)
          );
          if (match && !matchedKnowledgeIds.includes(match.id)) {
            matchedKnowledgeIds.push(match.id);
          }
        }

        // If no match found, try fuzzy match with the question chapter
        if (matchedKnowledgeIds.length === 0 && question.chapter) {
          const chapterMatch = allNodes.find((n) =>
            question.chapter!.includes(n.name)
          );
          if (chapterMatch) {
            matchedKnowledgeIds.push(chapterMatch.id);
          }
        }

        // Write to database
        const db = await getDb();

        // Update question
        await db.execute(
          `UPDATE questions
           SET error_cause = $1, difficulty = $2, solution_approach = $3,
               solution_steps = $4, updated_at = datetime('now')
           WHERE id = $5`,
          [
            result.errorCause,
            result.difficulty,
            result.solutionApproach,
            JSON.stringify(result.solutionSteps),
            question.id,
          ]
        );

        // Insert knowledge associations
        for (const kid of matchedKnowledgeIds) {
          await db.execute(
            `INSERT OR IGNORE INTO question_knowledge (question_id, knowledge_id, confidence)
             VALUES ($1, $2, 0.8)`,
            [question.id, kid]
          );
        }

        setState((prev) => ({ ...prev, analyzing: false }));
        return true;
      } catch (e) {
        setState((prev) => ({
          ...prev,
          analyzing: false,
          error: e instanceof Error ? e.message : "分析失败",
        }));
        return false;
      }
    },
    []
  );

  return {
    ...state,
    checkOllama,
    analyzeSingle,
  };
}

export function errorCauseLabel(cause: ErrorCause | null): string {
  const map: Record<string, string> = {
    concept: "概念不清",
    calculation: "计算错误",
    careless: "粗心",
    misread: "审题失误",
    unknown: "完全不会",
  };
  return cause ? map[cause] || cause : "未分析";
}

export function difficultyLabel(diff: Difficulty | null): string {
  const map: Record<string, string> = {
    easy: "简单",
    medium: "中等",
    hard: "困难",
  };
  return diff ? map[diff] || diff : "未评估";
}
