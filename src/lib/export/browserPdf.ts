/**
 * Browser-side PDF generator.
 *
 * Used by ExportButtonGroup when running in browser mode (no Tauri
 * runtime). Produces a real PDF Blob that the caller can pass to
 * `saveBrowserFile` for download.
 *
 * Implementation uses `@react-pdf/renderer` (declarative React
 * components → PDF). CJK text is rendered with NotoSansSC bundled at
 * public/fonts/NotoSansSC-Regular.otf. LaTeX in question content is
 * treated as literal text (matches the Rust backend's behavior).
 *
 * Layout mirrors the Rust backend (printpdf):
 *   - Title + meta (date, student, count)
 *   - For each question: question card with content + knowledge chips +
 *     (in FullAnalysis mode) error_cause / difficulty / answer
 *
 * Visual fidelity is intentionally lower than the Rust output (HTML
 * flow vs absolute coordinates). Both produce the same data; the Rust
 * output is the "production" copy, this is "good enough for browser
 * dev / sharing".
 */
import { createElement, Fragment } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";
import type { ExportRequest, ExportQuestionInput } from "../../types";

// Register CJK font once. Vite serves /public/* at the root, so this
// resolves to public/fonts/NotoSansSC-Regular.otf in dev and the same
// path in the production build (Vite copies public/ to dist/).
Font.register({
  family: "NotoSansSC",
  src: "/fonts/NotoSansSC-Regular.otf",
});
// Disable hyphenation for CJK; each character is its own unit and the
// default hyphenator mangles Chinese text.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "NotoSansSC",
    fontSize: 11,
    lineHeight: 1.5,
  },
  header: {
    textAlign: "center",
    marginBottom: 6,
    fontSize: 16,
    fontWeight: 700,
  },
  meta: {
    textAlign: "center",
    marginBottom: 20,
    fontSize: 9,
    color: "#666",
  },
  questionCard: {
    marginBottom: 14,
    padding: 10,
    border: "1pt solid #ddd",
    borderRadius: 4,
  },
  qIndex: {
    fontSize: 9,
    color: "#888",
    marginBottom: 4,
  },
  qContent: {
    fontSize: 11,
    marginBottom: 8,
  },
  qChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  chip: {
    fontSize: 8,
    padding: 2,
    backgroundColor: "#f0f4f8",
    color: "#3a6ea5",
    borderRadius: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  qMeta: {
    fontSize: 9,
    color: "#555",
    marginTop: 6,
  },
});

function QuestionCard({ q, index }: { q: ExportQuestionInput; index: number }) {
  return createElement(
    View,
    { style: styles.questionCard, key: q.id },
    createElement(Text, { style: styles.qIndex }, `第 ${index + 1} 题`),
    createElement(Text, { style: styles.qContent }, q.content),
    q.knowledge_points.length > 0
      ? createElement(
          View,
          { style: styles.qChips },
          ...q.knowledge_points.map((kp, i) =>
            createElement(Text, { key: i, style: styles.chip }, kp),
          ),
        )
      : null,
    q.correct_answer
      ? createElement(
          Text,
          { style: styles.qMeta },
          `答案: ${q.correct_answer}`,
        )
      : null,
    q.error_cause_label
      ? createElement(
          Text,
          { style: styles.qMeta },
          `错因: ${q.error_cause_label}`,
        )
      : null,
    q.difficulty_label
      ? createElement(
          Text,
          { style: styles.qMeta },
          `难度: ${q.difficulty_label}`,
        )
      : null,
  );
}

function PdfDocument({ req }: { req: ExportRequest }) {
  const dateStr = new Date().toISOString().slice(0, 10);
  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: "A4", style: styles.page },
      createElement(Text, { style: styles.header }, req.title),
      createElement(
        Text,
        { style: styles.meta },
        `学生: ${req.student_name} · 日期: ${dateStr} · 共 ${req.questions.length} 题`,
      ),
      ...req.questions.map((q, i) =>
        createElement(QuestionCard, { key: q.id, q, index: i }),
      ),
    ),
  );
}

export async function generateBrowserPdf(req: ExportRequest): Promise<Blob> {
  // Wrap createElement in a Fragment-friendly call. React-PDF expects
  // a ReactElement tree as the document descriptor.
  const docEl = createElement(PdfDocument, { req });
  const blob = await pdf(docEl as Parameters<typeof pdf>[0]).toBlob();
  return blob;
}

// Re-export Fragment to silence unused-import warning in some configs.
void Fragment;
