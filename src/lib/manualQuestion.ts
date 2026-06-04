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
 * Image attached via the manual-add form. The `data` field is the
 * base64-encoded image bytes (no data: URL prefix), matching the
 * shape produced by the Word-import path in `parseImagesInHtml`.
 * The `path` is the on-disk path returned by Tauri's
 * `save_uploaded_photo` command; kept so future code can resolve the
 * file directly without re-encoding the bytes.
 */
export type ManualImageInput = {
  name: string;
  data: string;
  mimeType: string;
  path: string;
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
  images: ManualImageInput[]
): QuestionInput {
  // Store as the SAME shape the Word-import path produces, so the
  // detail modal and export pipeline can render manual images with
  // no special-casing. Old data that stored file-path strings
  // (JSON.stringify(["/a/b.png"])) is handled by the parsers'
  // fallback in QuestionsPage.tsx and buildRequest.ts.
  const serialized = JSON.stringify(
    images.map((img) => ({
      name: img.name,
      data: img.data,
      mimeType: img.mimeType,
      description: "",
    })),
  );
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
    content_html_original: null,
    content_images: serialized,
    student_answer: null,
    correct_answer: form.correctAnswer || null,
    error_cause: form.errorCause || "unknown",
    difficulty: form.difficulty || "medium",
    mastery_score: 0,
    status: "active",
  };
}
