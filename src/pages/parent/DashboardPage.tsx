import { useApp } from "../../context/AppContext";
import { TrendingUp, AlertCircle, Clock } from "lucide-react";

export default function DashboardPage() {
  const { currentStudent } = useApp();

  if (!currentStudent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p className="text-lg">请在左侧选择一个学生查看数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800">
        {currentStudent.name} 的学习概况
      </h2>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "数学掌握度", value: "67%", change: "+5%", icon: TrendingUp },
          { label: "物理掌握度", value: "52%", change: "+3%", icon: TrendingUp },
          { label: "薄弱知识点", value: "12", change: "-2", icon: AlertCircle },
          { label: "本周练习", value: "5次", change: "+2", icon: Clock },
        ].map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={20} className="text-primary-500" />
              <span className="text-sm text-green-600 font-medium">
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="text-lg font-medium text-gray-800 mb-3">掌握度趋势</h3>
        <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
          <span>趋势图表将在后续版本展示</span>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-medium text-gray-800 mb-3">当前薄弱点</h3>
        <div className="space-y-3">
          {[
            { name: "分式的乘除", mastery: 35, subject: "数学" },
            { name: "气体压强", mastery: 52, subject: "物理" },
            { name: "分式化简", mastery: 48, subject: "数学" },
          ].map((point) => (
            <div
              key={point.name}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-medium">{point.name}</p>
                <p className="text-sm text-gray-500">{point.subject}</p>
              </div>
              <span className="text-red-500 font-medium">{point.mastery}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
