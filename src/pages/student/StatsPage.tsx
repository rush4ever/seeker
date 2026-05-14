import { BarChart3 } from "lucide-react";

export default function StatsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <BarChart3 size={48} className="mb-4" />
      <p className="text-lg">统计功能将在 Slice 9 中实现</p>
      <p className="text-sm mt-2">掌握度趋势、每周小结、考试预测</p>
    </div>
  );
}
