import { useState, useCallback, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { getDb } from "../../lib/db";
import { buildPracticeSheet, formatForPrint } from "../../lib/practiceSheet";
import type { Question, Subject, PracticeMode } from "../../types";
import {
  BookOpen,
  Printer,
  FileText,
  ClipboardList,
  CheckSquare,
  Square,
  Filter,
} from "lucide-react";

function subjectLabel(s: Subject): string {
  return s === "math" ? "数学" : "物理";
}

export default function PracticePage() {
  const { currentStudent } = useApp();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<PracticeMode>("questions_only");
  const [filterSubject, setFilterSubject] = useState<Subject | "all">("all");

  // Load questions
  useEffect(() => {
    if (!currentStudent) return;
    setLoading(true);
    getDb()
      .then((db) =>
        db.select<Question[]>(
          "SELECT * FROM questions WHERE student_id = $1 ORDER BY created_at DESC",
          [currentStudent.id]
        )
      )
      .then((data) => {
        setQuestions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentStudent]);

  const filteredQuestions = questions.filter((q) =>
    filterSubject === "all" ? true : q.subject === filterSubject
  );

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredQuestions.length) return new Set();
      return new Set(filteredQuestions.map((q) => q.id));
    });
  }, [filteredQuestions]);

  const handleGenerate = useCallback(async () => {
    if (!currentStudent || selectedIds.size === 0) return;

    const selectedQuestions = questions.filter((q) => selectedIds.has(q.id));

    // Build knowledge map
    const db = await getDb();
    const knowledgeMap = new Map<number, string[]>();
    for (const q of selectedQuestions) {
      const rows = await db.select<{ name: string }[]>(
        `SELECT kn.name
         FROM question_knowledge qk
         JOIN knowledge_nodes kn ON qk.knowledge_id = kn.id
         WHERE qk.question_id = $1`,
        [q.id]
      );
      knowledgeMap.set(q.id, rows.map((r) => r.name));
    }

    const sheet = buildPracticeSheet(
      selectedQuestions,
      mode,
      knowledgeMap
    );
    const html = formatForPrint(sheet, currentStudent.name);

    // Open print window
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      // Auto-print after a short delay for styles to load
      setTimeout(() => printWindow.print(), 500);
    }
  }, [currentStudent, selectedIds, questions, mode]);

  if (!currentStudent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <BookOpen size={48} className="mb-4" />
        <p className="text-lg">请先在左侧选择一个学生</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">生成练习卷</h2>
          <p className="text-sm text-gray-500 mt-1">
            已选择 {selectedIds.size} 道错题
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setMode("questions_only")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                mode === "questions_only"
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <FileText size={14} />
              仅原题
            </button>
            <button
              onClick={() => setMode("full_analysis")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                mode === "full_analysis"
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <ClipboardList size={14} />
              完整分析
            </button>
          </div>

          {/* Subject filter */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={filterSubject}
              onChange={(e) =>
                setFilterSubject(e.target.value as Subject | "all")
              }
              className="text-sm outline-none bg-transparent"
            >
              <option value="all">全部</option>
              <option value="math">数学</option>
              <option value="physics">物理</option>
            </select>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={selectedIds.size === 0}
            className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={14} />
            生成并打印
          </button>
        </div>
      </div>

      {/* Mode description */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4 text-sm text-gray-600 shrink-0">
        {mode === "questions_only" ? (
          <>
            <span className="font-medium">仅原题模式:</span> 每道题底部预留笔记区，适合裁剪贴到错题本。不包含答案和解析。
          </>
        ) : (
          <>
            <span className="font-medium">完整分析模式:</span> 包含原题、正确答案、错因分析、知识点标签，适合复习归档。
          </>
        )}
      </div>

      {/* Question list */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 z-10">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            {selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0 ? (
              <CheckSquare size={16} className="text-primary-600" />
            ) : (
              <Square size={16} />
            )}
            全选
          </button>
          <span className="text-sm text-gray-400">
            {filteredQuestions.length} 道错题
          </span>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-12">加载中...</div>
        ) : filteredQuestions.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <BookOpen size={48} className="mx-auto mb-4" />
            <p>暂无错题</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredQuestions.map((q) => (
              <div
                key={q.id}
                onClick={() => toggleSelect(q.id)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  selectedIds.has(q.id)
                    ? "bg-primary-50"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {selectedIds.has(q.id) ? (
                    <CheckSquare size={18} className="text-primary-600" />
                  ) : (
                    <Square size={18} className="text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        q.subject === "math"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-green-50 text-green-600"
                      }`}
                    >
                      {subjectLabel(q.subject)}
                    </span>
                    <span className="text-xs text-gray-400">{q.chapter}</span>
                    {q.error_cause && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                        {q.error_cause === "concept"
                          ? "概念不清"
                          : q.error_cause === "calculation"
                            ? "计算错误"
                            : q.error_cause === "careless"
                              ? "粗心"
                              : q.error_cause === "misread"
                                ? "审题失误"
                                : "完全不会"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{q.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
