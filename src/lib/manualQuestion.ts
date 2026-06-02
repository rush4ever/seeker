import type { Question } from "../types";

export type ManualQuestionForm = {
  content: string;
  questionType: Question["question_type"];
  subject: Question["subject"];
  chapter: string;
  correctAnswer: string;
  errorCause: NonNullable<Question["error_cause"]>;
  difficulty: NonNullable<Question["difficulty"]>;
};

/**
 * Shape accepted by INSERT into the `questions` table — Question minus
 * the auto-generated columns.
 */
export type QuestionInput = Omit<Question, "id" | "created_at" | "updated_at">;

export function validateManualQuestionForm(form: ManualQuestionForm): string[] {
  const errors: string[] = [];
  if (!form.content || !form.content.trim()) {
    errors.push("题目内容不能为空");
  }
  return errors;
}

export function buildManualQuestionInput(
  form: ManualQuestionForm,
  currentStudentId: number,
  imagePaths: string[]
): QuestionInput {
  return {
    student_id: currentStudentId,
    subject: form.subject,
    source_type: "manual",
    source_file: null,
    number_in_source: null,
    question_type: form.questionType,
    chapter: form.chapter || null,
    answer_date: null,
    content: form.content,
    content_html: null,
    content_images: JSON.stringify(imagePaths),
    student_answer: null,
    correct_answer: form.correctAnswer || null,
    error_cause: form.errorCause || "unknown",
    difficulty: form.difficulty || "medium",
    mastery_score: 0,
    status: "active",
  };
}
