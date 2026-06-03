/**
 * Browser-side Word (.docx) generator.
 *
 * Used by ExportButtonGroup when running in browser mode. Produces a
 * real .docx Blob the caller can hand to `saveBrowserFile`.
 *
 * Implementation uses the `docx` npm package (NOT the Rust `docx-rs`
 * crate). CJK text is automatically rendered with the user's system
 * font fallback in Word / WPS / Pages — no font embedding needed.
 *
 * Layout mirrors the Rust backend and the browser-PDF generator:
 *   - Title (centered, bold, 28pt)
 *   - Meta line (student, date, count)
 *   - For each question: index, content, knowledge chips, optional
 *     answer / error_cause / difficulty
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  type ISectionOptions,
} from "docx";
import type { ExportRequest, ExportQuestionInput } from "../../types";

function buildQuestionParagraphs(q: ExportQuestionInput, index: number): Paragraph[] {
  const result: Paragraph[] = [];

  // Question index
  result.push(
    new Paragraph({
      children: [
        new TextRun({ text: `第 ${index + 1} 题`, bold: true, size: 20 }),
      ],
      spacing: { before: 200, after: 80 },
    }),
  );

  // Question content (LaTeX treated as literal text — matches Rust/PDF)
  result.push(
    new Paragraph({
      children: [new TextRun({ text: q.content, size: 22 })],
      spacing: { after: 80 },
    }),
  );

  // Knowledge points as a single line of chip-like text
  if (q.knowledge_points.length > 0) {
    result.push(
      new Paragraph({
        children: [
          new TextRun({ text: "知识点: ", size: 18, color: "666666" }),
          new TextRun({ text: q.knowledge_points.join(" · "), size: 18 }),
        ],
        spacing: { after: 60 },
      }),
    );
  }

  // Optional answer / error_cause / difficulty
  if (q.correct_answer) {
    result.push(
      new Paragraph({
        children: [
          new TextRun({ text: "答案: ", size: 18, color: "666666" }),
          new TextRun({ text: q.correct_answer, size: 18 }),
        ],
        spacing: { after: 40 },
      }),
    );
  }
  if (q.error_cause_label) {
    result.push(
      new Paragraph({
        children: [
          new TextRun({ text: "错因: ", size: 18, color: "666666" }),
          new TextRun({ text: q.error_cause_label, size: 18 }),
        ],
        spacing: { after: 40 },
      }),
    );
  }
  if (q.difficulty_label) {
    result.push(
      new Paragraph({
        children: [
          new TextRun({ text: "难度: ", size: 18, color: "666666" }),
          new TextRun({ text: q.difficulty_label, size: 18 }),
        ],
        spacing: { after: 120 },
      }),
    );
  }

  return result;
}

function buildSection(req: ExportRequest): ISectionOptions {
  const dateStr = new Date().toISOString().slice(0, 10);
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: req.title, bold: true, size: 36 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `学生: ${req.student_name} · 日期: ${dateStr} · 共 ${req.questions.length} 题`,
          size: 20,
          color: "888888",
        }),
      ],
      spacing: { after: 240 },
    }),
  ];

  for (let i = 0; i < req.questions.length; i++) {
    children.push(...buildQuestionParagraphs(req.questions[i], i));
  }

  return { properties: {}, children };
}

export async function generateBrowserWord(req: ExportRequest): Promise<Blob> {
  const doc = new Document({ sections: [buildSection(req)] });
  // Packer.toBuffer returns Buffer in Node, ArrayBuffer in browser.
  // Cast through unknown to handle the type union.
  const buffer = (await Packer.toBuffer(doc)) as unknown as ArrayBuffer;
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
