import { useApp } from "../../context/AppContext";
import { Target, BookOpen, Brain } from "lucide-react";

export default function HomePage() {
  const { currentStudent } = useApp();

  if (!currentStudent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <BookOpen size={48} className="mb-4" />
        <p className="text-lg">请在左侧选择一个学生</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
        <h2 className="text-xl font-semibold text-primary-800 mb-2">
          今日薄弱点快练
        </h2>
        <p className="text-primary-600 mb-4">
          基于你的错题分析，今天有 3 个知识点需要巩固
        </p>
        <button className="btn-primary text-lg px-8 py-4">
          <Target size={20} className="inline mr-2" />
          开始 5 分钟快练
        </button>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3">薄弱知识点</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: "分式的乘除", mastery: 35, subject: "数学" },
            { name: "气体压强", mastery: 52, subject: "物理" },
            { name: "分式化简", mastery: 48, subject: "数学" },
          ].map((point) => (
            <div key={point.name} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{point.subject}</span>
                <span
                  className={`text-sm font-medium ${
                    point.mastery < 50 ? "text-red-500" : "text-yellow-500"
                  }`}
                >
                  {point.mastery}%
                </span>
              </div>
              <p className="font-medium text-gray-800">{point.name}</p>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    point.mastery < 50 ? "bg-red-400" : "bg-yellow-400"
                  }`}
                  style={{ width: `${point.mastery}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium text-gray-800 mb-3">知识图谱预览</h3>
        <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
          <Brain size={32} className="mr-2" />
          <span>知识图谱可视化将在后续版本展示</span>
        </div>
      </div>
    </div>
  );
}
