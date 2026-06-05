import { useState, useCallback } from "react";
import type { Question, ErrorCause, Difficulty } from "../types";
import { getDb } from "../lib/db";
import { checkOllamaStatus, analyzeQuestion } from "../lib/ollama";
import { contentHtmlToExportText } from "../lib/export/buildRequest";
import { getAllKnowledgeNodes } from "../lib/knowledgeTree";

/**
 * Build the richest available text for AI analysis.
 * Combines two sources:
 *   - original text with □ position markers from question.content
 *   - vision-identified LaTeX from content_html
 *
 * The □ markers are critical context that the vision model often drops
 * (e.g. identifying "(-1)" instead of "(□-1)"). The LLM needs both
 * to understand the problem correctly.
 */
function analysisText(question: Question): string {
  // Start with the original text (has □ position markers)
  const parts = [question.content];

  // Append rich LaTeX text from vision model as extra context
  if (question.content_html) {
    const rich = contentHtmlToExportText(question.content_html);
    if (rich && rich !== question.content) {
      parts.push(`（公式图片识别：${rich}）`);
    }
  }

  return parts.join("\n");
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
