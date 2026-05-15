import { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { getDb } from "../../lib/db";
import {
  getWeeklySummary,
  predictExamWeakPoints,
  calculateSubjectDistribution,
} from "../../lib/stats";
import type { Question } from "../../types";
import {
  BarChart3,
  BookOpen,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Target,
} from "lucide-react";

export default function StatsPage() {
  const { currentStudent } = useApp();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [knowledgeMap, setKnowledgeMap] = useState<
    Map<number, { name: string; questionIds: number[] }>
  >(new Map());

  useEffect(() => {
    if (!currentStudent) return;
    setLoading(true);

    Promise.all([
      getDb().then((db) =>
        db.select<Question[]>(
          "SELECT * FROM questions WHERE student_id = $1",
          [currentStudent.id]
        )
      ),
      getDb().then((db) =>
        db.select<{ knowledge_id: number; name: string; question_id: number }[]>(
          `SELECT qk.knowledge_id, kn.name, qk.question_id
           FROM question_knowledge qk
           JOIN knowledge_nodes kn ON qk.knowledge_id = kn.id`,
          []
        )
      ),
    ])
      .then(([questionRows, linkRows]) => {
        setQuestions(questionRows);

        const map = new Map<number, { name: string; questionIds: number[] }>();
        for (const row of linkRows) {
          const existing = map.get(row.knowledge_id);
          if (existing) {
            if (!existing.questionIds.includes(row.question_id)) {
              existing.questionIds.push(row.question_id);
            }
          } else {
            map.set(row.knowledge_id, {
              name: row.name,
              questionIds: [row.question_id],
            });
          }
        }
        setKnowledgeMap(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentStudent]);

  const summary = getWeeklySummary(questions);
  const predictions = predictExamWeakPoints(questions, knowledgeMap).slice(0, 3);
  const distribution = calculateSubjectDistribution(questions);

  if (!currentStudent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <BarChart3 size={48} className="mb-4" />
        <p className="text-lg">请先在左侧选择一个学生</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">学习统计</h2>

      {loading ? (
        <div className="text-center text-gray-400 py-12">加载中...</div>
      ) : questions.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <BarChart3 size={48} className="mx-auto mb-4" />
          <p>暂无数据</p>
          <p className="text-sm mt-2">导入错题后将显示统计信息</p>
        </div>
      ) : (
        <>
          {/* Weekly Summary */}
          <div className="grid grid-cols-4 gap-4">
            <SummaryCard
              icon={<Calendar size={20} />}
              label="本周新增"
              value={String(summary.newQuestions)}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <SummaryCard
              icon={<CheckCircle2 size={20} />}
              label="已分析"
              value={String(summary.analyzedQuestions)}
              color="text-green-600"
              bg="bg-green-50"
            />
            <SummaryCard
              icon={<TrendingDown size={20} />}
              label="薄弱题"
              value={String(summary.weakPointCount)}
              color="text-red-600"
              bg="bg-red-50"
            />
            <SummaryCard
              icon={<TrendingUp size={20} />}
              label="已掌握"
              value={String(summary.masteredPointCount)}
              color="text-green-600"
              bg="bg-green-50"
            />
          </div>

          {/* Subject Distribution */}
          {distribution.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                学科分布
              </h3>
              <div className="space-y-4">
                {distribution.map((d) => (
                  <div key={d.subject}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">
                        {d.subject === "math" ? "数学" : "物理"}
                      </span>
                      <span className="text-sm text-gray-500">
                        {d.count} 道 · 平均掌握度 {d.avgMastery}%
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          d.avgMastery < 30
                            ? "bg-red-400"
                            : d.avgMastery < 70
                              ? "bg-amber-400"
                              : "bg-green-400"
                        }`}
                        style={{ width: `${d.avgMastery}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exam Prediction */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Target size={20} className="text-primary-600" />
              <h3 className="text-lg font-medium text-gray-800">
                考试风险预测
              </h3>
              <span className="text-xs text-gray-400 ml-2">
                基于当前错题分布
              </span>
            </div>

            {predictions.length === 0 ? (
              <p className="text-sm text-gray-400">
                暂无足够数据生成预测，请先分析错题并关联知识点
              </p>
            ) : (
              <div className="space-y-3">
                {predictions.map((p, idx) => (
                  <div
                    key={p.knowledgeName}
                    className="flex items-center gap-4 p-3 rounded-lg bg-gray-50"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        idx === 0
                          ? "bg-red-100 text-red-600"
                          : idx === 1
                            ? "bg-amber-100 text-amber-600"
                            : "bg-yellow-100 text-yellow-600"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">
                          {p.knowledgeName}
                        </span>
                        <RiskBadge risk={p.risk} />
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {p.questionCount} 道错题 · 平均掌握度 {p.avgMastery}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <BookOpen size={24} className="mx-auto mb-2 text-primary-500" />
              <div className="text-2xl font-bold text-gray-800">
                {questions.length}
              </div>
              <div className="text-sm text-gray-500">累计错题</div>
            </div>
            <div className="card text-center">
              <CheckCircle2
                size={24}
                className="mx-auto mb-2 text-green-500"
              />
              <div className="text-2xl font-bold text-gray-800">
                {questions.filter((q) => q.error_cause).length}
              </div>
              <div className="text-sm text-gray-500">已分析</div>
            </div>
            <div className="card text-center">
              <AlertTriangle
                size={24}
                className="mx-auto mb-2 text-red-500"
              />
              <div className="text-2xl font-bold text-gray-800">
                {
                  questions.filter(
                    (q) => q.error_cause && q.mastery_score < 30
                  ).length
                }
              </div>
              <div className="text-sm text-gray-500">待攻克</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="card">
      <div className={`inline-flex p-2 rounded-lg ${bg} ${color} mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: "high" | "medium" | "low" }) {
  const config = {
    high: { label: "高风险", class: "bg-red-100 text-red-600" },
    medium: { label: "中风险", class: "bg-amber-100 text-amber-600" },
    low: { label: "低风险", class: "bg-green-100 text-green-600" },
  };
  const c = config[risk];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.class}`}>
      {c.label}
    </span>
  );
}
