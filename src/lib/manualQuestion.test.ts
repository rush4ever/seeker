import { describe, it, expect } from "vitest";
import { buildManualQuestionInput, validateManualQuestionForm } from "./manualQuestion";

describe("validateManualQuestionForm", () => {
  it("returns error when content is empty", () => {
    const errors = validateManualQuestionForm({ content: "" } as any);
    expect(errors).toContain("题目内容不能为空");
  });

  it("returns error when content is whitespace only", () => {
    const errors = validateManualQuestionForm({ content: "   \n  " } as any);
    expect(errors).toContain("题目内容不能为空");
  });

  it("returns no errors when content is present", () => {
    const errors = validateManualQuestionForm({ content: "求 x" } as any);
    expect(errors).toEqual([]);
  });
});

describe("buildManualQuestionInput", () => {
  it("builds a QuestionInput with defaults", () => {
    const input = buildManualQuestionInput(
      {
        content: "求 x",
        questionType: "objective",
        subject: "math",
        chapter: "一元一次方程",
        correctAnswer: "x=4",
        errorCause: "concept",
        difficulty: "easy",
      },
      42,
      []
    );
    expect(input).toMatchObject({
      student_id: 42,
      subject: "math",
      source_type: "manual",
      question_type: "objective",
      content: "求 x",
      chapter: "一元一次方程",
      correct_answer: "x=4",
      error_cause: "concept",
      difficulty: "easy",
      mastery_score: 0,
      status: "active",
    });
  });

  it("serializes image paths to JSON array", () => {
    const input = buildManualQuestionInput(
      {
        content: "q",
        questionType: "objective",
        subject: "math",
        chapter: "c",
        correctAnswer: "a",
        errorCause: "unknown",
        difficulty: "medium",
      },
      1,
      ["/a/b.png", "/a/c.png"]
    );
    expect(input.content_images).toBe('["/a/b.png","/a/c.png"]');
  });

  it("writes empty JSON array when no images", () => {
    const input = buildManualQuestionInput(
      {
        content: "q",
        questionType: "objective",
        subject: "math",
        chapter: "c",
        correctAnswer: "a",
        errorCause: "unknown",
        difficulty: "medium",
      },
      1,
      []
    );
    expect(input.content_images).toBe("[]");
  });

  it("nullifies empty chapter and correctAnswer", () => {
    const input = buildManualQuestionInput(
      {
        content: "q",
        questionType: "objective",
        subject: "math",
        chapter: "",
        correctAnswer: "",
        errorCause: "unknown",
        difficulty: "medium",
      },
      1,
      []
    );
    expect(input.chapter).toBeNull();
    expect(input.correct_answer).toBeNull();
  });
});
