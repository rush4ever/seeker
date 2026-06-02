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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  buildMasteryTrendQuery,
  formatMasteryTrend,
  type WeeklyMasteryPoint,
} from "../../lib/masteryTrend";

export default function DashboardPage() {
  const { currentStudent } = useApp();
  const [loading, setLoading] = useState(false);
  const [subjectMastery, setSubjectMastery] = useState<SubjectMastery[]>([]);
  const [weakPointCount, setWeakPointCount] = useState(0);
  const [weeklyPractice, setWeeklyPractice] = useState(0);
  const [topWeakPoints, setTopWeakPoints] = useState<WeakPoint[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [graduatedQuestions, setGraduatedQuestions] = useState(0);
  const [trendData, setTrendData] = useState<WeeklyMasteryPoint[]>([]);

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

      // Mastery trend
      const trendQuery = buildMasteryTrendQuery(studentId);
      const trendRows = await db.select<{ week: string; subject: string; avg_score: number }[]>(
        trendQuery.sql,
        trendQuery.params
      );
      setTrendData(formatMasteryTrend(trendRows));

      setLoading(false);
    };

    load().catch(() => setLoading(false));
  }, [currentStudent]);

  if (!currentStudent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-notion-subtle">
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
        <h2 className="text-2xl font-semibold text-notion-text">
          {currentStudent.name} 的学习概况
        </h2>
        {loading && <Loader2 size={18} className="animate-spin text-notion-subtle" />}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="notion-card">
            <div className="flex items-center justify-between mb-2">
              <stat.icon size={20} className={stat.color} />
            </div>
            <p className="text-2xl font-bold text-notion-text">{stat.value}</p>
            <p className="text-sm text-notion-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div className="grid grid-cols-3 gap-4">
        <div className="notion-card text-center">
          <BookOpen size={24} className="mx-auto mb-2 text-primary-500" />
          <p className="text-2xl font-bold text-notion-text">{totalQuestions}</p>
          <p className="text-sm text-notion-muted">累计错题</p>
        </div>
        <div className="notion-card text-center">
          <GraduationCap size={24} className="mx-auto mb-2 text-green-500" />
          <p className="text-2xl font-bold text-notion-text">{graduatedQuestions}</p>
          <p className="text-sm text-notion-muted">已毕业</p>
        </div>
        <div className="notion-card text-center">
          <AlertCircle size={24} className="mx-auto mb-2 text-red-500" />
          <p className="text-2xl font-bold text-notion-text">{weakPointCount}</p>
          <p className="text-sm text-notion-muted">薄弱知识点</p>
        </div>
      </div>

      {/* Mastery trend chart */}
      <div className="notion-card">
        <h3 className="text-lg font-medium text-notion-text mb-3">掌握度趋势</h3>
        {trendData.length === 0 ? (
          <div className="h-64 bg-notion-surface rounded-notion flex items-center justify-center text-notion-subtle">
            <span>暂无历史数据，完成练习后将显示趋势</span>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#d1d5db' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#d1d5db' }}
                  label={{ value: '掌握度 %', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
                />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, '']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="overall"
                  name="综合"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#2563eb' }}
                  activeDot={{ r: 5 }}
                />
                {trendData.some((d) => d.math !== undefined) && (
                  <Line
                    type="monotone"
                    dataKey="math"
                    name="数学"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#3b82f6' }}
                    strokeDasharray="5 5"
                  />
                )}
                {trendData.some((d) => d.physics !== undefined) && (
                  <Line
                    type="monotone"
                    dataKey="physics"
                    name="物理"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#22c55e' }}
                    strokeDasharray="5 5"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Current weak points */}
      <div className="notion-card">
        <h3 className="text-lg font-medium text-notion-text mb-3">当前薄弱点</h3>
        {topWeakPoints.length === 0 ? (
          <p className="text-notion-subtle text-center py-4">暂无薄弱知识点数据</p>
        ) : (
          <div className="space-y-3">
            {topWeakPoints.map((point) => (
              <div
                key={point.name}
                className="flex items-center justify-between p-3 bg-notion-surface rounded-notion"
              >
                <div>
                  <p className="font-medium">{point.name}</p>
                  <p className="text-sm text-notion-muted">{point.subjectLabel}</p>
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
