import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { useKnowledgeGraph } from "../../hooks/useKnowledgeGraph";
import KnowledgeTree from "../../components/graph/KnowledgeTree";
import type { KnowledgeTreeNode, Subject } from "../../types";
import { BookOpen, Brain, Filter, Dumbbell, Loader2 } from "lucide-react";
import ExportButtonGroup from "../../components/export/ExportButtonGroup";
import { getDb } from "../../lib/db";
import type { Question } from "../../types";
import { masteryTextClass, masteryBgClass, masteryColorHex, masteryLabel } from "../../lib/mastery";
import EmptyState from "../../components/common/EmptyState";

const SUBJECTS: { id: Subject; label: string }[] = [
  { id: "math", label: "数学" },
  { id: "physics", label: "物理" },
];

const GRADES = [
  { value: 8, label: "初二" },
  { value: 9, label: "初三" },
  { value: 10, label: "高一" },
  { value: 11, label: "高二" },
  { value: 12, label: "高三" },
];

const SEMESTERS = [
  { value: 1, label: "上册" },
  { value: 2, label: "下册" },
];

export default function GraphPage() {
  const { currentStudent } = useApp();
  const [subject, setSubject] = useState<Subject>("math");
  const [grade, setGrade] = useState<number | undefined>(
    currentStudent?.current_grade
  );
  const [semester, setSemester] = useState<number | undefined>(
    currentStudent?.current_semester
  );
  const [selectedNode, setSelectedNode] = useState<KnowledgeTreeNode | null>(
    null
  );

  const { tree, loading, error } = useKnowledgeGraph({
    studentId: currentStudent?.id,
    subject,
    grade,
    semester,
  });

  // Summary stats
  const leafNodes = flattenTree(tree).filter((n) => n.children.length === 0);
  const weakCount = leafNodes.filter(
    (n) => n.node.question_count > 0 && (n.node.avg_mastery ?? 0) < 30
  ).length;
  const mediumCount = leafNodes.filter(
    (n) =>
      n.node.question_count > 0 &&
      (n.node.avg_mastery ?? 0) >= 30 &&
      (n.node.avg_mastery ?? 0) < 70
  ).length;
  const masteredCount = leafNodes.filter(
    (n) => n.node.question_count > 0 && (n.node.avg_mastery ?? 0) >= 70
  ).length;
  const unlearnedCount = leafNodes.filter(
    (n) => n.node.question_count === 0
  ).length;

  if (!currentStudent) {
    return <EmptyState icon={Brain} message="请先在左侧选择一个学生" />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-xl font-semibold text-gray-800">知识图谱</h2>
        <div className="flex items-center gap-3">
          {/* Subject tabs */}
          <div className="flex bg-white rounded-lg border border-gray-200 overflow-hidden">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSubject(s.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  subject === s.id
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Grade filter */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={grade ?? ""}
              onChange={(e) =>
                setGrade(e.target.value ? Number(e.target.value) : undefined)
              }
              className="text-sm outline-none bg-transparent"
            >
              <option value="">全部年级</option>
              {GRADES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          {/* Semester filter */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
            <select
              value={semester ?? ""}
              onChange={(e) =>
                setSemester(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
              className="text-sm outline-none bg-transparent"
            >
              <option value="">全学期</option>
              {SEMESTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex gap-4 mb-4 shrink-0">
        <SummaryCard label="薄弱" count={weakCount} color="bg-red-500" />
        <SummaryCard label="一般" count={mediumCount} color="bg-amber-500" />
        <SummaryCard label="掌握" count={masteredCount} color="bg-green-500" />
        <SummaryCard label="未学习" count={unlearnedCount} color="bg-gray-400" />
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Tree panel */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              加载中...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              {error}
            </div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Brain size={48} className="mb-4" />
              <p>暂无知识点数据</p>
            </div>
          ) : (
            <div className="p-4">
              <KnowledgeTree
                tree={tree}
                selectedId={selectedNode?.node.id}
                onSelect={setSelectedNode}
              />
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="w-80 bg-white rounded-xl border border-gray-200 overflow-auto shrink-0">
          {selectedNode && currentStudent ? (
            <NodeDetail node={selectedNode} studentId={currentStudent.id} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
              <Brain size={48} className="mb-4" />
              <p>点击知识节点查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex-1 bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-gray-800">{count}</p>
      </div>
    </div>
  );
}

function collectLeafIds(node: KnowledgeTreeNode): number[] {
  if (node.children.length === 0) {
    return [node.node.id];
  }
  return node.children.flatMap(collectLeafIds);
}

async function fetchNodeQuestions(
  node: KnowledgeTreeNode,
  studentId: number
): Promise<Question[]> {
  const leafIds = collectLeafIds(node);
  if (leafIds.length === 0) return [];

  const placeholders = leafIds.map(() => '?').join(',');
  const db = await getDb();
  const rows = await db.select<Question[]>(
    `SELECT DISTINCT q.* FROM questions q
     JOIN question_knowledge qk ON q.id = qk.question_id
     WHERE qk.knowledge_id IN (${placeholders}) AND q.student_id = ?
     ORDER BY q.mastery_score ASC, q.created_at DESC
     LIMIT 30`,
    [...leafIds, studentId]
  );
  return rows;
}

function NodeDetail({ node, studentId }: { node: KnowledgeTreeNode; studentId: number }) {
  const { node: kn } = node;
  const mastery = kn.avg_mastery ?? 0;
  const hasQuestions = kn.question_count > 0;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGeneratePractice = async () => {
    setLoading(true);
    try {
      const qs = await fetchNodeQuestions(node, studentId);
      setQuestions(qs);
    } catch (err) {
      console.error("Failed to fetch questions:", err);
      alert("加载错题失败");
    } finally {
      setLoading(false);
    }
  };

  const colorClass = !hasQuestions ? "text-gray-500" : masteryTextClass(mastery);
  const bgClass = !hasQuestions ? "bg-gray-50" : masteryBgClass(mastery);
  const hexColor = !hasQuestions ? "#9ca3af" : masteryColorHex(mastery);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">{kn.name}</h3>
        <p className="text-sm text-gray-500 mt-1">
          {kn.grade === 0
            ? "全部年级"
            : `${["", "", "", "", "", "", "", "", "初二", "初三", "高一", "高二", "高三"][kn.grade] || ""}${kn.semester === 1 ? "上册" : kn.semester === 2 ? "下册" : ""}`}
        </p>
      </div>

      {/* Mastery card */}
      <div className={`rounded-lg p-4 ${bgClass}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">掌握度</span>
          <span className={`text-2xl font-bold ${colorClass}`}>
            {hasQuestions ? `${Math.round(mastery)}%` : "—"}
          </span>
        </div>
        {hasQuestions && (
          <div className="mt-2 h-2 bg-white/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${!hasQuestions ? "" : masteryTextClass(mastery).replace("text-", "bg-")}`}
              style={{ width: `${mastery}%`, backgroundColor: hasQuestions ? undefined : "#9ca3af" }}
            />
          </div>
        )}
      </div>

      {/* Question count */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <BookOpen size={16} />
        <span>关联错题: {kn.question_count} 道</span>
      </div>

      {/* Status badge */}
      <div>
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colorClass} bg-opacity-10`}
          style={{ backgroundColor: `${hexColor}20` }}
        >
          {!hasQuestions ? "未学习" : masteryLabel(mastery)}
        </span>
      </div>

      {/* Practice generation */}
      {hasQuestions && (
        <div className="pt-2 border-t border-gray-100 space-y-3">
          {!questions.length ? (
            <button
              onClick={handleGeneratePractice}
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Dumbbell size={14} />
              )}
              {loading ? "加载中..." : "针对此知识点练习"}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                已加载 <span className="font-medium">{questions.length}</span> 道关联错题
              </p>
              <ExportButtonGroup
                questions={questions}
                studentName=""
                mode="questions_only"
                title={`${kn.name}专项练习`}
              />
              <button
                onClick={() => setQuestions([])}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-1"
              >
                重新加载
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sub-nodes list if any */}
      {node.children.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-2">包含知识点</p>
          <div className="space-y-1">
            {node.children.map((child) => (
              <div
                key={child.node.id}
                className="flex items-center justify-between text-sm px-2 py-1 rounded hover:bg-gray-50"
              >
                <span className="text-gray-600">{child.node.name}</span>
                {child.node.question_count > 0 && (
                  <span className="text-xs text-gray-400">
                    {child.node.question_count}道
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function flattenTree(tree: KnowledgeTreeNode[]): KnowledgeTreeNode[] {
  const result: KnowledgeTreeNode[] = [];
  for (const node of tree) {
    result.push(node);
    result.push(...flattenTree(node.children));
  }
  return result;
}
