import { useState, useCallback } from "react";
import type { Question, SimilarQuestion as SimilarQuestionType } from "../types";
import { getDb } from "../lib/db";
import { generateSimilarQuestions } from "../lib/similarQuestion";
import { checkOllamaStatus } from "../lib/ollama";

export function useSimilarQuestions() {
  const [generatingForId, setGeneratingForId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (
    question: Question,
    count: number = 2
  ): Promise<SimilarQuestionType[]> => {
    setGeneratingForId(question.id);
    setError(null);

    try {
      const status = await checkOllamaStatus();
      if (!status.available) {
        throw new Error("Ollama 未运行，无法生成相似题");
      }

      // Get knowledge points for this question
      const db = await getDb();
      const knowledgeRows = await db.select<{ name: string }[]>(
        `SELECT kn.name
         FROM question_knowledge qk
         JOIN knowledge_nodes kn ON qk.knowledge_id = kn.id
         WHERE qk.question_id = $1`,
        [question.id]
      );

      const knowledgePoints = knowledgeRows.map((r) => r.name);
      if (knowledgePoints.length === 0 && question.chapter) {
        knowledgePoints.push(question.chapter);
      }

      const similarQuestions = await generateSimilarQuestions(
        question.content,
        knowledgePoints,
        count,
        status.model
      );

      // Store in database
      await db.execute(
        `UPDATE questions SET similar_questions = $1, updated_at = datetime('now') WHERE id = $2`,
        [JSON.stringify(similarQuestions), question.id]
      );

      return similarQuestions;
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
      return [];
    } finally {
      setGeneratingForId(null);
    }
  }, []);

  const loadSimilarQuestions = useCallback(async (
    questionId: number
  ): Promise<SimilarQuestionType[]> => {
    const db = await getDb();
    const rows = await db.select<{ similar_questions: string | null }[]>(
      `SELECT similar_questions FROM questions WHERE id = $1`,
      [questionId]
    );

    if (!rows[0]?.similar_questions) return [];

    try {
      return JSON.parse(rows[0].similar_questions) as SimilarQuestionType[];
    } catch {
      return [];
    }
  }, []);

  return {
    generatingForId,
    error,
    generate,
    loadSimilarQuestions,
  };
}
