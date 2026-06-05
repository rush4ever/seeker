/**
 * Export request builder.
 *
 * Moved out of ExportButtonGroup so the layout source-of-truth
 * (`practiceSheet.formatForPrint`) and the renderers (PDF, Word) can
 * share the same data shape without circular imports back into a
 * React component.
 *
 * Responsibilities:
 *   - load knowledge points for a set of question IDs (one SQL JOIN)
 *   - build an `ExportRequest` from a list of `Question` rows
 *   - pre-parse `content_images` (a JSON string in the DB) into
 *     `data:` URLs so the renderers can drop them straight into
 *     <img src={...}> / ImageRun
 */
import { getDb } from "../db";
import type {
  ExportQuestionInput,
  ExportRequest,
  PracticeMode,
  Question,
} from "../../types";

export const ERROR_CAUSE_MAP: Record<string, string> = {
  concept: "概念不清",
  calculation: "计算错误",
  careless: "粗心",
  misread: "审题失误",
  unknown: "完全不会",
};

export const DIFFICULTY_MAP: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};

export interface ParsedImage {
  name: string;
  dataUrl: string; // starts with "data:<mime>;base64,..."
  mimeType: string;
  description: string;
}

/**
 * Internal wrapper that carries the pre-parsed images alongside
 * the wire shape. Defined here so the renderers can type their
 * input without polluting `ExportQuestionInput` (which is also the
 * shape that crosses the Tauri IPC boundary).
 */
export interface RenderableQuestion extends ExportQuestionInput {
  parsedImages: ParsedImage[];
}

export interface BuildRequestDeps {
  questions: Question[];
  studentName: string;
  mode: PracticeMode;
  title: string;
  knowledgeMap: Map<number, string[]>;
}

export async function loadKnowledgePoints(
  questionIds: number[],
): Promise<Map<number, string[]>> {
  if (questionIds.length === 0) return new Map();
  const db = await getDb();
  const placeholders = questionIds.map(() => "?").join(",");
  const rows = await db.select<{ question_id: number; name: string }[]>(
    `SELECT qk.question_id, kn.name
     FROM question_knowledge qk
     JOIN knowledge_nodes kn ON qk.knowledge_id = kn.id
     WHERE qk.question_id IN (${placeholders})`,
    questionIds,
  );
  const map = new Map<number, string[]>();
  for (const row of rows) {
    const existing = map.get(row.question_id) ?? [];
    existing.push(row.name);
    map.set(row.question_id, existing);
  }
  return map;
}

export function buildExportRequest(deps: BuildRequestDeps): ExportRequest {
  const { questions, studentName, mode, title, knowledgeMap } = deps;
  return {
    student_name: studentName,
    mode,
    title,
    questions: questions.map((q) => ({
      id: q.id,
      content: q.content,
      content_html: q.content_html ?? null,
      content_images: q.content_images ?? null,
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
      knowledge_points: knowledgeMap.get(q.id) ?? [],
      question_type: q.question_type,
      solution_approach: q.solution_approach ?? null,
      solution_steps: q.solution_steps ?? null,
    })),
  };
}

/**
 * Parse the JSON `content_images` column once, producing data: URLs
 * that the renderers can drop straight into <img> / ImageRun.
 * Defensive: any parse error yields an empty array.
 */
/**
 * Parse the JSON `content_images` column once, producing data: URLs
 * that the renderers can drop straight into <img> / ImageRun.
 * Defensive: any parse error yields an empty array.
 *
 * Handles two formats:
 *   新格式 (v2+) — `[{name, data, mimeType, description}]` where `data`
 *     is the base64-encoded image bytes. This is the current format.
 *   旧格式 (v0-v1) — `["/path/to/image.png"]` (file-path strings).
 *     Those paths are only meaningful inside a Tauri app, not in
 *     browser-mode (sql.js dev), and can never be rendered from
 *     the DB alone. We detect the old format and emit a warning so
 *     the user knows why no images appear.
 */
export function parseContentImages(raw: string | null): ParsedImage[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Old format: array of strings (file paths) — cannot render.
    if (arr.length > 0 && typeof arr[0] === "string") {
      if (process.env.NODE_ENV !== "test") {
        console.warn(
          "[parseContentImages] legacy file-path format detected in content_images; " +
          "these images are only accessible in Tauri runtime. Re-import the questions " +
          "to store inline image data.",
          arr.slice(0, 3),
        );
      }
      return [];
    }
    return (arr as Array<{
      name?: string;
      data?: string;
      mimeType?: string;
      description?: string;
    }>)
      .filter((x) => x && x.data)
      .map((x) => ({
        name: x.name ?? "",
        dataUrl: `data:${x.mimeType ?? "image/png"};base64,${x.data}`,
        mimeType: x.mimeType ?? "image/png",
        description: x.description ?? "",
      }));
  } catch {
    return [];
  }
}

/** Wrap a wire-shape question with its parsed images for rendering. */
export function toRenderable(q: ExportQuestionInput): RenderableQuestion {
  return { ...q, parsedImages: parseContentImages(q.content_images) };
}

/**
 * Convert content_html (which may contain <img> tags for formulas) into
 * export-friendly text for PDF/Word rendering.
 *
 * Inline-formula <img> tags with a title attribute carry the vision model's
 * LaTeX recognition result. We extract that as $...$ text so KaTeX can
 * render it in the export pipeline. Images without a title become □.
 *
 * This is the counterpart of wordParser.ts's text-building logic,
 * specialized for the export path (preserves LaTeX text, unlike the
 * import-time text which uses □ markers).
 */
export function contentHtmlToExportText(contentHtml: string | null): string {
  if (!contentHtml) return "";
  // 1. inline-formula with title → $title$ (KaTeX-renderable LaTeX)
  // 2. other img tags → □ (fallback position marker)
  // 3. strip remaining HTML tags
  return contentHtml
    .replace(
      /<img[^>]*class="inline-formula"[^>]*title="([^"]*)"[^>]*\/?>/gi,
      (_match, title: string) => ` $${title.trim()}$ `,
    )
    .replace(/<img[^>]*\/?>/gi, " □ ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
