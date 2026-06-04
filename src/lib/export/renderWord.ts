/**
 * Browser-side Word (.docx) generator (replaces the original
 * browserWord.ts).
 *
 * Consumes a PracticeSheet and produces a Blob of MIME
 * application/vnd.openxmlformats-officedocument.wordprocessingml.document.
 *
 * Mode-aware (questions_only / full_analysis). Math is rasterized to
 * PNG via katexToPng and embedded as ImageRun so Word text remains
 * selectable everywhere except where a formula lives.
 *
 * Notes area approximation: 1×1 table with all borders NONE except
 * the bottom border, padded to ~60pt height. Word can't replicate
 * repeating-linear-gradient; this is the closest you can get.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  HeightRule,
} from "docx";

import { katexToPng, parseSegments } from "../latex";
import { toRenderable, ERROR_CAUSE_MAP, DIFFICULTY_MAP } from "./buildRequest";
import type { PracticeSheet, PracticeSheetItem } from "../practiceSheet";

const NOTES_AREA_HEIGHT_TWIPS = 850; // ≈ 60pt at 20 twips/pt

export async function renderWordFromHtml(
  sheet: PracticeSheet,
  studentName: string,
): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];
  children.push(...buildHeader(sheet, studentName, sheet.items.length));

  for (let i = 0; i < sheet.items.length; i++) {
    const blocks = await buildItemBlocks(sheet.items[i], i, sheet.mode);
    children.push(...blocks);
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  // Packer.toBlob is browser-safe. Packer.toBuffer would return a
  // Node Buffer which throws "nodebuffer is not supported by this
  // platform" in jsdom / Chromium.
  return await Packer.toBlob(doc);
}

function buildHeader(
  sheet: PracticeSheet,
  studentName: string,
  count: number,
): Paragraph[] {
  const dateStr = new Date(sheet.generatedAt).toLocaleDateString("zh-CN");
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: sheet.title, bold: true, size: 36 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `学生: ${studentName} · 日期: ${dateStr} · 共 ${count} 题`,
          size: 20,
          color: "888888",
        }),
      ],
      spacing: { after: 240 },
    }),
  ];
}

async function buildItemBlocks(
  item: PracticeSheetItem,
  index: number,
  mode: "questions_only" | "full_analysis",
): Promise<(Paragraph | Table)[]> {
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
  const bodyRuns = await buildBodyRuns(bodySource);

  const out: (Paragraph | Table)[] = [];

  out.push(
    new Paragraph({
      children: [
        new TextRun({ text: `第 ${index + 1} 题`, bold: true, size: 22 }),
      ],
      spacing: { before: 200, after: 80 },
    }),
  );

  out.push(
    new Paragraph({
      children: bodyRuns,
      spacing: { after: 80 },
    }),
  );

  // Pre-parsed images
  for (const img of renderable.parsedImages) {
    try {
      const bytes = await dataUrlToBytes(img.dataUrl);
      out.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: bytes,
              transformation: { width: 320, height: 200 },
              type: "png",
            } as never),
          ],
          spacing: { after: 80 },
        }),
      );
    } catch {
      // skip on conversion failure
    }
  }

  if (item.knowledgePointNames.length > 0) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({ text: "知识点: ", size: 18, color: "666666" }),
          new TextRun({ text: item.knowledgePointNames.join(" · "), size: 18 }),
        ],
        spacing: { after: 60 },
      }),
    );
  }

  if (mode === "questions_only") {
    out.push(buildNotesArea());
  } else {
    out.push(...buildAnalysisBlocks(q));
  }

  return out;
}

async function buildBodyRuns(
  source: string,
): Promise<(TextRun | InstanceType<typeof ImageRun>)[]> {
  const segments = parseSegments(source);
  const runs: (TextRun | InstanceType<typeof ImageRun>)[] = [];
  for (const seg of segments) {
    if (seg.type === "text") {
      // Split by newlines to preserve line breaks via break: 1.
      const parts = seg.content.split("\n");
      parts.forEach((part, i) => {
        if (i > 0) runs.push(new TextRun({ break: 1 }));
        if (part) runs.push(new TextRun({ text: part, size: 22 }));
      });
    } else {
      const displayMode = seg.type === "display";
      try {
        const { png, width, height } = await katexToPng(seg.content, displayMode, 0.4);
        // Scale down: Word uses pt; px × 0.75 is a reasonable approximation.
        const w = Math.max(20, Math.round(width * 0.75));
        const h = Math.max(12, Math.round(height * 0.75));
        runs.push(
          new ImageRun({
            data: png,
            transformation: { width: w, height: h },
            type: "png",
          } as never),
        );
      } catch {
        runs.push(
          new TextRun({
            text: displayMode ? `$$${seg.content}$$` : `$${seg.content}$`,
            size: 22,
            color: "999999",
          }),
        );
      }
    }
  }
  return runs;
}

function buildNotesArea(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        height: { value: NOTES_AREA_HEIGHT_TWIPS, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "笔记区", italics: true, color: "BBBBBB", size: 16 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function buildAnalysisBlocks(
  q: PracticeSheetItem["question"],
): Paragraph[] {
  const out: Paragraph[] = [];

  if (q.correct_answer) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({ text: "正确答案: ", size: 18, color: "666666" }),
          new TextRun({ text: q.correct_answer, size: 18 }),
        ],
        spacing: { after: 40 },
      }),
    );
  }
  if (q.student_answer) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({ text: "学生答案: ", size: 18, color: "666666" }),
          new TextRun({ text: q.student_answer, size: 18 }),
        ],
        spacing: { after: 40 },
      }),
    );
  }
  if (q.error_cause) {
    const label = ERROR_CAUSE_MAP[q.error_cause] ?? q.error_cause;
    out.push(
      new Paragraph({
        children: [
          new TextRun({ text: "错因: ", size: 18, color: "666666" }),
          new TextRun({ text: label, size: 18 }),
        ],
        spacing: { after: 40 },
      }),
    );
  }
  if (q.chapter) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({ text: "章节: ", size: 18, color: "666666" }),
          new TextRun({ text: q.chapter, size: 18 }),
        ],
        spacing: { after: 40 },
      }),
    );
  }
  if (q.solution_approach) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({ text: "解题思路: ", size: 18, color: "666666" }),
          new TextRun({ text: q.solution_approach, size: 18 }),
        ],
        spacing: { after: 40 },
      }),
    );
  }
  if (q.solution_steps) {
    const steps = splitSteps(q.solution_steps);
    if (steps.length > 0) {
      out.push(
        new Paragraph({
          children: [new TextRun({ text: "解题步骤:", size: 18, color: "666666" })],
          spacing: { after: 40 },
        }),
      );
      steps.forEach((s, i) => {
        out.push(
          new Paragraph({
            children: [new TextRun({ text: `${i + 1}. ${s}`, size: 18 })],
            spacing: { after: 20 },
          }),
        );
      });
    }
  }
  return out;
}

async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) throw new Error("invalid data URL");
  const b64 = dataUrl.slice(commaIdx + 1);
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
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
