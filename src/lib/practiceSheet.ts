import type { Question, Subject } from "../types";

export type PracticeMode = "questions_only" | "full_analysis";

export interface PracticeSheetItem {
  question: Question;
  knowledgePointNames: string[];
}

export interface PracticeSheet {
  title: string;
  mode: PracticeMode;
  items: PracticeSheetItem[];
  generatedAt: string;
}

const ERROR_CAUSE_LABELS: Record<string, string> = {
  concept: "概念不清",
  calculation: "计算错误",
  careless: "粗心",
  misread: "审题失误",
  unknown: "完全不会",
};

export function buildPracticeSheet(
  questions: Question[],
  mode: PracticeMode,
  knowledgeMap: Map<number, string[]>
): PracticeSheet {
  const items: PracticeSheetItem[] = questions.map((q) => ({
    question: q,
    knowledgePointNames: knowledgeMap.get(q.id) ?? [],
  }));

  return {
    title: mode === "questions_only" ? "错题练习卷" : "错题分析卷",
    mode,
    items,
    generatedAt: new Date().toISOString(),
  };
}

export function formatForPrint(sheet: PracticeSheet, studentName: string): string {
  const dateStr = new Date(sheet.generatedAt).toLocaleDateString("zh-CN");

  const itemsHtml = sheet.items
    .map((item, idx) => {
      const q = item.question;
      const num = idx + 1;

      if (sheet.mode === "questions_only") {
        return `
          <div class="practice-item questions-only">
            <div class="item-number">${num}</div>
            <div class="item-content">${escapeHtml(q.content)}</div>
            <div class="notes-area">
              <div class="notes-label">笔记区</div>
              <div class="notes-lines"></div>
            </div>
          </div>
        `;
      }

      // full_analysis mode
      const analysisParts = [
        q.correct_answer ? `<div class="analysis-row"><span class="analysis-label">正确答案:</span> ${escapeHtml(q.correct_answer)}</div>` : "",
        q.error_cause ? `<div class="analysis-row"><span class="analysis-label">错因:</span> ${ERROR_CAUSE_LABELS[q.error_cause] || q.error_cause}</div>` : "",
        item.knowledgePointNames.length > 0
          ? `<div class="analysis-row"><span class="analysis-label">知识点:</span> ${item.knowledgePointNames.join(", ")}</div>`
          : "",
        q.chapter ? `<div class="analysis-row"><span class="analysis-label">章节:</span> ${escapeHtml(q.chapter)}</div>` : "",
      ].filter(Boolean).join("");

      return `
        <div class="practice-item full-analysis">
          <div class="item-number">${num}</div>
          <div class="item-content">${escapeHtml(q.content)}</div>
          ${analysisParts ? `<div class="analysis-section">${analysisParts}</div>` : ""}
        </div>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${sheet.title}</title>
<style>
  body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; margin: 0; padding: 20px; color: #333; }
  .sheet-header { text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #2563eb; }
  .sheet-title { font-size: 22px; font-weight: bold; margin-bottom: 8px; }
  .sheet-meta { font-size: 13px; color: #666; }
  .practice-item { margin-bottom: 25px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; page-break-inside: avoid; }
  .item-number { font-size: 16px; font-weight: bold; color: #2563eb; margin-bottom: 8px; }
  .item-content { font-size: 14px; line-height: 1.7; margin-bottom: 10px; }
  .notes-area { margin-top: 15px; padding-top: 10px; border-top: 1px dashed #d1d5db; }
  .notes-label { font-size: 12px; color: #9ca3af; margin-bottom: 6px; }
  .notes-lines { height: 60px; background: repeating-linear-gradient(transparent, transparent 19px, #e5e7eb 19px, #e5e7eb 20px); }
  .analysis-section { margin-top: 12px; padding: 10px; background: #f8fafc; border-radius: 6px; }
  .analysis-row { font-size: 13px; margin-bottom: 4px; }
  .analysis-label { font-weight: 500; color: #475569; }
  @media print {
    body { padding: 0; }
    .practice-item { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="sheet-header">
    <div class="sheet-title">${sheet.title}</div>
    <div class="sheet-meta">学生: ${escapeHtml(studentName)} · 日期: ${dateStr} · 共 ${sheet.items.length} 题</div>
  </div>
  <div class="sheet-body">
    ${itemsHtml}
  </div>
</body>
</html>`;
}

export function groupBySubject(items: PracticeSheetItem[]): Map<Subject, PracticeSheetItem[]> {
  const grouped = new Map<Subject, PracticeSheetItem[]>();
  for (const item of items) {
    const subject = item.question.subject;
    if (!grouped.has(subject)) {
      grouped.set(subject, []);
    }
    grouped.get(subject)!.push(item);
  }
  return grouped;
}

function escapeHtml(text: string | null): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
