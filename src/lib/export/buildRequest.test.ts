import { describe, it, expect } from "vitest";
import {
  buildExportRequest,
  parseContentImages,
  toRenderable,
  contentHtmlToExportText,
  ERROR_CAUSE_MAP,
  DIFFICULTY_MAP,
} from "./buildRequest";
import type { Question } from "../../types";

const baseQuestion: Question = {
  id: 1,
  student_id: 100,
  subject: "math",
  source_type: "word_import",
  source_file: "test.docx",
  number_in_source: 1,
  question_type: "objective",
  chapter: "第二章",
  answer_date: "2025-12-01",
  content: "求 $x^2$ 的解",
  content_html: "<p>求 $x^2$ 的解</p>",
  content_html_original: null,
  content_images: JSON.stringify([
    {
      name: "q1_img1.png",
      data: "iVBORw0KGgo=",
      mimeType: "image/png",
      description: "a triangle",
    },
  ]),
  student_answer: "x=2",
  correct_answer: "C",
  error_cause: "concept",
  difficulty: "medium",
  mastery_score: 35,
  status: "active",
  solution_approach: "因式分解",
  solution_steps: '["1. x²-4=0", "2. (x-2)(x+2)=0", "3. x=±2"]',
  created_at: "2025-12-01",
  updated_at: "2025-12-01",
};

const knowledgeMap = new Map<number, string[]>([
  [1, ["一元二次方程", "因式分解"]],
]);

describe("buildExportRequest", () => {
  it("maps Question fields to ExportQuestionInput", () => {
    const req = buildExportRequest({
      questions: [baseQuestion],
      studentName: "测试生",
      mode: "full_analysis",
      title: "测试卷",
      knowledgeMap,
    });
    expect(req.student_name).toBe("测试生");
    expect(req.title).toBe("测试卷");
    expect(req.mode).toBe("full_analysis");
    expect(req.questions).toHaveLength(1);
    const q = req.questions[0];
    expect(q.id).toBe(1);
    expect(q.content).toBe(baseQuestion.content);
    expect(q.content_html).toBe(baseQuestion.content_html);
    expect(q.correct_answer).toBe("C");
    expect(q.knowledge_points).toEqual(["一元二次方程", "因式分解"]);
    expect(q.solution_approach).toBe("因式分解");
    expect(q.solution_steps).toBe(baseQuestion.solution_steps);
  });

  it("resolves error_cause to Chinese label", () => {
    const req = buildExportRequest({
      questions: [{ ...baseQuestion, error_cause: "calculation" }],
      studentName: "x",
      mode: "questions_only",
      title: "x",
      knowledgeMap,
    });
    expect(req.questions[0].error_cause_label).toBe("计算错误");
  });

  it("resolves difficulty to Chinese label", () => {
    const req = buildExportRequest({
      questions: [{ ...baseQuestion, difficulty: "hard" }],
      studentName: "x",
      mode: "questions_only",
      title: "x",
      knowledgeMap,
    });
    expect(req.questions[0].difficulty_label).toBe("困难");
  });

  it("returns empty knowledge_points when missing from map", () => {
    const req = buildExportRequest({
      questions: [baseQuestion],
      studentName: "x",
      mode: "questions_only",
      title: "x",
      knowledgeMap: new Map(),
    });
    expect(req.questions[0].knowledge_points).toEqual([]);
  });

  it("exposes ERROR_CAUSE_MAP and DIFFICULTY_MAP", () => {
    expect(ERROR_CAUSE_MAP.unknown).toBe("完全不会");
    expect(DIFFICULTY_MAP.easy).toBe("简单");
  });
});

describe("parseContentImages", () => {
  it("returns [] for null", () => {
    expect(parseContentImages(null)).toEqual([]);
  });

  it("returns [] for invalid JSON", () => {
    expect(parseContentImages("not json")).toEqual([]);
  });

  it("parses a valid JSON array to data URLs", () => {
    const result = parseContentImages(baseQuestion.content_images);
    expect(result).toHaveLength(1);
    expect(result[0].dataUrl).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(result[0].mimeType).toBe("image/png");
    expect(result[0].name).toBe("q1_img1.png");
    expect(result[0].description).toBe("a triangle");
  });

  it("skips entries without data", () => {
    expect(
      parseContentImages(
        JSON.stringify([{ name: "a", mimeType: "image/png" }, { data: "x" }]),
      ),
    ).toHaveLength(1);
  });

  it("handles legacy file-path format by returning [] (browser-mode cannot render paths)", () => {
    // Old format: array of file-path strings
    const result = parseContentImages(JSON.stringify(["/a/b.png", "/a/c.jpg"]));
    expect(result).toEqual([]);
  });

  it("handles empty arrays", () => {
    expect(parseContentImages("[]")).toEqual([]);
  });
});

describe("contentHtmlToExportText - double-dollar regression", () => {
  it("does NOT double-wrap already-$ LaTeX from vision model", () => {
    // Use String.raw to avoid JS interpreting \t, \f as escape chars
    const title = String.raw`$(-1)\times\frac{1}{5-a}=\frac{1}{a-4}$`;
    const imgWithDollar = String.raw`<p>中"<img class="inline-formula" alt="□" title="` + title + String.raw`" />"代表的是（ ）</p>`;
    const out = contentHtmlToExportText(imgWithDollar);
    // The output should have single $ wrapping, not double $$
    expect(out).toContain("$(-1)");
    expect(out).not.toContain("$$(-1)");
    // Check that the label is wrapped in single $...$ with □
    expect(out).toMatch(/□\（\s*\$[^$]+\$\s*\）/);
  });
});

describe("toRenderable", () => {
  it("attaches parsedImages to the question", () => {
    const req = buildExportRequest({
      questions: [baseQuestion],
      studentName: "x",
      mode: "full_analysis",
      title: "x",
      knowledgeMap,
    });
    const r = toRenderable(req.questions[0]);
    expect(r.parsedImages).toHaveLength(1);
    expect(r.parsedImages[0].dataUrl).toContain("data:image/png;base64,");
  });
});
