import { useState, useCallback, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { ocrAnswer, gradeAnswer } from "../../lib/grading";
import type { GradingItem, GeneratedQuestion, GradingResult } from "../../types";
import { invoke } from "@tauri-apps/api/core";
import PhotoUploader from "../../components/grading/PhotoUploader";
import QuestionGradingCard from "../../components/grading/QuestionGradingCard";
import ResultPanel from "../../components/grading/ResultPanel";
import { Camera } from "lucide-react";
import EmptyState from "../../components/common/EmptyState";

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

  const handlePhotoSelected = useCallback(
    async (base64: string) => {
      if (!currentStudent) return;

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
          sessionId: 1, // TODO: use real session id
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
    [currentStudent, items, activeIndex]
  );

  const handleConfirm = useCallback(
    async (finalResult: GradingResult) => {
      setItems((prev) =>
        prev.map((it, i) =>
          i === activeIndex
            ? { ...it, finalResult, status: "confirmed" }
            : it
        )
      );

      // TODO: Save to database (practice_answers table) when session flow is connected
    },
    [activeIndex]
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
        <h2 className="text-xl font-semibold text-gray-800">练习批改</h2>
        <p className="text-sm text-gray-500 mt-1">
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
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 overflow-auto">
          {activeItem ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-800 mb-1">
                  题{activeItem.index + 1}
                  {activeItem.question.questionType === "subjective" && (
                    <span className="ml-2 text-xs text-orange-500">主观题</span>
                  )}
                </div>
                <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  {activeItem.question.content}
                </div>
              </div>

              {/* Photo preview for uploaded items */}
              {(activeItem.status === "uploaded" ||
                activeItem.status === "ocr_done" ||
                activeItem.status === "graded" ||
                activeItem.status === "confirmed") &&
                activeItem.photoPath && (
                  <div className="border rounded-lg overflow-hidden">
                    <img
                      src={`file://${activeItem.photoPath}`}
                      alt="答案照片"
                      className="w-full max-h-64 object-contain"
                    />
                  </div>
                )}

              {activeItem.status === "pending" && (
                <PhotoUploader
                  onPhotoSelected={handlePhotoSelected}
                  disabled={processing}
                />
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
            <div className="text-center text-gray-400 py-12">请选择一道题</div>
          )}
        </div>
      </div>
    </div>
  );
}
