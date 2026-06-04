// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

// Mock katexToPng to keep the test fast and DOM-free for the
// rasterization step.
vi.mock("../latex", async () => {
  const actual = await vi.importActual<typeof import("../latex")>("../latex");
  return {
    ...actual,
    katexToPng: vi.fn(async () => ({
      png: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      width: 60,
      height: 20,
    })),
  };
});

vi.mock("docx", () => {
  const toBlob = vi.fn().mockResolvedValue(
    new Blob([new Uint8Array([1, 2, 3, 4])], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
  );
  return {
    Document: vi.fn().mockImplementation(function (this: unknown) {
      return this;
    }),
    Packer: { toBlob },
    Paragraph: vi.fn().mockImplementation(function (this: unknown) {
      return this;
    }),
    TextRun: vi.fn().mockImplementation(function (this: unknown) {
      return this;
    }),
    ImageRun: vi.fn().mockImplementation(function (this: unknown) {
      return this;
    }),
    HeadingLevel: { HEADING_1: "HEADING_1" },
    AlignmentType: { CENTER: "CENTER" },
    Table: vi.fn().mockImplementation(function (this: unknown) {
      return this;
    }),
    TableRow: vi.fn().mockImplementation(function (this: unknown) {
      return this;
    }),
    TableCell: vi.fn().mockImplementation(function (this: unknown) {
      return this;
    }),
    BorderStyle: { NONE: "NONE", SINGLE: "SINGLE" },
    WidthType: { PERCENTAGE: "PERCENTAGE" },
    HeightRule: { EXACT: "EXACT" },
  };
});

import { renderWordFromHtml } from "./renderWord";
import { Document, Packer, Table, TableRow } from "docx";
import { buildPracticeSheet } from "../practiceSheet";
import type { Question, ExportRequest } from "../../types";

const sampleQ: Question = {
  id: 1,
  student_id: 100,
  subject: "math",
  source_type: "word_import",
  source_file: null,
  number_in_source: 1,
  question_type: "objective",
  chapter: null,
  answer_date: null,
  content: "已知 $x^2$ 的解",
  content_html: null,
    content_html_original: null,
  content_images: null,
  student_answer: null,
  correct_answer: "C",
  error_cause: null,
  difficulty: null,
  mastery_score: 30,
  status: "active",
  solution_approach: null,
  solution_steps: null,
  created_at: "2025-12-01",
  updated_at: "2025-12-01",
};

const sampleReq: ExportRequest = {
  student_name: "测试生",
  title: "测试卷",
  mode: "questions_only",
  questions: [
    {
      id: 1,
      content: sampleQ.content,
      content_html: null,
      content_images: null,
      correct_answer: sampleQ.correct_answer,
      student_answer: null,
      error_cause: null,
      error_cause_label: null,
      difficulty: null,
      difficulty_label: null,
      chapter: null,
      knowledge_points: ["x^2"],
      question_type: "objective",
      solution_approach: null,
      solution_steps: null,
    },
  ],
};

describe("renderWordFromHtml", () => {
  it("constructs a Document", async () => {
    const sheet = buildPracticeSheet([sampleQ], "questions_only", new Map());
    await renderWordFromHtml(sheet, sampleReq.student_name);
    expect(Document).toHaveBeenCalled();
  });

  it("invokes Packer.toBlob to produce the file bytes", async () => {
    const sheet = buildPracticeSheet([sampleQ], "questions_only", new Map());
    await renderWordFromHtml(sheet, sampleReq.student_name);
    expect(Packer.toBlob).toHaveBeenCalled();
  });

  it("returns a Blob with the Word MIME type", async () => {
    const sheet = buildPracticeSheet([sampleQ], "questions_only", new Map());
    const blob = await renderWordFromHtml(sheet, sampleReq.student_name);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("emits a notes-area table in questions_only mode", async () => {
    const sheet = buildPracticeSheet([sampleQ], "questions_only", new Map());
    await renderWordFromHtml(sheet, sampleReq.student_name);
    expect(Table).toHaveBeenCalled();
    expect(TableRow).toHaveBeenCalled();
  });
});
