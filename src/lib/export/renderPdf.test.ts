// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock katexToPng to avoid running the real DOM rasterization in tests.
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

// Mock @react-pdf/renderer BEFORE importing the module under test.
vi.mock("@react-pdf/renderer", () => {
  const calls: { font?: unknown; hyphenation?: unknown } = {};
  return {
    Font: {
      register: vi.fn((opts) => {
        calls.font = opts;
      }),
      registerHyphenationCallback: vi.fn((fn) => {
        calls.hyphenation = fn;
      }),
    },
    StyleSheet: { create: (s: unknown) => s },
    Document: (props: unknown) => ({ type: "Document", props }),
    Page: (props: unknown) => ({ type: "Page", props }),
    View: (props: unknown) => ({ type: "View", props }),
    Text: (props: unknown) => ({ type: "Text", props }),
    Image: (props: unknown) => ({ type: "Image", props }),
    pdf: vi.fn(() => ({
      toBlob: vi.fn().mockResolvedValue(
        new Blob(["mock-pdf-bytes"], { type: "application/pdf" }),
      ),
    })),
    __calls: calls,
  };
});

import { renderPdfFromHtml } from "./renderPdf";
import { Font, pdf } from "@react-pdf/renderer";
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
  chapter: "第二章",
  answer_date: null,
  content: "已知 $x^2 + 1 = 0$ 的解",
  content_html: null,
  content_images: null,
  student_answer: "无解",
  correct_answer: "C",
  error_cause: "concept",
  difficulty: "medium",
  mastery_score: 30,
  status: "active",
  solution_approach: "复数概念",
  solution_steps: '["1. 设 x = a+bi", "2. 代入求解"]',
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
      student_answer: sampleQ.student_answer,
      error_cause: "concept",
      error_cause_label: "概念不清",
      difficulty: "medium",
      difficulty_label: "中等",
      chapter: "第二章",
      knowledge_points: ["复数"],
      question_type: "objective",
      solution_approach: sampleQ.solution_approach ?? null,
      solution_steps: sampleQ.solution_steps ?? null,
    },
  ],
};

describe("renderPdfFromHtml", () => {
  beforeEach(() => {
    vi.mocked(pdf).mockClear();
  });

  it("registers the CJK font", async () => {
    const sheet = buildPracticeSheet(
      [sampleQ],
      "questions_only",
      new Map([[1, ["复数"]]]),
    );
    await renderPdfFromHtml(sheet, sampleReq.student_name);
    expect(Font.register).toHaveBeenCalledWith(
      expect.objectContaining({ family: "NotoSansSC" }),
    );
  });

  it("returns a Blob with application/pdf MIME", async () => {
    const sheet = buildPracticeSheet([sampleQ], "questions_only", new Map());
    const blob = await renderPdfFromHtml(sheet, sampleReq.student_name);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
  });

  it("invokes pdf() with a document element", async () => {
    const sheet = buildPracticeSheet([sampleQ], "questions_only", new Map());
    await renderPdfFromHtml(sheet, sampleReq.student_name);
    expect(pdf).toHaveBeenCalledTimes(1);
  });
});
