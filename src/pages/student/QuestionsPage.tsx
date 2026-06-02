import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { useQuestions } from "../../hooks/useQuestions";
import {
  useQuestionAnalysis,
  errorCauseLabel,
  difficultyLabel,
} from "../../hooks/useQuestionAnalysis";
import { parseWordDocument, type ParseProgress } from "../../lib/wordParser";
import { getDb } from "../../lib/db";
import { useSimilarQuestions } from "../../hooks/useSimilarQuestions";
import { updateMastery, checkGraduationStatus, masteryBarClass } from "../../lib/mastery";
import type { Question, Subject, SimilarQuestion } from "../../types";
import EmptyState from "../../components/common/EmptyState";
import {
  FileUp,
  Filter,
  Trash2,
  BookOpen,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Wand2,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
} from "lucide-react";
import ExportButtonGroup from "../../components/export/ExportButtonGroup";
import ManualAddQuestionForm from "../../components/question/ManualAddQuestionForm";

function subjectLabel(s: Subject): string {
  return s === "math" ? "数学" : "物理";
}

function typeLabel(t: string): string {
  return t === "objective" ? "客观题" : "主观题";
}

function arrayBufferToBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.byteLength; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

export default function QuestionsPage() {
  const { currentStudent } = useApp();
  const { questions, loading, addQuestions, remove, refresh } =
    useQuestions(currentStudent?.id);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ParseProgress | null>(null);
  const [filterSubject, setFilterSubject] = useState<Subject | "all">("all");
  const [analyzingIds, setAnalyzingIds] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import confirmation dialog state
  const [pendingImport, setPendingImport] = useState<{
    fileName: string;
    parsedQuestions: Awaited<ReturnType<typeof parseWordDocument>>["questions"];
    subject: Subject;
  } | null>(null);

  const {
    ollamaAvailable,
    modelName,
    error: analysisError,
    checkOllama,
    analyzeSingle,
  } = useQuestionAnalysis();

  const {
    generatingForId,
    error: similarError,
    generate: generateSimilar,
  } = useSimilarQuestions();

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
      setImportProgress(null);
      try {
        const result = await parseWordDocument(file, (progress) => {
          setImportProgress(progress);
        });
        const guessedSubject: Subject = file.name.includes("物理") ? "physics" : "math";

        setPendingImport({
          fileName: file.name,
          parsedQuestions: result.questions,
          subject: guessedSubject,
        });
      } catch (err) {
        alert(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setImporting(false);
        setImportProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [currentStudent]
  );

  const handleConfirmImport = useCallback(async () => {
    if (!pendingImport || !currentStudent) return;

    setImporting(true);
    try {
      const newQuestions = pendingImport.parsedQuestions.map((q) => {
        // Serialize images to base64 for database storage
        const contentImages = q.images.length > 0
          ? JSON.stringify(
              q.images.map((img) => ({
                name: img.name,
                data: arrayBufferToBase64(img.data),
                mimeType: img.mimeType,
                description: img.description,
              }))
            )
          : null;

        return {
          student_id: currentStudent.id,
          subject: pendingImport.subject,
          source_type: "word_import" as const,
          source_file: pendingImport.fileName,
          number_in_source: q.number,
          question_type: q.type,
          chapter: q.chapter,
          answer_date: q.answerDate,
          content: q.content,
          content_html: q.contentHtml,
          content_images: contentImages,
          student_answer: null,
          correct_answer: q.correctAnswer,
          error_cause: null,
          difficulty: null,
          mastery_score: 0,
          status: "active" as const,
        };
      });

      await addQuestions(newQuestions);
      setPendingImport(null);
    } catch (err) {
      alert(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }, [pendingImport, currentStudent, addQuestions]);

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

  const handleGenerateSimilar = useCallback(
    async (question: Question) => {
      await generateSimilar(question, 2);
      await refresh();
    },
    [generateSimilar, refresh]
  );

  const handleMarkResult = useCallback(
    async (question: Question, isCorrect: boolean) => {
      const newMastery = updateMastery(question.mastery_score, isCorrect);
      const newStatus = checkGraduationStatus(newMastery);

      const db = await getDb();
      await db.execute(
        `UPDATE questions SET mastery_score = $1, status = $2, updated_at = datetime('now') WHERE id = $3`,
        [newMastery, newStatus, question.id]
      );

      // Record to mastery_history
      await db.execute(
        `INSERT INTO mastery_history (student_id, knowledge_id, score, recorded_at)
         SELECT $1, qk.knowledge_id, $2, datetime('now')
         FROM question_knowledge qk
         WHERE qk.question_id = $3`,
        [question.student_id, newMastery, question.id]
      );

      await refresh();
    },
    [refresh]
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
    const concurrency = 3;

    for (let i = 0; i < unanalyzedQuestions.length; i += concurrency) {
      const batch = unanalyzedQuestions.slice(i, i + concurrency);
      const batchOffset = i;

      await Promise.all(
        batch.map(async (q, idx) => {
          const overallIdx = batchOffset + idx;
          setBatchProgress({ current: overallIdx + 1, total: unanalyzedQuestions.length });

          try {
            const { analyzeQuestion } = await import("../../lib/ollama");
            const result = await analyzeQuestion(q.content, allNodes, status.model);

            const matchedIds: number[] = [];
            for (const kpName of result.knowledgePoints) {
              const match = allNodes.find(
                (n) => n.name === kpName || kpName.includes(n.name) || n.name.includes(kpName)
              );
              if (match && !matchedIds.includes(match.id)) {
                matchedIds.push(match.id);
              }
            }

            if (matchedIds.length === 0 && q.chapter) {
              const cm = allNodes.find((n) => q.chapter!.includes(n.name));
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
        })
      );
    }

    setBatchProgress(null);
    await refresh();

    if (failed > 0) {
      alert(`批量分析完成: ${success} 成功, ${failed} 失败`);
    }
  }, [unanalyzedQuestions, checkOllama, refresh]);

  if (!currentStudent) {
    return <EmptyState icon={BookOpen} message="请先在左侧选择一个学生" />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-notion-text">
            错题本 ({filteredQuestions.length} 道)
          </h2>
          {unanalyzedQuestions.length > 0 && (
            <p className="text-sm text-notion-muted mt-1">
              {unanalyzedQuestions.length} 道待 AI 分析
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Ollama status */}
          <div className="flex items-center gap-1.5 text-xs">
            {ollamaAvailable === null ? (
              <Loader2 size={12} className="animate-spin text-notion-subtle" />
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
          <div className="flex items-center gap-2 bg-white rounded-notion border border-notion-border px-3 py-2">
            <Filter size={16} className="text-notion-subtle" />
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
              className="notion-btn-primary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* Export button */}
          {filteredQuestions.length > 0 && currentStudent && (
            <ExportButtonGroup
              questions={filteredQuestions}
              studentName={currentStudent.name}
              mode="full_analysis"
              title={`${filterSubject === "all" ? "全部" : subjectLabel(filterSubject)}错题集`}
            />
          )}

          {/* Import button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="notion-btn-ghost flex items-center gap-2 text-sm disabled:opacity-60"
          >
            {importing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {importProgress
                  ? `${importProgress.current}/${importProgress.total} ${importProgress.message}`
                  : "导入中..."}
              </>
            ) : (
              <>
                <FileUp size={14} />
                导入 Word
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Manual add button */}
          <button
            onClick={() => setAdding((s) => !s)}
            className="notion-btn-ghost flex items-center gap-2 text-sm"
          >
            <Plus size={14} />
            {adding ? "收起" : "添加"}
          </button>
        </div>
      </div>

      {/* Manual add form */}
      {adding && currentStudent && (
        <ManualAddQuestionForm
          studentId={currentStudent.id}
          onClose={() => setAdding(false)}
          onAdded={() => refresh()}
        />
      )}

      {/* Errors */}
      {(analysisError || similarError) && (
        <div className="bg-red-50 border border-red-200 rounded-notion px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle size={16} />
          {analysisError || similarError}
        </div>
      )}

      {/* Question list */}
      {loading ? (
        <div className="text-center text-notion-subtle py-12">加载中...</div>
      ) : filteredQuestions.length === 0 ? (
        <div className="notion-card text-center py-12 text-notion-subtle">
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
              onGenerateSimilar={handleGenerateSimilar}
              onMarkResult={handleMarkResult}
              isAnalyzing={analyzingIds.has(q.id)}
              isGeneratingSimilar={generatingForId === q.id}
              ollamaAvailable={ollamaAvailable === true}
            />
          ))}
        </div>
      )}

      {/* Import confirmation dialog */}
      {pendingImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-notion p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold text-notion-text mb-4">确认导入</h3>
            <p className="text-sm text-notion-muted mb-4">
              文件: <span className="font-medium">{pendingImport.fileName}</span>
              <br />
              共解析出 <span className="font-medium">{pendingImport.parsedQuestions.length}</span> 道错题
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-notion-text mb-2">学科</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingImport({ ...pendingImport, subject: "math" })}
                  className={`flex-1 py-2 rounded-notion border text-sm font-medium transition-colors ${
                    pendingImport.subject === "math"
                      ? "bg-notion-accent-bg border-primary-300 text-notion-text"
                      : "border-notion-border text-notion-muted hover:bg-notion-surface"
                  }`}
                >
                  数学
                </button>
                <button
                  onClick={() => setPendingImport({ ...pendingImport, subject: "physics" })}
                  className={`flex-1 py-2 rounded-notion border text-sm font-medium transition-colors ${
                    pendingImport.subject === "physics"
                      ? "bg-notion-accent-bg border-primary-300 text-notion-text"
                      : "border-notion-border text-notion-muted hover:bg-notion-surface"
                  }`}
                >
                  物理
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmImport}
                disabled={importing}
                className="notion-btn-primary flex-1 text-sm disabled:opacity-50"
              >
                {importing ? "导入中..." : "确认导入"}
              </button>
              <button
                onClick={() => setPendingImport(null)}
                disabled={importing}
                className="notion-btn-ghost flex-1 text-sm disabled:opacity-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  onDelete,
  onAnalyze,
  onGenerateSimilar,
  onMarkResult,
  isAnalyzing,
  isGeneratingSimilar,
  ollamaAvailable,
}: {
  question: Question;
  onDelete: (id: number) => void;
  onAnalyze: (q: Question) => void;
  onGenerateSimilar: (q: Question) => void;
  onMarkResult: (q: Question, isCorrect: boolean) => void;
  isAnalyzing: boolean;
  isGeneratingSimilar: boolean;
  ollamaAvailable: boolean;
}) {
  const isAnalyzed = !!question.error_cause && !!question.difficulty;
  const [showSimilar, setShowSimilar] = useState(false);
  const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>([]);
  const [similarLoaded, setSimilarLoaded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const contentImages = useMemo(() => {
    if (!question.content_images) return [];
    try {
      const parsed = JSON.parse(question.content_images) as {
        name: string;
        data: string;
        mimeType: string;
        description: string;
      }[];
      return parsed;
    } catch {
      return [];
    }
  }, [question.content_images]);

  useEffect(() => {
    if (!showSimilar || similarLoaded) return;
    getDb()
      .then((db) =>
        db.select<{ similar_questions: string | null }[]>(
          `SELECT similar_questions FROM questions WHERE id = $1`,
          [question.id]
        )
      )
      .then((rows) => {
        if (rows[0]?.similar_questions) {
          try {
            setSimilarQuestions(JSON.parse(rows[0].similar_questions));
          } catch {
            setSimilarQuestions([]);
          }
        }
        setSimilarLoaded(true);
      })
      .catch(() => setSimilarLoaded(true));
  }, [showSimilar, similarLoaded, question.id]);

  const handleGenerate = useCallback(async () => {
    await onGenerateSimilar(question);
    setSimilarLoaded(false);
    setShowSimilar(true);
  }, [onGenerateSimilar, question]);

  return (
    <div className="notion-card hover:shadow-md transition-shadow">
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
            <span className="text-xs px-2 py-1 rounded-full bg-notion-surface text-notion-muted">
              {typeLabel(question.question_type)}
            </span>
            <span className="text-xs text-notion-subtle">{question.chapter}</span>

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
            {question.status === "graduated" && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600 font-medium">
                已毕业
              </span>
            )}
          </div>

          {/* Content */}
          {question.content_html ? (
            <div
              className="text-notion-text line-clamp-2 cursor-pointer"
              onClick={() => setShowDetail(true)}
              dangerouslySetInnerHTML={{ __html: question.content_html }}
            />
          ) : (
            <p
              className="text-notion-text line-clamp-2 cursor-pointer whitespace-pre-wrap"
              onClick={() => setShowDetail(true)}
            >
              {question.content}
            </p>
          )}

          {/* Answer & Mastery */}
          {question.correct_answer && (
            <p className="text-sm text-green-600 mt-2">
              答案: {question.correct_answer}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-notion-muted">掌握度</span>
            <div className="flex-1 h-1.5 bg-notion-surface rounded-full overflow-hidden max-w-[120px]">
              <div
                className={`h-full rounded-full transition-all ${masteryBarClass(question.mastery_score)}`}
                style={{ width: `${question.mastery_score}%` }}
              />
            </div>
            <span className="text-xs font-medium text-notion-muted">
              {Math.round(question.mastery_score)}%
            </span>
          </div>

          {/* Knowledge point tags */}
          <KnowledgeTags questionId={question.id} />

          {/* Similar questions toggle */}
          {isAnalyzed && (
            <button
              onClick={() => setShowSimilar((s) => !s)}
              className="flex items-center gap-1 mt-3 text-sm text-notion-muted hover:text-notion-text transition-colors"
            >
              {showSimilar ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              相似题
            </button>
          )}

          {/* Similar questions panel */}
          {showSimilar && isAnalyzed && (
            <SimilarQuestionsPanel
              questionId={question.id}
              similarQuestions={similarQuestions}
              isGenerating={isGeneratingSimilar}
              onGenerate={handleGenerate}
              ollamaAvailable={ollamaAvailable}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-start gap-1 ml-4 shrink-0">
          {!isAnalyzed && (
            <button
              onClick={() => onAnalyze(question)}
              disabled={isAnalyzing || !ollamaAvailable}
              className="p-2 text-primary-500 hover:text-notion-text hover:bg-notion-accent-bg rounded-notion transition-colors disabled:opacity-40"
              title="AI 分析"
            >
              {isAnalyzing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
            </button>
          )}
          {isAnalyzed && question.status !== "graduated" && (
            <>
              <button
                onClick={() => onMarkResult(question, true)}
                className="p-2 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-notion transition-colors"
                title="做对了"
              >
                <CheckCircle2 size={16} />
              </button>
              <button
                onClick={() => onMarkResult(question, false)}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-notion transition-colors"
                title="做错了"
              >
                <AlertCircle size={16} />
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(question.id)}
            className="p-2 text-notion-subtle hover:text-red-500 hover:bg-red-50 rounded-notion transition-colors"
            title="删除"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="bg-white rounded-notion shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-notion-border">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    question.subject === "math"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-green-50 text-green-600"
                  }`}
                >
                  {subjectLabel(question.subject)}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-notion-surface text-notion-muted">
                  {typeLabel(question.question_type)}
                </span>
                <span className="text-xs text-notion-subtle">{question.chapter}</span>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="p-1 text-notion-subtle hover:text-notion-muted hover:bg-notion-surface rounded-notion transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Question text */}
              {question.content_html ? (
                <div
                  className="text-notion-text text-base leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: question.content_html }}
                />
              ) : (
                <p className="text-notion-text text-base leading-relaxed whitespace-pre-wrap">
                  {question.content}
                </p>
              )}

              {/* Original images */}
              {contentImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-notion-muted">原始图片</p>
                  <div className="grid grid-cols-1 gap-3">
                    {contentImages.map((img, idx) => (
                      <div key={idx} className="bg-notion-surface rounded-notion p-3">
                        <img
                          src={`data:${img.mimeType};base64,${img.data}`}
                          alt={img.description}
                          className="max-w-full h-auto rounded"
                        />
                        <p className="text-xs text-notion-subtle mt-1">
                          识别结果: {img.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Answer */}
              {question.correct_answer && (
                <div className="bg-green-50 rounded-notion p-3">
                  <p className="text-sm font-medium text-green-700">参考答案</p>
                  <p className="text-green-600 mt-1">{question.correct_answer}</p>
                </div>
              )}

              {/* Analysis info */}
              {isAnalyzed && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-notion-surface rounded-notion p-3">
                    <p className="text-xs text-notion-muted">错因</p>
                    <p className="text-sm font-medium text-notion-text mt-1">
                      {errorCauseLabel(question.error_cause)}
                    </p>
                  </div>
                  <div className="bg-notion-surface rounded-notion p-3">
                    <p className="text-xs text-notion-muted">难度</p>
                    <p className="text-sm font-medium text-notion-text mt-1">
                      {difficultyLabel(question.difficulty)}
                    </p>
                  </div>
                </div>
              )}

              {/* Mastery */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-notion-muted">掌握度</span>
                <div className="flex-1 h-2 bg-notion-surface rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${masteryBarClass(question.mastery_score)}`}
                    style={{ width: `${question.mastery_score}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-notion-muted">
                  {Math.round(question.mastery_score)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SimilarQuestionsPanel({
  questionId,
  similarQuestions,
  isGenerating,
  onGenerate,
  ollamaAvailable,
}: {
  questionId: number;
  similarQuestions: SimilarQuestion[];
  isGenerating: boolean;
  onGenerate: () => void;
  ollamaAvailable: boolean;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-notion-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-notion-text">相似练习题</span>
        <button
          onClick={onGenerate}
          disabled={isGenerating || !ollamaAvailable}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-notion-accent-bg text-notion-muted rounded-notion hover:bg-primary-100 transition-colors disabled:opacity-40"
        >
          {isGenerating ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Wand2 size={12} />
          )}
          {isGenerating ? "生成中..." : "生成相似题"}
        </button>
      </div>

      {similarQuestions.length === 0 ? (
        <p className="text-sm text-notion-subtle py-2">暂无相似题，点击生成</p>
      ) : (
        <div className="space-y-3">
          {similarQuestions.map((sq, idx) => (
            <div
              key={`${questionId}-${idx}`}
              className="bg-notion-surface rounded-notion p-3 text-sm"
            >
              <p className="text-notion-text font-medium mb-1">
                {idx + 1}. {sq.content}
              </p>
              {sq.answer && (
                <p className="text-green-600 text-xs mb-1">
                  答案: {sq.answer}
                </p>
              )}
              {sq.explanation && (
                <p className="text-notion-muted text-xs">
                  解析: {sq.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
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
          className="text-xs px-2 py-0.5 rounded-notion bg-notion-accent-bg text-notion-muted border border-primary-100"
        >
          {t.name}
        </span>
      ))}
    </div>
  );
}
