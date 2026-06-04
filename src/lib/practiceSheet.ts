import type { Question, Subject, PracticeMode } from "../types";
import { katexToHtml, parseSegments } from "./latex";
import type { ParsedImage } from "./export/buildRequest";

// PracticeMode is declared in src/types/index.ts; re-export here for
// callers that imported it from this module.
export type { PracticeMode };

export interface PracticeSheetItem {
  question: Question;
  knowledgePointNames: string[];
  parsedImages: ParsedImage[];
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
  knowledgeMap: Map<number, string[]>,
  imagesMap: Map<number, ParsedImage[]> = new Map(),
): PracticeSheet {
  const items: PracticeSheetItem[] = questions.map((q) => ({
    question: q,
    knowledgePointNames: knowledgeMap.get(q.id) ?? [],
    parsedImages: imagesMap.get(q.id) ?? [],
  }));

  return {
    title: mode === "questions_only" ? "错题练习卷" : "错题分析卷",
    mode,
    items,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Render the question body. Prefers `content_html` (rich view with
 * options and image placeholders). Falls back to `content` (plain
 * text). $...$ LaTeX segments inside either are rendered to KaTeX
 * HTML. Pre-parsed images are appended at the end of the body so
 * they appear after the text.
 */
function renderQuestionBody(item: PracticeSheetItem): string {
  const { question, parsedImages } = item;
  const sourceHtml =
    question.content_html && question.content_html.trim().length > 0
      ? question.content_html
      : null;
  const textBody = sourceHtml
    ? renderLatexInHtml(sourceHtml)
    : parseSegments(question.content)
        .map((seg) => {
          if (seg.type === "text") {
            return escapeHtml(seg.content).replace(/\n/g, "<br/>");
          }
          if (seg.type === "display") {
            return `<div class="math-display">${katexToHtml(seg.content, true)}</div>`;
          }
          return katexToHtml(seg.content, false);
        })
        .join("");

  if (parsedImages.length === 0) return textBody;
  const imgs = parsedImages
    .map(
      (img) =>
        `<img class="content-image" src="${escapeHtml(img.dataUrl)}" alt="${escapeHtml(img.description || img.name)}" />`,
    )
    .join("");
  return `${textBody}<div class="content-images">${imgs}</div>`;
}

/**
 * Walk an HTML string, find $...$ / $$...$$ in text nodes, render to
 * KaTeX, and stitch back together. Conservative: only touches text
 * nodes; existing tags (img, span with class="image-desc", etc.)
 * are preserved. The `content_html` from the DB is authored HTML
 * (mammoth output) and we trust its tag structure.
 */
function renderLatexInHtml(html: string): string {
  // Simple token-aware walker. We don't pull in a DOM parser to keep
  // this lightweight; instead we walk the string and only replace
  // inside text regions. For our authoring flow this is enough —
  // $...$ doesn't appear inside tag attributes.
  // Replace each $...$ inside the text segments.
  return html.replace(/\$+\s*([^$]+?)\s*\$+/g, (match, body) => {
    const isDisplay = match.startsWith("$$");
    return katexToHtml(body, isDisplay);
  });
}

function renderAnalysisSection(item: PracticeSheetItem): string {
  const q = item.question;
  const rows: string[] = [];

  if (q.correct_answer) {
    rows.push(
      `<div class="analysis-row"><span class="analysis-label">正确答案:</span> ${escapeHtml(q.correct_answer)}</div>`,
    );
  }
  if (q.student_answer) {
    rows.push(
      `<div class="analysis-row"><span class="analysis-label">学生答案:</span> ${escapeHtml(q.student_answer)}</div>`,
    );
  }
  if (q.error_cause) {
    rows.push(
      `<div class="analysis-row"><span class="analysis-label">错因:</span> ${ERROR_CAUSE_LABELS[q.error_cause] || escapeHtml(q.error_cause)}</div>`,
    );
  }
  if (item.knowledgePointNames.length > 0) {
    rows.push(
      `<div class="analysis-row"><span class="analysis-label">知识点:</span> ${item.knowledgePointNames.map(escapeHtml).join(", ")}</div>`,
    );
  }
  if (q.chapter) {
    rows.push(
      `<div class="analysis-row"><span class="analysis-label">章节:</span> ${escapeHtml(q.chapter)}</div>`,
    );
  }
  if (q.solution_approach) {
    rows.push(
      `<div class="analysis-row"><span class="analysis-label">解题思路:</span> ${renderInlineLatex(escapeHtml(q.solution_approach))}</div>`,
    );
  }
  if (q.solution_steps) {
    const steps = parseSolutionSteps(q.solution_steps);
    if (steps.length > 0) {
      const lis = steps
        .map((s) => `<li>${renderInlineLatex(escapeHtml(s))}</li>`)
        .join("");
      rows.push(
        `<div class="analysis-row analysis-steps"><span class="analysis-label">解题步骤:</span><ol class="analysis-steps-list">${lis}</ol></div>`,
      );
    }
  }
  if (rows.length === 0) return "";
  return `<div class="analysis-section">${rows.join("")}</div>`;
}

function parseSolutionSteps(raw: string): string[] {
  // DB stores it as either a JSON array string (from AI analyze) or
  // a newline-separated string. Try JSON first.
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map(String);
  } catch {
    // fall through
  }
  return raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function renderInlineLatex(escaped: string): string {
  // The string is already HTML-escaped. Restore $ markers and run
  // KaTeX. The escape pass above would have turned $ into $ (no
  // change), but `\n` and `<` were turned into `&lt;` etc. We work
  // on the escaped form so user-supplied markup cannot inject.
  return escaped.replace(
    /\$\$([\s\S]+?)\$\$/g,
    (_m, body) => `<div class="math-display">${katexToHtml(body, true)}</div>`,
  ).replace(
    /\$([^\$\n]+?)\$/g,
    (_m, body) => katexToHtml(body, false),
  );
}

export function formatForPrint(sheet: PracticeSheet, studentName: string): string {
  const dateStr = new Date(sheet.generatedAt).toLocaleDateString("zh-CN");

  const itemsHtml = sheet.items
    .map((item, idx) => {
      const num = idx + 1;
      const body = renderQuestionBody(item);

      if (sheet.mode === "questions_only") {
        return `
          <div class="practice-item questions-only">
            <div class="item-number">${num}</div>
            <div class="item-content">${body}</div>
            <div class="notes-area">
              <div class="notes-label">笔记区</div>
              <div class="notes-lines"></div>
            </div>
          </div>
        `;
      }

      const analysisSection = renderAnalysisSection(item);
      return `
        <div class="practice-item full-analysis">
          <div class="item-number">${num}</div>
          <div class="item-content">${body}</div>
          ${analysisSection}
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
  .item-content img.content-image { max-width: 100%; height: auto; display: block; margin: 8px 0; }
  .content-images { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .math-display { margin: 8px 0; }
  .notes-area { margin-top: 15px; padding-top: 10px; border-top: 1px dashed #d1d5db; }
  .notes-label { font-size: 12px; color: #9ca3af; margin-bottom: 6px; }
  .notes-lines { height: 60px; background: repeating-linear-gradient(transparent, transparent 19px, #e5e7eb 19px, #e5e7eb 20px); }
  .analysis-section { margin-top: 12px; padding: 10px; background: #f8fafc; border-radius: 6px; }
  .analysis-row { font-size: 13px; margin-bottom: 4px; }
  .analysis-label { font-weight: 500; color: #475569; }
  .analysis-steps-list { margin: 4px 0 0 1.4em; padding: 0; }
  .analysis-steps-list li { margin-bottom: 2px; }
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

function escapeHtml(text: string | null | undefined): string {
  if (text == null) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
