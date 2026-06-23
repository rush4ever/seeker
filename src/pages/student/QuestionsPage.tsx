import { useState, useRef, useCallback, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { useQuestions } from "../../hooks/useQuestions";
import {
  useQuestionAnalysis,
  errorCauseLabel,
  difficultyLabel,
} from "../../hooks/useQuestionAnalysis";
import { parseWordDocument, type ParseProgress } from "../../lib/wordParser";
import { parseMineruMarkdown } from "../../lib/mineruParser";
import { getDb } from "../../lib/db";
import { useSimilarQuestions } from "../../hooks/useSimilarQuestions";
import { updateMastery, checkGraduationStatus, masteryBarClass } from "../../lib/mastery";
import type { Question, Subject, SimilarQuestion, PracticeMode } from "../../types";
import EmptyState from "../../components/common/EmptyState";
import { MathContent } from "../../components/common/MathContent";
import { cleanLatexDelimiters, cleanLatexDelimitersInHtml } from "../../lib/text";
import { contentHtmlToExportText } from "../../lib/export/buildRequest";
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
import AIChatBox from "../../components/question/AIChatBox";
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
  const { questions, loading, remove, refresh } =
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
  interface PendingFile {
    fileName: string;
    parsedQuestions: Awaited<ReturnType<typeof parseWordDocument>>["questions"];
    subject: Subject;
  }
  const [pendingImports, setPendingImports] = useState<PendingFile[]>([]);

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
      const files = e.target.files;
      if (!files || files.length === 0 || !currentStudent) return;

      setImporting(true);
      setImportProgress({ phase: "structure", current: 0, total: files.length, message: "准备解析..." });
      try {
        const results: PendingFile[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setImportProgress({ phase: "structure", current: i + 1, total: files.length, message: `解析 ${file.name}` });

          // In Tauri runtime: use parse_document command (supports PDF + DOCX)
          if (typeof window !== "undefined" && (window as any).__TAURI__) {
            try {
              // Use Tauri's dialog to get file path instead of browser File
              const { invoke } = await import("@tauri-apps/api/core");
              const { open } = await import("@tauri-apps/plugin-dialog");

              // For Tauri mode, we open a dialog for each file since browser File
              // objects don't carry native paths. We only use this path for the
              // first interaction; subsequent files use the File API in browser mode.
              const selected = await open({
                multiple: false,
                filters: [{
                  name: "Documents",
                  extensions: ["pdf", "docx"],
                }],
              });

              if (!selected) {
                setImporting(false);
                return;
              }

              const result = await invoke<{ markdown: string; title: string; question_count: number }>(
                "parse_document",
                { filePath: selected }
              );

              const parsed = parseMineruMarkdown(result.markdown);
              const guessedSubject: Subject = selected.toLowerCase().includes("物理") ? "physics" : "math";
              results.push({
                fileName: selected.split("/").pop() || selected.split("\\").pop() || file.name,
                parsedQuestions: parsed.questions,
                subject: guessedSubject,
              });
            } catch (tauriErr) {
              // Fallback to browser-based parsing if Tauri dialog fails
              console.warn("Tauri parse failed, falling back to browser:", tauriErr);
              const result = await parseWordDocument(file);
              const guessedSubject: Subject = file.name.includes("物理") ? "physics" : "math";
              results.push({
                fileName: file.name,
                parsedQuestions: result.questions,
                subject: guessedSubject,
              });
            }
          } else {
            // Browser mode: only DOCX supported via mammoth
            if (!file.name.endsWith(".docx")) {
              toast.error(`浏览器模式下暂不支持 PDF 导入: ${file.name}`);
              continue;
            }
            const result = await parseWordDocument(file);
            const guessedSubject: Subject = file.name.includes("物理") ? "physics" : "math";
            results.push({
              fileName: file.name,
              parsedQuestions: result.questions,
              subject: guessedSubject,
            });
          }
        }
        setPendingImports(results);
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
    if (pendingImports.length === 0 || !currentStudent) return;

    setImporting(true);
    const totalQuestions = pendingImports.reduce((s, f) => s + f.parsedQuestions.length, 0);
    setImportProgress({ phase: "structure", current: 0, total: totalQuestions, message: "开始导入..." });
    try {
      const db = await getDb();
      let inserted = 0;

      for (const pending of pendingImports) {
        for (const q of pending.parsedQuestions) {
          inserted++;

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

          setImportProgress({ phase: "structure", current: inserted, total: totalQuestions, message: `写入第 ${inserted}/${totalQuestions} 题` });
          await db.execute(
            `INSERT INTO questions (
              student_id, subject, source_type, source_file, number_in_source,
              question_type, chapter, answer_date, content, content_html, content_html_original, content_images,
              correct_answer, error_cause, difficulty, mastery_score, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              currentStudent.id,
              pending.subject,
              "word_import" as const,
              pending.fileName,
              q.number,
              q.type,
              q.chapter,
              q.answerDate,
              q.content,
              q.contentHtml ?? null,
              q.rawHtml ?? null,
              contentImages,
              q.correctAnswer,
              null, // error_cause
              null, // difficulty
              0,    // mastery_score
              "active" as const,
            ]
          );
        }
      }

      await refresh();
      setPendingImports([]);
      toast.success(`成功导入 ${totalQuestions} 道错题`);
    } catch (err) {
      toast.error("导入失败", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }, [pendingImports, currentStudent, refresh]);

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

  const handleSaveEdit = useCallback(
    async (questionId: number, updates: {
      errorCause?: string | null;
      difficulty?: string | null;
      solutionApproach?: string | null;
      solutionSteps?: string | null;
    }) => {
      try {
        const db = await getDb();
        await db.execute(
          `UPDATE questions SET
             error_cause = COALESCE($1, error_cause),
             difficulty = COALESCE($2, difficulty),
             solution_approach = $3,
             solution_steps = $4,
             updated_at = datetime('now')
           WHERE id = $5`,
          [
            updates.errorCause ?? null,
            updates.difficulty ?? null,
            updates.solutionApproach ?? null,
            updates.solutionSteps ?? null,
            questionId,
          ]
        );
        await refresh();
      } catch (err) {
        console.error("Failed to save analysis edit:", err);
        toast.error("保存失败", { description: err instanceof Error ? err.message : String(err) });
      }
    },
    [refresh]
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
      toast.error("Ollama 不可用", {
        description: "请确认 Ollama 已启动 (http://localhost:11434)",
      });
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
            const result = await analyzeQuestion(
              contentHtmlToExportText(q.content_html) || q.content,
              allNodes, status.model);

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
          } catch (e) {
            failed++;
            const errMsg = e instanceof Error ? e.message : String(e);
            console.error("批量分析失败:", q.id, errMsg);
            // Only show the first failure detail so the user can act on it
            if (failed === 1) {
              toast.error("分析失败", {
                description: errMsg.length > 120 ? errMsg.slice(0, 120) + "…" : errMsg,
              });
            }
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
                导入文件
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf"
            multiple
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
          <p className="text-sm mt-2">点击"导入文件"按钮导入错题文档（支持 PDF / Word）</p>
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
              onSaveEdit={handleSaveEdit}
              isAnalyzing={analyzingIds.has(q.id)}
              isGeneratingSimilar={generatingForId === q.id}
              ollamaAvailable={ollamaAvailable === true}
            />
          ))}
        </div>
      )}

      {/* Import confirmation dialog */}
      {pendingImports.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-notion p-6 w-[480px] shadow-xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-notion-text mb-4">确认导入</h3>
            <p className="text-sm text-notion-muted mb-4">
              共 <span className="font-medium">{pendingImports.length}</span> 个文件，
              解析出 <span className="font-medium">{pendingImports.reduce((s, f) => s + f.parsedQuestions.length, 0)}</span> 道错题
            </p>
            <div className="space-y-3 mb-4">
              {pendingImports.map((pending, idx) => (
                <div key={idx} className="p-3 border border-notion-border rounded-notion">
                  <p className="text-sm font-medium text-notion-text mb-2">{pending.fileName}</p>
                  <p className="text-xs text-notion-muted mb-2">{pending.parsedQuestions.length} 道错题</p>
                  <label className="block text-xs font-medium text-notion-text mb-1">学科</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setPendingImports((prev) =>
                          prev.map((f, i) => (i === idx ? { ...f, subject: "math" as Subject } : f))
                        )
                      }
                      className={`flex-1 py-1.5 rounded-notion border text-xs font-medium transition-colors ${
                        pending.subject === "math"
                          ? "bg-notion-accent-bg border-primary-300 text-notion-text"
                          : "border-notion-border text-notion-muted hover:bg-notion-surface"
                      }`}
                    >
                      数学
                    </button>
                    <button
                      onClick={() =>
                        setPendingImports((prev) =>
                          prev.map((f, i) => (i === idx ? { ...f, subject: "physics" as Subject } : f))
                        )
                      }
                      className={`flex-1 py-1.5 rounded-notion border text-xs font-medium transition-colors ${
                        pending.subject === "physics"
                          ? "bg-notion-accent-bg border-primary-300 text-notion-text"
                          : "border-notion-border text-notion-muted hover:bg-notion-surface"
                      }`}
                    >
                      物理
                    </button>
                  </div>
                </div>
              ))}
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
                onClick={() => setPendingImports([])}
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
  onSaveEdit,
  isAnalyzing,
  isGeneratingSimilar,
  ollamaAvailable,
}: {
  question: Question;
  onDelete: (id: number) => void;
  onAnalyze: (q: Question) => void;
  onGenerateSimilar: (q: Question) => void;
  onMarkResult: (q: Question, isCorrect: boolean) => void;
  onSaveEdit: (id: number, updates: {
    errorCause?: string | null;
    difficulty?: string | null;
    solutionApproach?: string | null;
    solutionSteps?: string | null;
  }) => Promise<void>;
  isAnalyzing: boolean;
  isGeneratingSimilar: boolean;
  ollamaAvailable: boolean;
}) {
  const isAnalyzed = !!question.error_cause && !!question.difficulty;
  const [showSimilar, setShowSimilar] = useState(false);
  const [similarQuestions, setSimilarQuestions] = useState<SimilarQuestion[]>([]);
  const [similarLoaded, setSimilarLoaded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showEditAnalysis, setShowEditAnalysis] = useState(false);
  const [editErrorCause, setEditErrorCause] = useState<string>(question.error_cause || "unknown");
  const [editDifficulty, setEditDifficulty] = useState<string>(question.difficulty || "medium");
  const [editApproach, setEditApproach] = useState(question.solution_approach || "");
  const [editSteps, setEditSteps] = useState(question.solution_steps || "[]");
  const [savingEdit, setSavingEdit] = useState(false);


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
            {/* Header — sticky so the close button is always accessible */}
            <div className="sticky top-0 z-10 bg-white flex items-center justify-between p-4 border-b border-notion-border">
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
                  {/* Edit analysis button */}
                  <div className="px-4 pb-2">
                    <button
                      onClick={() => {
                        setShowEditAnalysis(!showEditAnalysis);
                        setEditErrorCause(question.error_cause || "unknown");
                        setEditDifficulty(question.difficulty || "medium");
                        setEditApproach(question.solution_approach || "");
                        try {
                          const steps = JSON.parse(question.solution_steps || "[]");
                          setEditSteps(Array.isArray(steps) ? steps.join("\n") : "");
                        } catch {
                          setEditSteps("");
                        }
                      }}
                      className="text-xs text-notion-muted hover:text-notion-text underline"
                    >
                      {showEditAnalysis ? "取消编辑" : "编辑分析结果"}
                    </button>
                  </div>
                  {/* Edit analysis form */}
                  {showEditAnalysis && (
                    <div className="px-4 pb-4 space-y-3 border-t border-notion-border pt-3">
                      <h4 className="text-xs font-medium text-notion-muted uppercase tracking-wide">修正分析结果</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-notion-muted mb-1">错因</label>
                          <select
                            value={editErrorCause}
                            onChange={(e) => setEditErrorCause(e.target.value)}
                            className="w-full text-sm border border-notion-border rounded-notion px-2 py-1"
                          >
                            <option value="concept">概念不清</option>
                            <option value="calculation">计算错误</option>
                            <option value="careless">粗心</option>
                            <option value="misread">审题失误</option>
                            <option value="unknown">完全不会</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-notion-muted mb-1">难度</label>
                          <select
                            value={editDifficulty}
                            onChange={(e) => setEditDifficulty(e.target.value)}
                            className="w-full text-sm border border-notion-border rounded-notion px-2 py-1"
                          >
                            <option value="easy">简单</option>
                            <option value="medium">中等</option>
                            <option value="hard">困难</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-notion-muted mb-1">解题思路</label>
                        <textarea
                          value={editApproach}
                          onChange={(e) => setEditApproach(e.target.value)}
                          className="w-full text-sm border border-notion-border rounded-notion px-2 py-1 min-h-[60px]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-notion-muted mb-1">解题步骤（每行一步）</label>
                        <textarea
                          value={editSteps}
                          onChange={(e) => setEditSteps(e.target.value)}
                          className="w-full text-sm border border-notion-border rounded-notion px-2 py-1 min-h-[80px]"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          setSavingEdit(true);
                          await onSaveEdit(question.id, {
                            errorCause: editErrorCause,
                            difficulty: editDifficulty,
                            solutionApproach: editApproach,
                            solutionSteps: JSON.stringify(editSteps.split("\n").map(s => s.trim()).filter(Boolean)),
                          });
                          setSavingEdit(false);
                          setShowEditAnalysis(false);
                        }}
                        disabled={savingEdit}
                        className="notion-btn-primary text-sm disabled:opacity-50"
                      >
                        {savingEdit ? "保存中..." : "保存修正"}
                      </button>
                    </div>
                  )}

                  {/* AI Chat — discuss analysis errors */}
                  <AIChatBox
                    questionContent={question.content}
                    solutionApproach={question.solution_approach}
                    solutionSteps={question.solution_steps}
                    onAdopt={async (approach, steps) => {
                      await onSaveEdit(question.id, {
                        solutionApproach: approach,
                        solutionSteps: JSON.stringify(steps),
                      });
                    }}
                  />
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
