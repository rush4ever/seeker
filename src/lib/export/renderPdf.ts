/**
 * Browser-side PDF generator (replaces the original browserPdf.ts).
 *
 * Consumes a PracticeSheet (the layout source of truth from
 * practiceSheet.ts) and produces a Blob of type application/pdf.
 *
 * Layout:
 *   - Header: title + meta line (student, date, count)
 *   - For each item: question number, body (text + rendered math
 *     via KaTeX → PNG), and either
 *       (a) questions_only: a 5-line notes area for the student to
 *           write in, no answer rows
 *       (b) full_analysis:  answer / student answer / error cause /
 *           knowledge points / chapter / solution approach / solution
 *           steps
 *
 * Text is rendered as vector glyphs through @react-pdf/renderer's
 * <Text> with the registered NotoSansSC CJK font. Math segments
 * are rasterized to PNG via katexToPng and embedded as <Image>.
 */
import { createElement, type ReactElement } from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";

import { katexToPng, parseSegments } from "../latex";
import { toRenderable, ERROR_CAUSE_MAP, DIFFICULTY_MAP } from "./buildRequest";
import type { PracticeSheet, PracticeSheetItem } from "../practiceSheet";

Font.register({
  family: "NotoSansSC",
  src: "/fonts/NotoSansSC-Regular.otf",
});
Font.registerHyphenationCallback((word: string) => [word]);

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
  item: {
    marginBottom: 14,
    padding: 10,
    border: "1pt solid #ddd",
    borderRadius: 4,
  },
  itemNum: {
    fontSize: 9,
    color: "#2563eb",
    marginBottom: 4,
    fontWeight: 700,
  },
  itemBody: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    fontSize: 11,
    lineHeight: 1.7,
  },
  mathImg: {
    marginHorizontal: 1,
  },
  analysisRow: {
    fontSize: 9,
    color: "#475569",
    marginTop: 3,
  },
  analysisLabel: {
    fontWeight: 700,
    color: "#334155",
  },
  kpChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  kpChip: {
    fontSize: 8,
    padding: 2,
    backgroundColor: "#f0f4f8",
    color: "#3a6ea5",
    borderRadius: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  notesArea: {
    marginTop: 8,
    paddingTop: 6,
    borderTop: "1pt dashed #d1d5db",
  },
  notesLabel: {
    fontSize: 8,
    color: "#9ca3af",
    marginBottom: 4,
  },
  notesLine: {
    fontSize: 10,
    color: "#cbd5e1",
    marginBottom: 4,
  },
  contentImage: {
    marginVertical: 4,
  },
});

type Chunk =
  | { kind: "text"; value: string }
  | { kind: "image"; dataUrl: string; width: number; height: number };

export async function renderPdfFromHtml(
  sheet: PracticeSheet,
  studentName: string,
): Promise<Blob> {
  const itemBlocks: ReactElement[] = [];
  for (let i = 0; i < sheet.items.length; i++) {
    itemBlocks.push(await buildItemBlock(sheet.items[i], i, sheet.mode));
  }
  const docEl = createElement(PdfDocument, {
    title: sheet.title,
    studentName,
    count: sheet.items.length,
    itemBlocks,
  });
  return await pdf(docEl as Parameters<typeof pdf>[0]).toBlob();
}

function PdfDocument({
  title,
  studentName,
  count,
  itemBlocks,
}: {
  title: string;
  studentName: string;
  count: number;
  itemBlocks: ReactElement[];
}) {
  const dateStr = new Date().toISOString().slice(0, 10);
  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: "A4", style: styles.page },
      createElement(Text, { style: styles.header }, title),
      createElement(
        Text,
        { style: styles.meta },
        `学生: ${studentName} · 日期: ${dateStr} · 共 ${count} 题`,
      ),
      ...itemBlocks,
    ),
  );
}

async function buildItemBlock(
  item: PracticeSheetItem,
  index: number,
  mode: "questions_only" | "full_analysis",
): Promise<ReactElement> {
  const q = item.question;
  const renderable = toRenderable({
    id: q.id,
    content: q.content,
    content_html: q.content_html,
    content_images: q.content_images,
    correct_answer: q.correct_answer,
    student_answer: q.student_answer,
    error_cause: q.error_cause,
    error_cause_label: q.error_cause
      ? ERROR_CAUSE_MAP[q.error_cause] ?? q.error_cause
      : null,
    difficulty: q.difficulty,
    difficulty_label: q.difficulty
      ? DIFFICULTY_MAP[q.difficulty] ?? q.difficulty
      : null,
    chapter: q.chapter,
    knowledge_points: item.knowledgePointNames,
    question_type: q.question_type,
    solution_approach: q.solution_approach ?? null,
    solution_steps: q.solution_steps ?? null,
  });

  const bodySource = q.content_html && q.content_html.trim().length > 0
    ? stripHtmlTags(q.content_html)
    : q.content;
  const bodyChunks = await buildBodyChunks(bodySource);

  return createElement(
    View,
    { style: styles.item, key: q.id },
    createElement(Text, { style: styles.itemNum }, `第 ${index + 1} 题`),
    createElement(
      View,
      { style: styles.itemBody },
      ...bodyChunks.map(renderChunk),
    ),
    renderable.parsedImages.length > 0
      ? createElement(
          View,
          null,
          ...renderable.parsedImages.map((img, i) =>
            createElement(Image, {
              key: i,
              src: img.dataUrl,
              style: styles.contentImage,
            }),
          ),
        )
      : null,
    item.knowledgePointNames.length > 0
      ? createElement(
          View,
          { style: styles.kpChips },
          ...item.knowledgePointNames.map((n, i) =>
            createElement(Text, { key: i, style: styles.kpChip }, n),
          ),
        )
      : null,
    mode === "questions_only" ? renderNotesArea() : renderAnalysisSection(q),
  );
}

