import { BookOpen } from "lucide-react";

export default function QuestionsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-400">
      <BookOpen size={48} className="mb-4" />
      <p className="text-lg">错题本功能将在 Slice 2 中实现</p>
      <p className="text-sm mt-2">支持 Word 文档导入和手动添加</p>
    </div>
  );
}
