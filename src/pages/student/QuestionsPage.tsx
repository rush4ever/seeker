import { useState, useRef, useCallback, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useQuestions } from "../../hooks/useQuestions";
import {
  useQuestionAnalysis,
  errorCauseLabel,
  difficultyLabel,
} from "../../hooks/useQuestionAnalysis";
import { parseWordDocument } from "../../lib/wordParser";
import { getDb } from "../../lib/db";
import type { Question, Subject } from "../../types";
import {
  FileUp,
  Filter,
  Trash2,
  BookOpen,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

function subjectLabel(s: Subject): string {
  return s === "math" ? "数学" : "物理";
}

function typeLabel(t: string): string {
  return t === "objective" ? "客观题" : "主观题";
}

export default function QuestionsPage() {
  const { currentStudent } = useApp();
  const { questions, loading, addQuestions, remove, refresh } =
    useQuestions(currentStudent?.id);
  const [importing, setImporting] = useState(false);
  const [filterSubject, setFilterSubject] = useState<Subject | "all">("all");
  const [analyzingIds, setAnalyzingIds] = useState<Set<number>>(new Set());
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    ollamaAvailable,
    modelName,
    error: analysisError,
    checkOllama,
    analyzeSingle,
  } = useQuestionAnalysis();

  // Check Ollama on mount
  useEffect(() => {
    checkOllama();
  }, [checkOllama]);

  const filteredQuestions = questions.filter((q) =>
    filterSubject === "all" ? true : q.subject === filterSubject
  );

  const unanalyzedQuestions = filteredQuestions.filter(
    (q) => !q.error_cause || !q.difficulty
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentStudent) return;

      setImporting(true);
      try {
        const result = await parseWordDocument(file);
        const subject: Subject = file.name.includes("物理") ? "physics" : "math";

        const newQuestions = result.questions.map((q) => ({
          student_id: currentStudent.id,
          subject,
          source_type: "word_import" as const,
          source_file: file.name,
          number_in_source: q.number,
          question_type: q.type,
          chapter: q.chapter,
          answer_date: q.answerDate,
          content: q.content,
          content_images: null,
          student_answer: null,
          correct_answer: q.correctAnswer,
          error_cause: null,
          difficulty: null,
          mastery_score: 0,
          status: "active" as const,
        }));

        await addQuestions(newQuestions);
      } catch (err) {
        alert(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [currentStudent, addQuestions]
  );

  const handleAnalyze = useCallback(
    async (question: Question) => {
      setAnalyzingIds((prev) => new Set(prev).add(question.id));
      try {
        const ok = await analyzeSingle(question);
        if (ok) await refresh();
      } finally {
        setAnalyzingIds((prev) => {
          const next = new Set(prev);
          next.delete(question.id);
          return next;
        });
      }
    },
    [analyzeSingle, refresh]
  );

  const handleBatchAnalyze = useCallback(async () => {
    if (unanalyzedQuestions.length === 0) return;

    setBatchProgress({ current: 0, total: unanalyzedQuestions.length });

    const status = await checkOllama();
    if (!status.available) {
      setBatchProgress(null);
      return;
    }

    const allNodes = (
      await (await getDb()).select<{ id: number; name: string }[]>(
        "SELECT id, name FROM knowledge_nodes"
      )
    ).filter((n) => n.name !== "数学" && n.name !== "物理");

    let success = 0;
    let failed = 0;

    for (let i = 0; i < unanalyzedQuestions.length; i++) {
      setBatchProgress({ current: i + 1, total: unanalyzedQuestions.length });
      const q = unanalyzedQuestions[i];
      try {
        const { analyzeQuestion } = await import("../../lib/ollama");
        const result = await analyzeQuestion(
          q.content,
          allNodes,
          status.model
        );

        // Match knowledge points
        const matchedIds: number[] = [];
        const allNodeList = (
          await (await getDb()).select<{ id: number; name: string }[]>(
            "SELECT id, name FROM knowledge_nodes"
          )
        ).filter((n) => n.name !== "数学" && n.name !== "物理");

        for (const kpName of result.knowledgePoints) {
          const match = allNodeList.find(
            (n) =>
              n.name === kpName ||
              kpName.includes(n.name) ||
              n.name.includes(kpName)
          );
          if (match && !matchedIds.includes(match.id)) {
            matchedIds.push(match.id);
          }
        }

        if (matchedIds.length === 0 && q.chapter) {
          const cm = allNodeList.find((n) => q.chapter!.includes(n.name));
          if (cm) matchedIds.push(cm.id);
        }

        const db = await getDb();
        await db.execute(
          `UPDATE questions SET error_cause = $1, difficulty = $2, updated_at = datetime('now') WHERE id = $3`,
          [result.errorCause, result.difficulty, q.id]
        );
        for (const kid of matchedIds) {
          await db.execute(
            `INSERT OR IGNORE INTO question_knowledge (question_id, knowledge_id, confidence) VALUES ($1, $2, 0.8)`,
            [q.id, kid]
          );
        }
        success++;
      } catch {
        failed++;
      }
    }

    setBatchProgress(null);
    await refresh();

    if (failed > 0) {
      alert(`批量分析完成: ${success} 成功, ${failed} 失败`);
    }
  }, [unanalyzedQuestions, checkOllama, refresh]);

  if (!currentStudent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <BookOpen size={48} className="mb-4" />
        <p className="text-lg">请先在左侧选择一个学生</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            错题本 ({filteredQuestions.length} 道)
          </h2>
          {unanalyzedQuestions.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {unanalyzedQuestions.length} 道待 AI 分析
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Ollama status */}
          <div className="flex items-center gap-1.5 text-xs">
            {ollamaAvailable === null ? (
              <Loader2 size={12} className="animate-spin text-gray-400" />
            ) : ollamaAvailable ? (
              <>
                <CheckCircle2 size={12} className="text-green-500" />
                <span className="text-green-600">{modelName}</span>
              </>
            ) : (
              <>
                <AlertCircle size={12} className="text-red-500" />
                <span className="text-red-500">Ollama 未连接</span>
              </>
            )}
          </div>

          {/* Subject filter */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
            <Filter size={16} className="text-gray-400" />
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

          {/* Batch analyze */}
          {unanalyzedQuestions.length > 0 && (
            <button
              onClick={handleBatchAnalyze}
              disabled={!!batchProgress || !ollamaAvailable}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {batchProgress ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {batchProgress.current}/{batchProgress.total}
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  批量分析 ({unanalyzedQuestions.length})
                </>
              )}
            </button>
          )}

          {/* Import button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <FileUp size={14} />
            {importing ? "导入中..." : "导入 Word"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Analysis error */}
      {analysisError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} />
          {analysisError}
        </div>
      )}

      {/* Question list */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">加载中...</div>
      ) : filteredQuestions.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <BookOpen size={48} className="mx-auto mb-4" />
          <p>暂无错题</p>
          <p className="text-sm mt-2">点击"导入 Word"按钮导入错题文档</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              onDelete={remove}
              onAnalyze={handleAnalyze}
              isAnalyzing={analyzingIds.has(q.id)}
              ollamaAvailable={ollamaAvailable === true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  onDelete,
  onAnalyze,
  isAnalyzing,
  ollamaAvailable,
}: {
  question: Question;
  onDelete: (id: number) => void;
  onAnalyze: (q: Question) => void;
  isAnalyzing: boolean;
  ollamaAvailable: boolean;
}) {
  const isAnalyzed = !!question.error_cause && !!question.difficulty;

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Tags row */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                question.subject === "math"
                  ? "bg-blue-50 text-blue-600"
                  : "bg-green-50 text-green-600"
              }`}
            >
              {subjectLabel(question.subject)}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
              {typeLabel(question.question_type)}
            </span>
            <span className="text-xs text-gray-400">{question.chapter}</span>

            {/* Analysis badges */}
            {isAnalyzed && (
              <>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    question.error_cause === "concept" ||
                    question.error_cause === "unknown"
                      ? "bg-red-50 text-red-600"
                      : question.error_cause === "calculation" ||
                        question.error_cause === "misread"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-yellow-50 text-yellow-600"
                  }`}
                >
                  {errorCauseLabel(question.error_cause)}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-600">
                  {difficultyLabel(question.difficulty)}
                </span>
              </>
            )}
          </div>

          {/* Content */}
          <p className="text-gray-800 line-clamp-2">{question.content}</p>

          {/* Answer */}
          {question.correct_answer && (
            <p className="text-sm text-green-600 mt-2">
              答案: {question.correct_answer}
            </p>
          )}

          {/* Knowledge point tags */}
          <KnowledgeTags questionId={question.id} />
        </div>

        {/* Actions */}
        <div className="flex items-start gap-1 ml-4 shrink-0">
          {!isAnalyzed && (
            <button
              onClick={() => onAnalyze(question)}
              disabled={isAnalyzing || !ollamaAvailable}
              className="p-2 text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-40"
              title="AI 分析"
            >
              {isAnalyzing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
            </button>
          )}
          <button
            onClick={() => onDelete(question.id)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="删除"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function KnowledgeTags({ questionId }: { questionId: number }) {
  const [tags, setTags] = useState<{ name: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDb()
      .then((db) =>
        db.select<{ name: string }[]>(
          `SELECT kn.name
           FROM question_knowledge qk
           JOIN knowledge_nodes kn ON qk.knowledge_id = kn.id
           WHERE qk.question_id = $1`,
          [questionId]
        )
      )
      .then((data) => {
        if (!cancelled) {
          setTags(data);
          setLoaded(true);
        }
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  if (!loaded || tags.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      {tags.map((t) => (
        <span
          key={t.name}
          className="text-xs px-2 py-0.5 rounded-md bg-primary-50 text-primary-600 border border-primary-100"
        >
          {t.name}
        </span>
      ))}
    </div>
  );
}
