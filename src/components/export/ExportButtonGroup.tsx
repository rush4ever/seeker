/**
 * Export button group. Single source for "再练卷 / 分析卷" mode
 * toggle and PDF/Word export.
 *
 * Flow (browser + Tauri both render the same Blobs in JS; the only
 * difference is who writes them to disk):
 *
 *   questions
 *     → loadKnowledgePoints + parseContentImages (buildRequest.ts)
 *     → buildPracticeSheet (practiceSheet.ts)
 *     → renderPdfFromHtml | renderWordFromHtml  (Blob in JS)
 *     → saveBrowserFile (browser)
 *     → invoke("save_file", { bytes, ... })      (Tauri)
 *     → toast with optional "打开" action
 *
 * The `mode` prop is required; the inline `onModeChange` (when
 * provided) enables the user to switch between 再练卷 and 分析卷
 * from the buttons themselves. Pages that already manage mode
 * (PracticePage) omit `onModeChange` to lock the toggle.
 */
import { useState } from "react";
import { FileText, FileSpreadsheet, Loader2, Pencil, BarChart2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import type { PracticeMode, Question } from "../../types";
import { isTauriRuntime } from "../../lib/env";
import { saveBrowserFile } from "../../lib/download";
import {
  loadKnowledgePoints,
  parseContentImages,
  type ParsedImage,
} from "../../lib/export/buildRequest";
import { buildPracticeSheet } from "../../lib/practiceSheet";
import { renderPdfFromHtml } from "../../lib/export/renderPdf";
import { renderWordFromHtml } from "../../lib/export/renderWord";
import { useToast } from "../common/useToast";

interface Props {
  questions: Question[];
  studentName: string;
  mode: PracticeMode;
  /** When provided, a 再练/分析 卷 toggle is rendered next to the buttons. */
  onModeChange?: (m: PracticeMode) => void;
  title: string;
  disabled?: boolean;
}

export default function ExportButtonGroup({
  questions,
  studentName,
  mode,
  onModeChange,
  title,
  disabled,
}: Props) {
  const [exporting, setExporting] = useState<"pdf" | "word" | null>(null);
  const toast = useToast();

  const handleExport = async (format: "pdf" | "word") => {
    if (questions.length === 0) return;
    setExporting(format);

    try {
      const ext = format === "pdf" ? "pdf" : "docx";
      const suggestedName = `${title}-${new Date().toISOString().slice(0, 10)}.${ext}`;

      // 1. Build the practice sheet (single source of layout truth).
      const questionIds = questions.map((q) => q.id);
      const knowledgeMap = await loadKnowledgePoints(questionIds);
      const imagesMap = new Map<number, ParsedImage[]>();
      for (const q of questions) {
        const parsed = parseContentImages(q.content_images);
        if (parsed.length > 0) imagesMap.set(q.id, parsed);
      }
      const sheet = buildPracticeSheet(questions, mode, knowledgeMap, imagesMap);

      // 2. Render the Blob in JS (same code path for browser + Tauri).
      const blob =
        format === "pdf"
          ? await renderPdfFromHtml(sheet, studentName)
          : await renderWordFromHtml(sheet, studentName);

      // 3. Save it.
      if (isTauriRuntime()) {
        // Tauri: hand the bytes to a Rust command that opens the
        // native save dialog and writes the file.
        const buffer = await blob.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        const result = await invoke<{ saved: boolean; path: string | null }>(
          "save_file",
          { bytes, suggestedName, kind: ext },
        );
        if (!result.saved || !result.path) return;
        toast.success("已导出", {
          description: result.path,
          action: {
            label: "打开",
            onClick: () => openPath(result.path!).catch(console.error),
          },
        });
      } else {
        const { saved, displayName } = await saveBrowserFile(blob, suggestedName);
        if (!saved) return;
        toast.success("已下载", { description: displayName });
      }
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("导出失败", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {onModeChange && (
        <ModeToggle mode={mode} onChange={onModeChange} />
      )}
      <button
        onClick={() => handleExport("pdf")}
        disabled={disabled || !!exporting}
        className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
      >
        {exporting === "pdf" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FileText size={14} />
        )}
        导出 PDF
      </button>
      <button
        onClick={() => handleExport("word")}
        disabled={disabled || !!exporting}
        className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
      >
        {exporting === "word" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FileSpreadsheet size={14} />
        )}
        导出 Word
      </button>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: PracticeMode;
  onChange: (m: PracticeMode) => void;
}) {
  return (
    <div className="flex items-center bg-white rounded-notion border border-notion-border overflow-hidden text-sm">
      <button
        type="button"
        onClick={() => onChange("questions_only")}
        className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${
          mode === "questions_only"
            ? "bg-notion-accent-bg text-notion-text font-medium"
            : "text-notion-muted hover:bg-notion-surface"
        }`}
      >
        <Pencil size={12} />
        再练卷
      </button>
      <button
        type="button"
        onClick={() => onChange("full_analysis")}
        className={`px-3 py-1.5 flex items-center gap-1 transition-colors border-l border-notion-border ${
          mode === "full_analysis"
            ? "bg-notion-accent-bg text-notion-text font-medium"
            : "text-notion-muted hover:bg-notion-surface"
        }`}
      >
        <BarChart2 size={12} />
        分析卷
      </button>
    </div>
  );
}
