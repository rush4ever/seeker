import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { getDb } from "../../lib/db";
import {
  buildSubjectMasteryQuery,
  buildWeakPointCountQuery,
  buildWeeklyPracticeQuery,
  buildTopWeakPointsQuery,
  buildTotalQuestionsQuery,
  formatSubjectMastery,
  formatWeakPoints,
  type SubjectMastery,
  type WeakPoint,
} from "../../lib/dashboardStats";
import {
  TrendingUp,
  AlertCircle,
  Clock,
  BookOpen,
  GraduationCap,
  Loader2,
} from "lucide-react";

export default function DashboardPage() {
  const { currentStudent } = useApp();
  const [loading, setLoading] = useState(false);
  const [subjectMastery, setSubjectMastery] = useState<SubjectMastery[]>([]);
  const [weakPointCount, setWeakPointCount] = useState(0);
  const [weeklyPractice, setWeeklyPractice] = useState(0);
  const [topWeakPoints, setTopWeakPoints] = useState<WeakPoint[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [graduatedQuestions, setGraduatedQuestions] = useState(0);

  useEffect(() => {
    if (!currentStudent) return;

    setLoading(true);
    const load = async () => {
      const db = await getDb();
      const studentId = currentStudent.id;

      // Subject mastery
      const masteryQuery = buildSubjectMasteryQuery(studentId);
      const masteryRows = await db.select<{ subject: string; avg_mastery: number }[]>(
        masteryQuery.sql,
        masteryQuery.params
      );
      setSubjectMastery(formatSubjectMastery(masteryRows));

      // Weak point count
      const weakQuery = buildWeakPointCountQuery(studentId);
      const weakRows = await db.select<{ count: number }[]>(weakQuery.sql, weakQuery.params);
      setWeakPointCount(weakRows[0]?.count ?? 0);

      // Weekly practice
      const practiceQuery = buildWeeklyPracticeQuery(studentId);
      const practiceRows = await db.select<{ count: number }[]>(practiceQuery.sql, practiceQuery.params);
      setWeeklyPractice(practiceRows[0]?.count ?? 0);

      // Top weak points
      const topWeakQuery = buildTopWeakPointsQuery(studentId, 5);
      const topWeakRows = await db.select<{ name: string; subject: string; avg_mastery: number }[]>(
        topWeakQuery.sql,
        topWeakQuery.params
      );
      setTopWeakPoints(formatWeakPoints(topWeakRows));

      // Total questions
      const totalQuery = buildTotalQuestionsQuery(studentId);
      const totalRows = await db.select<{ total: number; graduated: number }[]>(
        totalQuery.sql,
        totalQuery.params
      );
      setTotalQuestions(totalRows[0]?.total ?? 0);
      setGraduatedQuestions(totalRows[0]?.graduated ?? 0);

      setLoading(false);
    };

    load().catch(() => setLoading(false));
  }, [currentStudent]);

  if (!currentStudent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <p className="text-lg">请在左侧选择一个学生查看数据</p>
      </div>
    );
  }

  const statCards = [
    {
      label: "数学掌握度",
      value: `${subjectMastery.find((s) => s.subject === "math")?.avgMastery ?? 0}%`,
      icon: TrendingUp,
      color: "text-primary-500",
    },
    {
      label: "物理掌握度",
      value: `${subjectMastery.find((s) => s.subject === "physics")?.avgMastery ?? 0}%`,
      icon: TrendingUp,
      color: "text-primary-500",
    },
    {
      label: "薄弱知识点",
      value: `${weakPointCount}`,
      icon: AlertCircle,
      color: "text-red-500",
    },
    {
      label: "本周练习",
      value: `${weeklyPractice}次`,
      icon: Clock,
      color: "text-amber-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-800">
          {currentStudent.name} 的学习概况
        </h2>
        {loading && <Loader2 size={18} className="animate-spin text-gray-400" />}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={20} className={stat.color} />
            </div>
            <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <BookOpen size={24} className="mx-auto mb-2 text-primary-500" />
          <p className="text-2xl font-bold text-gray-800">{totalQuestions}</p>
          <p className="text-sm text-gray-500">累计错题</p>
        </div>
        <div className="card text-center">
          <GraduationCap size={24} className="mx-auto mb-2 text-green-500" />
          <p className="text-2xl font-bold text-gray-800">{graduatedQuestions}</p>
          <p className="text-sm text-gray-500">已毕业</p>
        </div>
        <div className="card text-center">
          <AlertCircle size={24} className="mx-auto mb-2 text-red-500" />
          <p className="text-2xl font-bold text-gray-800">{weakPointCount}</p>
          <p className="text-sm text-gray-500">薄弱知识点</p>
        </div>
      </div>

      {/* Mastery trend placeholder */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-800 mb-3">掌握度趋势</h3>
        <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
          <span>趋势图表将在后续版本展示</span>
        </div>
      </div>

      {/* Current weak points */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-800 mb-3">当前薄弱点</h3>
        {topWeakPoints.length === 0 ? (
          <p className="text-gray-400 text-center py-4">暂无薄弱知识点数据</p>
        ) : (
          <div className="space-y-3">
            {topWeakPoints.map((point) => (
              <div
                key={point.name}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{point.name}</p>
                  <p className="text-sm text-gray-500">{point.subjectLabel}</p>
                </div>
                <span className="text-red-500 font-medium">{point.mastery}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
