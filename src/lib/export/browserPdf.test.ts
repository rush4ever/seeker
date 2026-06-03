// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

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
    pdf: vi.fn(() => ({
      toBlob: vi.fn().mockResolvedValue(
        new Blob(["mock-pdf-bytes"], { type: "application/pdf" }),
      ),
    })),
    __calls: calls,
  };
});

import { generateBrowserPdf } from "./browserPdf";
import { Font, pdf } from "@react-pdf/renderer";
import type { ExportRequest } from "../../types";

const sampleReq: ExportRequest = {
  student_name: "测试生",
  title: "数学错题集",
  mode: "questions_only",
  questions: [
    {
      id: 1,
      content: "化简 $\\frac{1}{4-a}$",
      correct_answer: "1/(4-a)",
      student_answer: null,
      error_cause: "concept",
      error_cause_label: "概念不清",
      difficulty: "medium",
      difficulty_label: "中等",
      chapter: "初二下册",
      knowledge_points: ["分式", "分式的运算"],
      question_type: "objective",
    },
  ],
};

describe("generateBrowserPdf", () => {
  beforeEach(() => {
    vi.mocked(pdf).mockClear();
  });

  it("registers the CJK font with NotoSansSC family and a /fonts/ src", async () => {
    await generateBrowserPdf(sampleReq);
    expect(Font.register).toHaveBeenCalledWith(
      expect.objectContaining({
        family: "NotoSansSC",
        src: expect.stringContaining("/fonts/NotoSansSC"),
      }),
    );
  });

  it("disables hyphenation (CJK-safe callback)", async () => {
    await generateBrowserPdf(sampleReq);
    expect(Font.registerHyphenationCallback).toHaveBeenCalledWith(expect.any(Function));
  });

  it("produces a Blob with application/pdf MIME", async () => {
    const blob = await generateBrowserPdf(sampleReq);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
  });

  it("invokes pdf(...) with a document element", async () => {
    await generateBrowserPdf(sampleReq);
    expect(pdf).toHaveBeenCalledTimes(1);
  });
});
