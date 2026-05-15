import { useState, useCallback } from "react";
import type { Question, ErrorCause, Difficulty } from "../types";
import { getDb } from "../lib/db";
import { checkOllamaStatus, analyzeQuestion } from "../lib/ollama";
import { getAllKnowledgeNodes } from "../lib/knowledgeTree";

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
          question.content,
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
           SET error_cause = $1, difficulty = $2, updated_at = datetime('now')
           WHERE id = $3`,
          [result.errorCause, result.difficulty, question.id]
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

  const analyzeBatch = useCallback(
    async (questions: Question[]): Promise<{ success: number; failed: number }> => {
      setState((prev) => ({ ...prev, analyzing: true, error: null }));

      let success = 0;
      let failed = 0;

      const status = await checkOllamaStatus();
      if (!status.available) {
        setState((prev) => ({
          ...prev,
          analyzing: false,
          error: "Ollama 未运行或未安装模型",
        }));
        return { success: 0, failed: questions.length };
      }

      const allNodes = getAllKnowledgeNodes();
      const knowledgeNodes = allNodes
        .filter((n) => n.parent_id !== null)
        .map((n) => ({ id: n.id, name: n.name }));

      for (const question of questions) {
        try {
          const result = await analyzeQuestion(
            question.content,
            knowledgeNodes,
            status.model
          );

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

          if (matchedKnowledgeIds.length === 0 && question.chapter) {
            const chapterMatch = allNodes.find((n) =>
              question.chapter!.includes(n.name)
            );
            if (chapterMatch) {
              matchedKnowledgeIds.push(chapterMatch.id);
            }
          }

          const db = await getDb();
          await db.execute(
            `UPDATE questions
             SET error_cause = $1, difficulty = $2, updated_at = datetime('now')
             WHERE id = $3`,
            [result.errorCause, result.difficulty, question.id]
          );

          for (const kid of matchedKnowledgeIds) {
            await db.execute(
              `INSERT OR IGNORE INTO question_knowledge (question_id, knowledge_id, confidence)
               VALUES ($1, $2, 0.8)`,
              [question.id, kid]
            );
          }

          success++;
        } catch {
          failed++;
        }
      }

      setState((prev) => ({ ...prev, analyzing: false }));
      return { success, failed };
    },
    []
  );

  return {
    ...state,
    checkOllama,
    analyzeSingle,
    analyzeBatch,
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
