import { useState, useCallback, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { getDb } from "../../lib/db";
import { ocrAnswer, gradeAnswer } from "../../lib/grading";
import type { GradingItem, GeneratedQuestion, GradingResult } from "../../types";
import { invoke } from "@tauri-apps/api/core";
import PhotoUploader from "../../components/grading/PhotoUploader";
import QuestionGradingCard from "../../components/grading/QuestionGradingCard";
import ResultPanel from "../../components/grading/ResultPanel";
import { Camera } from "lucide-react";
import EmptyState from "../../components/common/EmptyState";
import { calculateMastery, shouldGraduate } from "../../lib/graduation";

// Demo data for development — will be replaced with session loading
const DEMO_QUESTIONS: GeneratedQuestion[] = [
  {
    content: "解方程：2x + 5 = 13",
    answer: "x = 4",
    explanation: "移项得 2x = 8，两边除以 2",
    questionType: "objective",
  },
  {
    content: "化简分式：(x² - 1) / (x - 1)",
    answer: "x + 1",
    explanation: "因式分解后约分",
    questionType: "objective",
  },
  {
    content: "证明：等腰三角形两底角相等",
    answer: "作顶角平分线，利用全等三角形证明",
    explanation: "构造辅助线，证明两个三角形全等",
    questionType: "subjective",
  },
];

export default function GradingPage() {
  const { currentStudent } = useApp();
  const [items, setItems] = useState<GradingItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);

  // Initialize items from questions
  useEffect(() => {
    setItems(
      DEMO_QUESTIONS.map((q, i) => ({
        index: i,
        question: q,
        status: "pending",
      }))
    );
  }, []);

  // Create a practice_sessions row on mount / student change so the
  // photo + answer persistence have a real session id to reference.
  useEffect(() => {
    if (!currentStudent) {
      setSessionId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const db = await getDb();
        const result = await db.execute(
          "INSERT INTO practice_sessions (student_id, session_type) VALUES (?, ?)",
          [currentStudent.id, "ad_hoc"]
        );
        if (!cancelled && result.lastInsertId != null) {
          setSessionId(result.lastInsertId);
        }
      } catch (err) {
        console.error("Failed to create practice session:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStudent]);

  const handlePhotoSelected = useCallback(
    async (base64: string) => {
      if (!currentStudent || sessionId === null) return;

      const item = items[activeIndex];
      if (!item) return;

      setProcessing(true);

      // Update status to uploaded
      setItems((prev) =>
        prev.map((it, i) =>
          i === activeIndex ? { ...it, status: "uploaded" } : it
        )
      );

      try {
        // Save photo via Tauri
        const photoPath = (await invoke("save_answer_photo", {
          studentId: currentStudent.id,
          sessionId,
          questionIndex: item.index,
          base64Image: base64,
        })) as string;

        // OCR
        setItems((prev) =>
          prev.map((it, i) =>
            i === activeIndex
              ? { ...it, photoPath, status: "ocr_done" }
              : it
          )
        );

        const ocrText = await ocrAnswer(base64);

        // Grade
        const aiResult = await gradeAnswer(
          item.question.content,
          ocrText,
          item.question.answer,
          item.question.questionType
        );

        setItems((prev) =>
          prev.map((it, i) =>
            i === activeIndex
              ? {
                  ...it,
                  ocrResult: { text: ocrText },
                  aiResult,
                  status: "graded",
                }
              : it
          )
        );
      } catch (err) {
        console.error("Grading error:", err);
        setItems((prev) =>
          prev.map((it, i) =>
            i === activeIndex ? { ...it, status: "pending" } : it
          )
        );
      } finally {
        setProcessing(false);
      }
    },
    [currentStudent, items, activeIndex, sessionId]
  );

  const handleConfirm = useCallback(
    async (finalResult: GradingResult) => {
      const item = items[activeIndex];
      if (!item || sessionId === null) return;

      // Persist the confirmed answer to practice_answers.
      try {
        const db = await getDb();
        await db.execute(
          `INSERT INTO practice_answers
             (session_id, generated_question_index,
              answer_image_path, ocr_result,
              is_correct, self_assessment, graded_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            sessionId,
            item.index,
            item.photoPath ?? null,
            item.ocrResult?.text ?? null,
            finalResult.isCorrect,
            finalResult.explanation || null,
          ]
        );

        // Recompute mastery for the source question and mark graduated if >= 90.
        // Source question id is stored in item.question when wired up by useQuestions.
        // For demo data (no question id), this is a no-op.
        const questionId = (item.question as any).id as number | undefined;
        if (questionId) {
          const answers = (await db.select<{ is_correct: 0 | 1 | 2 | 3 }[]>(
            `SELECT is_correct FROM practice_answers
             WHERE question_id = ? OR (session_id = ? AND generated_question_index = ?)`,
            [questionId, sessionId, item.index]
          )) as { is_correct: 0 | 1 | 2 | 3 }[];
          const newMastery = calculateMastery(answers);
          const newStatus = shouldGraduate(newMastery) ? "graduated" : "active";
          await db.execute(
            `UPDATE questions SET mastery_score = ?, status = ? WHERE id = ?`,
            [newMastery, newStatus, questionId]
          );
        }
      } catch (err) {
        console.error("Failed to save practice answer:", err);
      }

      setItems((prev) =>
        prev.map((it, i) =>
          i === activeIndex
            ? { ...it, finalResult, status: "confirmed" }
            : it
        )
      );
    },
    [activeIndex, items, sessionId]
  );

  const handleRetry = useCallback(() => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === activeIndex
          ? {
              ...it,
              status: "pending",
              photoPath: undefined,
              ocrResult: undefined,
              aiResult: undefined,
              finalResult: undefined,
            }
          : it
      )
    );
  }, [activeIndex]);

  if (!currentStudent) {
    return <EmptyState icon={Camera} message="请先在左侧选择一个学生" />;
  }

  const activeItem = items[activeIndex];
  const confirmedCount = items.filter((i) => i.status === "confirmed").length;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-notion-text">练习批改</h2>
        <p className="text-sm text-notion-muted mt-1">
          {confirmedCount} / {items.length} 题已确认
        </p>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left: Question list */}
        <div className="w-72 flex flex-col gap-2 overflow-auto">
          {items.map((item) => (
            <QuestionGradingCard
              key={item.index}
              item={item}
              isActive={item.index === activeIndex}
              onClick={() => setActiveIndex(item.index)}
            />
          ))}
        </div>

        {/* Right: Detail panel */}
        <div className="flex-1 bg-white rounded-notion border border-notion-border p-4 overflow-auto">
          {activeItem ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-notion-text mb-1">
                  题{activeItem.index + 1}
                  {activeItem.question.questionType === "subjective" && (
                    <span className="ml-2 text-xs text-orange-500">主观题</span>
                  )}
                </div>
                <div className="text-sm text-notion-muted bg-notion-surface rounded-notion p-3">
                  {activeItem.question.content}
                </div>
              </div>

              {/* Photo preview for uploaded items */}
              {(activeItem.status === "uploaded" ||
                activeItem.status === "ocr_done" ||
                activeItem.status === "graded" ||
                activeItem.status === "confirmed") &&
                activeItem.photoPath && (
                  <div className="border rounded-notion overflow-hidden">
                    <img
                      src={`file://${activeItem.photoPath}`}
                      alt="答案照片"
                      className="w-full max-h-64 object-contain"
                    />
                  </div>
                )}

              {activeItem.status === "pending" && (
                sessionId === null ? (
                  <div className="text-center text-notion-subtle py-8 text-sm">
                    准备批改会话中…
                  </div>
                ) : (
                  <PhotoUploader
                    onPhotoSelected={handlePhotoSelected}
                    disabled={processing}
                  />
                )
              )}

              {(activeItem.status === "uploaded" ||
                activeItem.status === "ocr_done" ||
                activeItem.status === "graded" ||
                activeItem.status === "confirmed") && (
                <ResultPanel
                  item={activeItem}
                  onConfirm={handleConfirm}
                  onRetry={handleRetry}
                />
              )}
            </div>
          ) : (
            <div className="text-center text-notion-subtle py-12">请选择一道题</div>
          )}
        </div>
      </div>
    </div>
  );
}
