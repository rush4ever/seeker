import { Brain } from "lucide-react";

export default function GraphPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <Brain size={48} className="mb-4" />
      <p className="text-lg">知识图谱功能将在 Slice 3/9 中实现</p>
      <p className="text-sm mt-2">可视化展示知识点掌握情况</p>
    </div>
  );
}
