import { useState } from "react";
import type { GradingItem, GradingResult } from "../../types";

interface Props {
  item: GradingItem;
  onConfirm: (result: GradingResult) => void;
  onRetry: () => void;
}

export default function ResultPanel({ item, onConfirm, onRetry }: Props) {
  const [manualResult, setManualResult] = useState<GradingResult["isCorrect"]>(
    item.aiResult?.isCorrect ?? 3
  );

  if (item.status === "uploaded" || item.status === "ocr_done") {
    return (
      <div className="text-center text-gray-400 py-12">
        <div className="animate-pulse mb-2">⏳</div>
        <p>正在处理中...</p>
      </div>
    );
  }

  const result = item.aiResult;
  if (!result) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">处理失败</p>
        <button onClick={onRetry} className="btn-primary text-sm">
          重试
        </button>
      </div>
    );
  }

  const isSubjective = item.question.questionType === "subjective";

  return (
    <div className="space-y-4">
      {/* OCR result */}
      {item.ocrResult && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">OCR 识别结果</div>
          <div className="text-sm font-mono">{item.ocrResult.text}</div>
        </div>
      )}

      {/* AI grading result */}
      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
        <div className="text-xs text-blue-600 mb-1">AI 批改</div>
        <div className="text-sm font-medium">
          {result.isCorrect === 1
            ? "✓ 正确"
            : result.isCorrect === 0
            ? "✗ 错误"
            : result.isCorrect === 2
            ? "~ 部分正确"
            : "? 待自评"}
        </div>
        {result.explanation && (
          <div className="text-xs text-gray-600 mt-1">{result.explanation}</div>
        )}
        {isSubjective && result.scoringPoints && result.scoringPoints.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gray-500">评分要点：</div>
            <ul className="text-xs list-disc list-inside mt-1 space-y-0.5">
              {result.scoringPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Manual correction */}
      <div>
        <div className="text-xs text-gray-500 mb-2">确认或修正结果：</div>
        <div className="flex gap-2">
          {([
            { value: 1 as const, label: "✓ 正确" },
            { value: 2 as const, label: "~ 部分对" },
            { value: 0 as const, label: "✗ 错误" },
            { value: 3 as const, label: "? 待自评" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setManualResult(opt.value)}
              className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                manualResult === opt.value
                  ? "border-primary-400 bg-primary-50 text-primary-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() =>
            onConfirm({
              isCorrect: manualResult,
              explanation: result.explanation,
              scoringPoints: result.scoringPoints,
            })
          }
          className="flex-1 btn-primary py-2"
        >
          确认结果
        </button>
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          重新上传
        </button>
      </div>
    </div>
  );
}
