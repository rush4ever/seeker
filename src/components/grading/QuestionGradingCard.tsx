import { CheckCircle, Circle, Clock, AlertCircle } from "lucide-react";
import type { GradingItem } from "../../types";

interface Props {
  item: GradingItem;
  isActive: boolean;
  onClick: () => void;
}

const statusConfig = {
  pending: { icon: Circle, color: "text-gray-400", label: "待上传" },
  uploaded: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-50", label: "已上传" },
  ocr_done: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-50", label: "识别中" },
  graded: { icon: AlertCircle, color: "text-blue-500", bg: "bg-blue-50", label: "待确认" },
  confirmed: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-50", label: "已完成" },
};

export default function QuestionGradingCard({ item, isActive, onClick }: Props) {
  const config = statusConfig[item.status];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isActive
          ? "border-primary-400 bg-primary-50"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={16} className={config.color} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">
            题{item.index + 1}
          </div>
          <div className={`text-xs ${config.color}`}>{config.label}</div>
        </div>
      </div>
      {item.ocrResult && (
        <div className="mt-2 text-xs text-gray-500 truncate">
          识别: {item.ocrResult.text}
        </div>
      )}
      {item.finalResult && (
        <div className="mt-1 text-xs">
          {item.finalResult.isCorrect === 1
            ? "✓ 正确"
            : item.finalResult.isCorrect === 0
            ? "✗ 错误"
            : item.finalResult.isCorrect === 2
            ? "~ 部分对"
            : "? 待自评"}
        </div>
      )}
    </button>
  );
}
