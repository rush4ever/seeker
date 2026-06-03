// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

// Mock docx BEFORE importing module under test so we can assert calls
// without running the full Word generation pipeline.
vi.mock("docx", () => {
  const toBuffer = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
  return {
    Document: vi.fn().mockImplementation(function (this: unknown) {
      return this;
    }),
    Packer: { toBuffer },
    Paragraph: vi.fn().mockImplementation(function (this: unknown) {
      return this;
    }),
    TextRun: vi.fn().mockImplementation(function (this: unknown) {
      return this;
    }),
    HeadingLevel: { HEADING_1: "HEADING_1" },
    AlignmentType: { CENTER: "CENTER" },
  };
});

import { generateBrowserWord } from "./browserWord";
import { Document, Packer } from "docx";
import type { ExportRequest } from "../../types";

const sampleReq: ExportRequest = {
  student_name: "测试生",
  title: "数学错题集",
  mode: "questions_only",
  questions: [
    {
      id: 1,
      content: "化简 1/(4-a)",
      correct_answer: "1/(4-a)",
      student_answer: null,
      error_cause: null,
      error_cause_label: null,
      difficulty: null,
      difficulty_label: null,
      chapter: "初二下册",
      knowledge_points: ["分式"],
      question_type: "objective",
    },
  ],
};

describe("generateBrowserWord", () => {
  it("constructs a Document with the request sections", async () => {
    await generateBrowserWord(sampleReq);
    expect(Document).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.any(Array),
      }),
    );
  });

  it("invokes Packer.toBuffer to produce the file bytes", async () => {
    await generateBrowserWord(sampleReq);
    expect(Packer.toBuffer).toHaveBeenCalled();
  });

  it("returns a Blob with the Word MIME type", async () => {
    const blob = await generateBrowserWord(sampleReq);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });
});
