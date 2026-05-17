import { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { getDb } from "../../lib/db";
import { getWeakestKnowledgePoints, type KnowledgeStat } from "../../lib/scheduler";
import { buildQuickPracticeTitle, formatWeakPointNames } from "../../lib/quickPractice";
import type { Question } from "../../types";
import ExportButtonGroup from "../../components/export/ExportButtonGroup";
import { Target, BookOpen, Brain, ArrowRight, TrendingUp, Loader2 } from "lucide-react";
import { masteryTextClass, masteryBarClass } from "../../lib/mastery";
import EmptyState from "../../components/common/EmptyState";

export default function HomePage() {
  const { currentStudent, setActivePage } = useApp();
  const [weakPoints, setWeakPoints] = useState<KnowledgeStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [practiceQuestions, setPracticeQuestions] = useState<Question[]>([]);
  const [practiceLoading, setPracticeLoading] = useState(false);

  useEffect(() => {
    if (!currentStudent) return;

    setLoading(true);
    getDb()
      .then((db) =>
        db.select<{ id: number; name: string; subject: string; avg_mastery: number; question_count: number }[]>(
          `SELECT
             kn.id,
             kn.name,
             kn.subject,
             AVG(q.mastery_score) as avg_mastery,
             COUNT(*) as question_count
           FROM knowledge_nodes kn
           JOIN question_knowledge qk ON kn.id = qk.knowledge_id
           JOIN questions q ON qk.question_id = q.id
           WHERE q.student_id = $1
             AND kn.parent_id IS NOT NULL
             AND kn.name NOT IN ('数学', '物理')
           GROUP BY kn.id
           ORDER BY avg_mastery ASC
           LIMIT 6`,
          [currentStudent.id]
        )
      )
      .then((rows) => {
        const stats: KnowledgeStat[] = rows.map((r) => ({
          knowledgeId: r.id,
          name: r.name,
          avgMastery: Math.round(r.avg_mastery),
          questionCount: r.question_count,
        }));
        setWeakPoints(getWeakestKnowledgePoints(stats, 3));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Load summary stats
    getDb()
      .then((db) =>
        db.select<{ total: number; analyzed: number }[]>(
          `SELECT
             COUNT(*) as total,
             SUM(CASE WHEN error_cause IS NOT NULL THEN 1 ELSE 0 END) as analyzed
           FROM questions WHERE student_id = $1`,
          [currentStudent.id]
        )
      )
      .then((rows) => {
        setTotalQuestions(rows[0]?.total ?? 0);
        setAnalyzedCount(rows[0]?.analyzed ?? 0);
      })
      .catch(() => {});
  }, [currentStudent]);

  const handleQuickPractice = useCallback(async () => {
    if (!currentStudent || weakPoints.length === 0) return;

    setPracticeLoading(true);
    try {
      const db = await getDb();
      const weakIds = weakPoints.map((p) => p.knowledgeId);
      const questions = await db.select<Question[]>(
        `SELECT DISTINCT q.*
         FROM questions q
         JOIN question_knowledge qk ON q.id = qk.question_id
         WHERE q.student_id = $1 AND qk.knowledge_id IN (${weakIds.map(() => "?").join(",")})
         ORDER BY q.mastery_score ASC
         LIMIT 6`,
        [currentStudent.id, ...weakIds]
      );
      setPracticeQuestions(questions);
    } catch (err) {
      console.error("Quick practice failed:", err);
      alert("加载快练题目失败");
    } finally {
      setPracticeLoading(false);
    }
  }, [currentStudent, weakPoints]);

  if (!currentStudent) {
    return <EmptyState icon={BookOpen} message="请在左侧选择一个学生" />;
  }

  return (
    <div className="space-y-6">
      {/* Quick Practice Card */}
      <div className="card bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-primary-800 mb-2">
              今日薄弱点快练
            </h2>
            <p className="text-primary-600 mb-4">
              {weakPoints.length > 0
                ? `基于你的错题分析，今天有 ${weakPoints.length} 个知识点需要巩固`
                : "暂无薄弱知识点数据，先导入并分析一些错题吧"}
            </p>
            {!practiceQuestions.length ? (
              <button
                onClick={handleQuickPractice}
                disabled={weakPoints.length === 0 || practiceLoading}
                className="btn-primary text-lg px-8 py-4 disabled:opacity-50"
              >
                {practiceLoading ? (
                  <Loader2 size={20} className="inline mr-2 animate-spin" />
                ) : (
                  <Target size={20} className="inline mr-2" />
                )}
                {practiceLoading ? "加载中..." : "开始 5 分钟快练"}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-primary-700">
                  已加载 <span className="font-medium">{practiceQuestions.length}</span> 道关联错题
                  {practiceQuestions.length > 0 && (
                    <span className="text-xs ml-1">
                      ({formatWeakPointNames(weakPoints)})
                    </span>
                  )}
                </p>
                <ExportButtonGroup
                  questions={practiceQuestions}
                  studentName={currentStudent?.name ?? ""}
                  mode="questions_only"
                  title={buildQuickPracticeTitle(weakPoints)}
                />
                <button
                  onClick={() => setPracticeQuestions([])}
                  className="text-sm text-primary-600 hover:text-primary-800 underline"
                >
                  重新选择
                </button>
              </div>
            )}
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-3xl font-bold text-primary-700">{totalQuestions}</div>
            <div className="text-sm text-primary-600">累计错题</div>
            <div className="text-lg font-semibold text-primary-700 mt-2">{analyzedCount}</div>
            <div className="text-sm text-primary-600">已分析</div>
          </div>
        </div>
      </div>

      {/* Weak Knowledge Points */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3">薄弱知识点 Top 3</h3>
        {loading ? (
          <div className="text-center text-gray-400 py-8">加载中...</div>
        ) : weakPoints.length === 0 ? (
          <div className="card text-center py-8 text-gray-400">
            <TrendingUp size={32} className="mx-auto mb-2" />
            <p>暂无薄弱知识点数据</p>
            <p className="text-sm mt-1">导入错题并完成 AI 分析后将在此显示</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {weakPoints.map((point) => (
              <div key={point.knowledgeId} className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">
                    {point.questionCount} 道错题
                  </span>
                  <span className={`text-sm font-medium ${masteryTextClass(point.avgMastery)}`}>
                    {point.avgMastery}%
                  </span>
                </div>
                <p className="font-medium text-gray-800">{point.name}</p>
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${masteryBarClass(point.avgMastery)}`}
                    style={{ width: `${point.avgMastery}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge Graph Link */}
      <div
        className="card cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setActivePage("graph")}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-800">知识图谱</h3>
          <ArrowRight size={18} className="text-gray-400" />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              查看完整的知识点掌握情况，红色表示薄弱，绿色表示掌握。
            </p>
          </div>
          <Brain size={48} className="text-primary-200 shrink-0" />
        </div>
      </div>
    </div>
  );
}