function renderNotesArea(): ReactElement {
  return createElement(
    View,
    { style: styles.notesArea },
    createElement(Text, { style: styles.notesLabel }, "笔记区"),
    ...[0, 1, 2, 3, 4].map((i) =>
      createElement(
        Text,
        { key: i, style: styles.notesLine },
        "________________________________",
      ),
    ),
  );
}

function renderAnalysisSection(
  q: PracticeSheetItem["question"],
): ReactElement | null {
  const rows: ReactElement[] = [];

  if (q.correct_answer) {
    rows.push(
      createElement(Text, { key: "ca", style: styles.analysisRow }, [
        createElement(Text, { key: "l", style: styles.analysisLabel }, "正确答案: "),
        createElement(Text, { key: "v" }, q.correct_answer),
      ]),
    );
  }
  if (q.student_answer) {
    rows.push(
      createElement(Text, { key: "sa", style: styles.analysisRow }, [
        createElement(Text, { key: "l", style: styles.analysisLabel }, "学生答案: "),
        createElement(Text, { key: "v" }, q.student_answer),
      ]),
    );
  }
  if (q.error_cause) {
    const label = ERROR_CAUSE_MAP[q.error_cause] ?? q.error_cause;
    rows.push(
      createElement(Text, { key: "ec", style: styles.analysisRow }, [
        createElement(Text, { key: "l", style: styles.analysisLabel }, "错因: "),
        createElement(Text, { key: "v" }, label),
      ]),
    );
  }
  if (q.chapter) {
    rows.push(
      createElement(Text, { key: "ch", style: styles.analysisRow }, [
        createElement(Text, { key: "l", style: styles.analysisLabel }, "章节: "),
        createElement(Text, { key: "v" }, q.chapter),
      ]),
    );
  }
  if (q.solution_approach) {
    rows.push(
      createElement(
        Text,
        { key: "sapp", style: styles.analysisRow },
        createElement(Text, { style: styles.analysisLabel }, "解题思路: "),
      ),
    );
    // The approach text is rendered as a separate body block so math
    // in it is captured by katexToPng.
    // For simplicity here we render the plain text only; future
    // work can extend the chunked rendering to nested blocks.
    rows.push(
      createElement(
        Text,
        { key: "sappv", style: styles.analysisRow },
        q.solution_approach,
      ),
    );
  }
  if (q.solution_steps) {
    const steps = splitSteps(q.solution_steps);
    if (steps.length > 0) {
      rows.push(
        createElement(
          Text,
          { key: "sstL", style: styles.analysisRow },
          createElement(Text, { style: styles.analysisLabel }, "解题步骤: "),
        ),
      );
      steps.forEach((s, i) => {
        rows.push(
          createElement(
            Text,
            { key: `sst${i}`, style: styles.analysisRow },
            `${i + 1}. ${s}`,
          ),
        );
      });
    }
  }
  if (rows.length === 0) return null;
  return createElement(View, null, ...rows);
}

async function buildBodyChunks(source: string): Promise<Chunk[]> {
  const segments = parseSegments(source);
  const chunks: Chunk[] = [];
  for (const seg of segments) {
    if (seg.type === "text") {
      const trimmed = seg.content.replace(/\n/g, " ");
      if (trimmed) chunks.push({ kind: "text", value: trimmed });
    } else {
      const displayMode = seg.type === "display";
      try {
        const { png, width, height } = await katexToPng(seg.content, displayMode, 0.4);
        chunks.push({ kind: "image", dataUrl: pngToDataUrl(png), width, height });
      } catch {
        chunks.push({
          kind: "text",
          value: displayMode ? `$$${seg.content}$$` : `$${seg.content}$`,
        });
      }
    }
  }
  return chunks;
}

function renderChunk(chunk: Chunk, idx: number): ReactElement {
  if (chunk.kind === "text") {
    return createElement(Text, { key: idx }, chunk.value);
  }
  // 0.75 ≈ px-to-pt at 96 DPI; bump the multiplier a little for
  // print legibility.
  const w = Math.max(8, chunk.width * 0.9);
  const h = Math.max(8, chunk.height * 0.9);
  return createElement(Image, {
    key: idx,
    src: chunk.dataUrl,
    style: { ...styles.mathImg, width: w, height: h },
  });
}

function pngToDataUrl(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

function splitSteps(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map(String);
  } catch {
    /* fall through */
  }
  return raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}
