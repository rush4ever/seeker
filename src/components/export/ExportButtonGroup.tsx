import { useState } from "react";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { ExportRequest, PracticeMode, Question } from "../../types";
import { getDb } from "../../lib/db";

interface Props {
  questions: Question[];
  studentName: string;
  mode: PracticeMode;
  title: string;
  disabled?: boolean;
}

const ERROR_CAUSE_MAP: Record<string, string> = {
  concept: "概念不清",
  calculation: "计算错误",
  careless: "粗心",
  misread: "审题失误",
  unknown: "完全不会",
};

const DIFFICULTY_MAP: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};

async function loadKnowledgePoints(questionIds: number[]): Promise<Map<number, string[]>> {
  if (questionIds.length === 0) return new Map();
  const db = await getDb();
  const placeholders = questionIds.map(() => "?").join(",");
  const rows = await db.select<{ question_id: number; name: string }[]>(
    `SELECT qk.question_id, kn.name
     FROM question_knowledge qk
     JOIN knowledge_nodes kn ON qk.knowledge_id = kn.id
     WHERE qk.question_id IN (${placeholders})`,
    questionIds
  );
  const map = new Map<number, string[]>();
  for (const row of rows) {
    const existing = map.get(row.question_id) ?? [];
    existing.push(row.name);
    map.set(row.question_id, existing);
  }
  return map;
}

function buildExportRequest(
  questions: Question[],
  studentName: string,
  mode: PracticeMode,
  title: string,
  knowledgeMap: Map<number, string[]>
): ExportRequest {
  return {
    student_name: studentName,
    mode,
    title,
    questions: questions.map((q) => ({
      id: q.id,
      content: q.content,
      correct_answer: q.correct_answer,
      student_answer: q.student_answer,
      error_cause: q.error_cause,
      error_cause_label: q.error_cause ? ERROR_CAUSE_MAP[q.error_cause] ?? q.error_cause : null,
      difficulty: q.difficulty,
      difficulty_label: q.difficulty ? DIFFICULTY_MAP[q.difficulty] ?? q.difficulty : null,
      chapter: q.chapter,
      knowledge_points: knowledgeMap.get(q.id) ?? [],
      question_type: q.question_type,
    })),
  };
}

export default function ExportButtonGroup({
  questions,
  studentName,
  mode,
  title,
  disabled,
}: Props) {
  const [exporting, setExporting] = useState<"pdf" | "word" | null>(null);

  const handleExport = async (format: "pdf" | "word") => {
    if (questions.length === 0) return;
    setExporting(format);

    try {
      const extension = format === "pdf" ? "pdf" : "docx";
      const defaultName = `${title}-${new Date().toISOString().slice(0, 10)}.${extension}`;

      const path = await save({
        defaultPath: defaultName,
        filters:
          format === "pdf"
            ? [{ name: "PDF", extensions: ["pdf"] }]
            : [{ name: "Word", extensions: ["docx"] }],
      });

      if (!path) {
        setExporting(null);
        return;
      }

      const questionIds = questions.map((q) => q.id);
      const knowledgeMap = await loadKnowledgePoints(questionIds);
      const request = buildExportRequest(questions, studentName, mode, title, knowledgeMap);
      const command = format === "pdf" ? "export_pdf" : "export_word";
      await invoke(command, { request, path });

      alert(`已导出: ${path}`);
    } catch (err) {
      console.error("Export failed:", err);
      alert(`导出失败: ${err}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
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
