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
import type { Question, Subject, SimilarQuestion, PracticeMode } from "../../types";
import EmptyState from "../../components/common/EmptyState";
import { MathContent } from "../../components/common/MathContent";
import { cleanLatexDelimiters, cleanLatexDelimitersInHtml } from "../../lib/text";
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
import { useToast } from "../../components/common/useToast";

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
  const toast = useToast();
  const { questions, loading, addQuestions, remove, refresh } =
    useQuestions(currentStudent?.id);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ParseProgress | null>(null);
  const [filterSubject, setFilterSubject] = useState<Subject | "all">("all");
  const [exportMode, setExportMode] = useState<PracticeMode>("full_analysis");
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
        toast.error("导入失败", { description: err instanceof Error ? err.message : String(err) });
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
          content_html_original: q.rawHtml,
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
      toast.error("导入失败", { description: err instanceof Error ? err.message : String(err) });
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
              `UPDATE questions
               SET error_cause = $1, difficulty = $2, solution_approach = $3,
                   solution_steps = $4, updated_at = datetime('now')
               WHERE id = $5`,
              [
                result.errorCause,
                result.difficulty,
                result.solutionApproach,
                JSON.stringify(result.solutionSteps),
                q.id,
              ]
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
      toast.info("批量分析完成", { description: `${success} 成功, ${failed} 失败` });
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
              mode={exportMode}
              onModeChange={setExportMode}
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
      const parsed = JSON.parse(question.content_images);
      if (!Array.isArray(parsed)) return [];
      // Old format: array of strings (file paths) — cannot render in browser mode.
      if (parsed.length > 0 && typeof parsed[0] === "string") {
        if (process.env.NODE_ENV !== "test") {
          console.warn(
            "[QuestionsPage] legacy file-path format in content_images — " +
            "re-import to see images in browser mode.",
          );
        }
        return [];
      }
      return parsed as {
        name: string;
        data: string;
        mimeType: string;
        description: string;
      }[];
    } catch {
      return [];
    }
  }, [question.content_images]);

  // All content images sorted by size (descending), for the
  // detail modal's "原始题目图片" gallery. The user wants to see
  // ALL original images from the .docx so they can verify the
  // parser output against the source. Small inline formula images
  // (< 50 bytes data) are excluded as they're usually invisible
  // 1x1 markers rather than meaningful content. The list-card
  // thumbnail still uses the largest image.
  const sortedImages = useMemo(() => {
    const usable = contentImages.filter((img) => img?.data && img.data.length >= 50);
    return [...usable].sort((a, b) => (b.data?.length ?? 0) - (a.data?.length ?? 0));
  }, [contentImages]);

  // List-card thumbnail — the single most representative image.
  const topThumbnail = useMemo(() => {
    if (sortedImages.length === 0) return null;
    const best = sortedImages[0];
    return {
      src: `data:${best.mimeType};base64,${best.data}`,
      alt: best.description || best.name || "题目原图",
      name: best.name,
      description: best.description,
    };
  }, [sortedImages]);
  const hasOriginalPhoto = sortedImages.length > 0;

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
            {hasOriginalPhoto && (
              <span
                className="text-xs px-2 py-1 rounded-full bg-notion-surface text-notion-muted"
                title="本题含原图，可点开详情核对"
              >
                📷 含原图
              </span>
            )}
          </div>

          {/* Original-photo thumbnail — pick the largest image so the
              user sees the most informative preview on the list card. */}
          {hasOriginalPhoto && (
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="block mb-2 rounded-notion overflow-hidden border border-notion-border hover:border-notion-text transition-colors"
              title="点击查看原图"
              aria-label="查看原图"
            >
              <img
                src={topThumbnail!.src}
                alt={topThumbnail!.alt}
                className="block max-w-[120px] max-h-[80px] object-contain bg-white"
              />
            </button>
          )}

          {/* Content */}
          {question.content_html ? (
            <div
              className="text-notion-text line-clamp-2 cursor-pointer"
              onClick={() => setShowDetail(true)}
              dangerouslySetInnerHTML={{
                __html: cleanLatexDelimitersInHtml(question.content_html),
              }}
            />
          ) : (
            <p
              className="text-notion-text line-clamp-2 cursor-pointer whitespace-pre-wrap"
              onClick={() => setShowDetail(true)}
            >
              {cleanLatexDelimiters(question.content)}
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
              <div className="flex items-center gap-2 flex-wrap">
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
                {question.chapter && (
                  <span className="text-xs text-notion-subtle">
                    § {question.chapter}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="p-1 text-notion-subtle hover:text-notion-muted hover:bg-notion-surface rounded-notion transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body — each section is a divider-bordered block for the
                "what does the user want to do when opening a question"
                mental model: read the question → understand what it tests
                → see how to think and solve → check answer → mastery. */}
            <div className="divide-y divide-notion-border">
              {/* 1. Question text */}
              <section className="p-4 space-y-3">
                <h3 className="text-xs font-medium text-notion-muted uppercase tracking-wide">
                  题目
                </h3>
                {question.content_html ? (
                  <div
                    className="text-notion-text text-base leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: cleanLatexDelimitersInHtml(question.content_html),
                    }}
                  />
                ) : (
                  <p className="text-notion-text text-base leading-relaxed whitespace-pre-wrap">
                    {cleanLatexDelimiters(question.content)}
                  </p>
                )}
              </section>

              {/* 2. Knowledge points — from question_knowledge join */}
              <section className="p-4 space-y-2">
                <h3 className="text-xs font-medium text-notion-muted uppercase tracking-wide">
                  涉及知识点
                </h3>
                <KnowledgeTags questionId={question.id} />
              </section>

              {/* 3. Chapter / textbook reference */}
              <section className="p-4 space-y-2">
                <h3 className="text-xs font-medium text-notion-muted uppercase tracking-wide">
                  对应章节
                </h3>
                <p className="text-sm text-notion-text">
                  {question.chapter || "未指定章节"}
                </p>
              </section>

              {/* 4 + 5. Solution approach + steps (or "未分析" CTA) */}
              {isAnalyzed ? (
                <>
                  <section className="p-4 space-y-2">
                    <h3 className="text-xs font-medium text-notion-muted uppercase tracking-wide">
                      解题思路
                    </h3>
                    {question.solution_approach ? (
                      <MathContent
                        text={question.solution_approach}
                        className="text-sm text-notion-text leading-relaxed"
                      />
                    ) : (
                      <p className="text-sm text-notion-subtle">暂无</p>
                    )}
                  </section>
                  <section className="p-4 space-y-2">
                    <h3 className="text-xs font-medium text-notion-muted uppercase tracking-wide">
                      解题步骤
                    </h3>
                    <SolutionStepsList steps={question.solution_steps} />
                  </section>
                </>
              ) : (
                <section className="p-4 space-y-2">
                  <h3 className="text-xs font-medium text-notion-muted uppercase tracking-wide">
                    AI 分析
                  </h3>
                  <p className="text-sm text-notion-muted">
                    还未生成解题思路与步骤。
                  </p>
                  <button
                    onClick={() => onAnalyze(question)}
                    disabled={isAnalyzing}
                    className="notion-btn-primary text-sm disabled:opacity-50"
                  >
                    {isAnalyzing ? "分析中..." : "立即 AI 分析"}
                  </button>
                </section>
              )}

              {/* 6. Reference answer */}
              {question.correct_answer && (
                <section className="p-4 space-y-2">
                  <h3 className="text-xs font-medium text-notion-muted uppercase tracking-wide">
                    参考答案
                  </h3>
                  <MathContent
                    text={question.correct_answer}
                    className="text-sm text-notion-text leading-relaxed"
                  />
                </section>
              )}

              {/* 7. Mastery + error cause + difficulty */}
              <section className="p-4 space-y-3">
                <h3 className="text-xs font-medium text-notion-muted uppercase tracking-wide">
                  掌握度
                </h3>
                <div className="flex items-center gap-3">
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
                {isAnalyzed && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-notion-muted">
                      错因：
                      <span className="text-notion-text ml-1">
                        {errorCauseLabel(question.error_cause)}
                      </span>
                    </span>
                    <span className="text-notion-muted">
                      难度：
                      <span className="text-notion-text ml-1">
                        {difficultyLabel(question.difficulty)}
                      </span>
                    </span>
                  </div>
                )}
              </section>

              {/* 8. Original docx rendering — show the raw mammoth HTML
                  from import time so the user can verify the parser
                  output against the original document. This is the
                  最接近原题"截图"的效果 in a browser environment. */}
              {question.content_html_original && (
                <section className="p-4 space-y-3">
                  <h3 className="text-xs font-medium text-notion-muted uppercase tracking-wide">
                    原始题目（文档原样）
                  </h3>
                  <div
                    className="raw-mammoth-content bg-white rounded-notion border border-notion-border p-4 overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: question.content_html_original }}
                  />
                  <style>{`
                    .raw-mammoth-content img {
                      max-width: 100%;
                      height: auto;
                      display: inline-block;
                      vertical-align: middle;
                    }
                    .raw-mammoth-content p {
                      margin: 0.5em 0;
                      line-height: 1.6;
                    }
                  `}</style>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SolutionStepsList({ steps }: { steps: string | null | undefined }) {
  const parsed: string[] = (() => {
    if (!steps) return [];
    try {
      const v = JSON.parse(steps);
      return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
    } catch {
      return [];
    }
  })();
  if (parsed.length === 0) {
    return <p className="text-sm text-notion-subtle">暂无</p>;
  }
  return (
    <ol className="space-y-2 list-decimal list-inside text-sm text-notion-text">
      {parsed.map((s, i) => (
        <li key={i} className="leading-relaxed">
          <MathContent text={s} />
        </li>
      ))}
    </ol>
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
