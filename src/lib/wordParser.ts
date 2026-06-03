import mammoth from "mammoth";
import JSZip from "jszip";
import katex from "katex";
import { parseImageContent } from "./vision";

export interface ParsedQuestion {
  number: number;
  type: "objective" | "subjective";
  chapter: string;
  answerDate: string;
  content: string;
  contentHtml: string;
  images: {
    name: string;
    data: Uint8Array;
    mimeType: string;
    description: string;
  }[];
  options?: string[];
  correctAnswer: string;
}

export interface ParseResult {
  title: string;
  questions: ParsedQuestion[];
}

export interface ParseProgress {
  phase: "structure" | "images";
  current: number;
  total: number;
  message: string;
}

function parseOptions(contentHtml: string): string[] | undefined {
  const options: string[] = [];
  const optionMatches = contentHtml.match(/[A-D][\.．、]\s*[^<]+/g);
  if (optionMatches) {
    for (const m of optionMatches) {
      const cleaned = m.replace(/^[A-D][\.．、]\s*/, "").trim();
      if (cleaned) options.push(cleaned);
    }
  }
  return options.length > 0 ? options : undefined;
}

/**
 * Extract answer from the next <p> element after the answer header.
 * Handles text, em tags, and images.
 */
function extractAnswerFromHtml(html: string, questionNum: number): string {
  // Find the answer header
  const headerPattern = new RegExp(
    `${questionNum}[【\\[]原错题参考答案[】\\]]`
  );
  const headerMatch = html.match(headerPattern);
  if (!headerMatch) return "";

  const afterHeader = html.substring(headerMatch.index! + headerMatch[0].length);

  // Find the next <p> tag and extract its content
  const pMatch = afterHeader.match(/<p>([\s\S]*?)<\/p>/);
  if (!pMatch) return "";

  // Extract text, handling nested tags
  let answer = pMatch[1]
    .replace(/<em>(.*?)<\/em>/g, "$1")
    .replace(/<strong>(.*?)<\/strong>/g, "$1")
    .replace(/<img[^>]*>/g, "[图片]")
    .replace(/\s+/g, " ")
    .trim();

  return answer;
}

async function parseImagesInHtml(
  html: string,
  questionNum: number,
  onProgress?: (progress: ParseProgress) => void,
  concurrency: number = 3
): Promise<{
  updatedHtml: string;
  text: string;
  images: ParsedQuestion["images"];
}> {
  const imgRegex = /<img[^>]*src=["'](data:image\/[^;]+;base64,[^"']+)["'][^>]*>/gi;
  const matches: {
    fullTag: string;
    base64Src: string;
    mimeType: string;
    alt: string;
  }[] = [];

  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const base64Src = match[1];
    const mimeMatch = base64Src.match(/data:([^;]+);base64,/);
    const altMatch = match[0].match(/alt="([^"]*)"/);
    const alt = altMatch ? altMatch[1] : "";
    matches.push({
      fullTag: match[0],
      base64Src,
      mimeType: mimeMatch?.[1] || "image/png",
      alt,
    });
  }

  // Decorative images to skip entirely
  const SKIP_ALTS = ["原错题", "左装饰", "右装饰", "装饰"];
  // Vision model reliably parses images >= this threshold
  const VISION_THRESHOLD = 800;

  // Categorize images
  const visionMatches = matches.filter(
    (m) => !SKIP_ALTS.includes(m.alt) && m.base64Src.length >= VISION_THRESHOLD
  );
  const inlineMatches = matches.filter(
    (m) => !SKIP_ALTS.includes(m.alt) && m.base64Src.length < VISION_THRESHOLD
  );

  // Parse large images with vision model
  const parsedImages: Map<string, { description: string; data: Uint8Array }> =
    new Map();

  if (visionMatches.length > 0) {
    for (let i = 0; i < visionMatches.length; i += concurrency) {
      const batch = visionMatches.slice(i, i + concurrency);
      if (onProgress) {
        onProgress({
          phase: "images",
          current: i,
          total: visionMatches.length,
          message: `正在解析第 ${questionNum} 题的图片 (${i + 1}/${visionMatches.length})...`,
        });
      }
      const batchResults = await Promise.all(
        batch.map(async (m) => {
          const base64Content = m.base64Src.split(",")[1];
          const data = Uint8Array.from(atob(base64Content), (c) =>
            c.charCodeAt(0)
          );
          try {
            const description = await parseImageContent(m.base64Src);
            return { key: m.fullTag, description, data };
          } catch {
            return { key: m.fullTag, description: "", data };
          }
        })
      );
      for (const r of batchResults) {
        parsedImages.set(r.key, { description: r.description, data: r.data });
      }
    }

    if (onProgress) {
      onProgress({
        phase: "images",
        current: visionMatches.length,
        total: visionMatches.length,
        message: `第 ${questionNum} 题图片解析完成`,
      });
    }
  }

  // Replace all images in HTML
  let updatedHtml = html;
  const images: ParsedQuestion["images"] = [];
  let imgIndex = 0;

  for (const m of matches) {
    const parsed = parsedImages.get(m.fullTag);
    if (parsed && parsed.description) {
      // Large image with vision description: pre-render LaTeX inline
      imgIndex++;
      const ext = m.mimeType.split("/")[1] || "png";
      const name = `q${questionNum}_img${imgIndex}.${ext}`;

      // Render description (may contain LaTeX) to HTML
      const renderedDesc = renderInlineMath(parsed.description);
      updatedHtml = updatedHtml.replace(
        m.fullTag,
        `<span class="image-desc" data-image="${name}">${renderedDesc}</span>`
      );
      images.push({
        name,
        data: parsed.data,
        mimeType: m.mimeType,
        description: parsed.description,
      });
    } else if (inlineMatches.some((im) => im.fullTag === m.fullTag)) {
      // Small image: keep as inline img tag for direct rendering
      imgIndex++;
      const ext = m.mimeType.split("/")[1] || "png";
      const name = `q${questionNum}_img${imgIndex}.${ext}`;
      updatedHtml = updatedHtml.replace(
        m.fullTag,
        `<img src="${m.base64Src}" class="inline-formula" data-image="${name}" style="height:1.3em;display:inline-block;vertical-align:middle;border-radius:2px;" />`
      );
      const base64Content = m.base64Src.split(",")[1];
      const data = Uint8Array.from(atob(base64Content), (c) =>
        c.charCodeAt(0)
      );
      images.push({
        name,
        data,
        mimeType: m.mimeType,
        description: "",
      });
    } else {
      // Decorative image: remove
      updatedHtml = updatedHtml.replace(m.fullTag, "");
    }
  }

  const text = cleanLatexDelimiters(
    updatedHtml
      .replace(/<img[^>]*class="inline-formula"[^>]*>/g, " [图] ")
      .replace(/<span class="image-desc"[^>]*>(.*?)<\/span>/g, " $1 ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

  return { updatedHtml, text, images };
}

/**
 * Clean stray / malformed $...$ delimiters in the plain-text view of a
 * question. The vision model (qwen2.5vl) is asked to wrap inline math
 * in $...$ but often:
 *  - wraps the WHOLE identified text (including Chinese stem) in $...$
 *  - emits a single dangling $ (opened without closing)
 *  - mismatches the number of $ in a paragraph
 *
 * The plain text field is rendered on list cards WITHOUT KaTeX, so a
 * stray $ leaks through as a visible dollar sign. Strategy:
 *  - If a $...$ pair is "too greedy" (covers ≥ 70% of the trimmed text),
 *    unwrap it (the whole line got swallowed).
 *  - Any remaining un-paired $ is removed.
 *  - The HTML view (content_html) is NOT touched — it still feeds MathContent.
 */
function cleanLatexDelimiters(s: string): string {
  if (!s || !s.includes("$")) return s;

  // 1. Detect the "whole text got wrapped" case: text starts with $ and
  //    contains a closing $ near the end (within last 6 chars). Unwrap.
  const unwrapMatch = s.match(/^\s*\$([\s\S]+?)\$\s*$/);
  if (unwrapMatch) {
    const inner = unwrapMatch[1].trim();
    // Only unwrap if it actually swallowed most of the text
    if (inner.length / s.trim().length >= 0.7) {
      s = inner;
    }
  }

  // 2. Drop any remaining un-paired or leading/trailing $ (count parity check).
  //    Walk through $ positions; only keep $ that has a matching pair AND
  //    the inner content looks like math (contains one of: \frac, \sqrt,
  //    ^, _, =, +, -, \, \pi, \sum, \int). Otherwise drop the $ entirely.
  const dollarPositions: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "$") dollarPositions.push(i);
  }
  if (dollarPositions.length === 0) return s;
  if (dollarPositions.length % 2 === 1) {
    // odd count → drop ALL $ (defensive: vision output is unreliable)
    return s.replace(/\$/g, "");
  }

  // 3. Even count: keep only pairs whose inner content looks like LaTeX.
  const looksLikeMath = (inner: string) =>
    /\\frac|\\sqrt|\^|_|\\pi|\\sum|\\int|\\times|\\div|\\pm/.test(inner);
  let result = "";
  let cursor = 0;
  for (let i = 0; i < dollarPositions.length; i += 2) {
    const openAt = dollarPositions[i];
    const closeAt = dollarPositions[i + 1];
    // Append text before this pair
    result += s.slice(cursor, openAt);
    const inner = s.slice(openAt + 1, closeAt);
    if (looksLikeMath(inner)) {
      result += "$" + inner + "$";
    } else {
      // Drop the $, keep the inner text (probably plain text mistakenly wrapped)
      result += inner;
    }
    cursor = closeAt + 1;
  }
  result += s.slice(cursor);
  return result;
}

function renderInlineMath(text: string): string {
  // Replace $...$ with KaTeX-rendered HTML
  return text.replace(/\$([^$]+)\$/g, (_, latex) => {
    try {
      return katex.renderToString(latex.trim(), {
        displayMode: false,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return `$${latex}$`;
    }
  });
}

export async function parseWordDocument(
  file: File,
  onProgress?: (progress: ParseProgress) => void
): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // Extract images using JSZip (fallback for any images mammoth might miss)
  const zip = await JSZip.loadAsync(buffer);
  const imagesFromZip: Map<string, { data: Uint8Array; mimeType: string }> =
    new Map();

  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (path.startsWith("word/media/")) {
      const ext = path.split(".").pop()?.toLowerCase();
      const mimeType =
        ext === "png"
          ? "image/png"
          : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "gif"
          ? "image/gif"
          : "image/png";
      const data = await zipEntry.async("uint8array");
      imagesFromZip.set(path.replace("word/media/", ""), { data, mimeType });
    }
  }

  // Convert to HTML using mammoth (default converts images to inline data URIs)
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  // Extract title (text between HTML tags containing 错题集)
  const titleMatch = html.match(/>\s*([^<]*错题集[^<]*)\s*</);
  const title = titleMatch ? titleMatch[1].trim() : file.name;

  // Split into question section and answer section
  const answerSectionIndex = html.indexOf("参考答案");
  const questionHtml =
    answerSectionIndex > 0 ? html.substring(0, answerSectionIndex) : html;
  const answerHtml =
    answerSectionIndex > 0 ? html.substring(answerSectionIndex) : "";

  // Parse questions
  const questions: ParsedQuestion[] = [];

  // Split the question HTML into per-question segments. The previous
  // implementation used a single ultra-strict regex (required 题号 +
  // (客观|主观)题 + 章节 + 答题时间:YYYY-MM-DD all in one match). Real
  // docs often skip 答题时间, or use a numbered list, or a plain <h1>
  // header — and a single un-matched sub-question collapsed everything
  // into one row. We now try multiple splitters and fall back to the
  // whole HTML as one question if nothing matches.
  const segments = splitQuestions(questionHtml);
  const totalCount = segments.length;

  // Extract content for each question
  for (let i = 0; i < totalCount; i++) {
    const contentHtmlRaw = segments[i];
    const meta = extractQuestionMeta(contentHtmlRaw, i + 1);

    let contentHtml = contentHtmlRaw;

    // Remove the header part (up to and including the table)
    const tableEnd = contentHtml.indexOf("</table>");
    if (tableEnd > 0) {
      contentHtml = contentHtml.substring(tableEnd + 8);
    }

    // Clean up
    contentHtml = contentHtml
      .replace(/<p>\s*<\/p>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Parse images in the content using vision model
    if (onProgress) {
      onProgress({
        phase: "structure",
        current: i + 1,
        total: totalCount,
        message: `正在解析第 ${meta.number} 题...`,
      });
    }
    const { updatedHtml, text, images } = await parseImagesInHtml(
      contentHtml,
      meta.number,
      onProgress
    );

    // Extract answer from answer section
    const correctAnswer = extractAnswerFromHtml(answerHtml, meta.number);

    questions.push({
      number: meta.number,
      type: meta.type,
      chapter: meta.chapter,
      answerDate: meta.answerDate,
      content: text,
      contentHtml: updatedHtml,
      images,
      options:
        meta.type === "objective" ? parseOptions(updatedHtml) : undefined,
      correctAnswer,
    });
  }

  return { title, questions };
}

/**
 * Split the question-region HTML into per-question segments.
 *
 * Strategy order matters. Real Word docs that follow the project's
 * export format use the strict `N (客观题|主观题) <chapter>
 * 答题时间:YYYY-MM-DD` header, so we try that first (it's the
 * unambiguous happy path). When that yields < 2 segments — usually
 * because the doc was hand-edited or generated by a different tool
 * — we walk down through progressively looser strategies that pick
 * up `<h1>`/`<h2>`, numbered list lines, or `<strong>客观题</strong>`
 * tags. If everything fails, the whole HTML is one segment so the
 * user can at least see / manually fix the import.
 */
export function splitQuestions(html: string): string[] {
  const strategies: Array<(h: string) => string[] | null> = [
    splitByStrictHeader,
    splitByHeaderTags,
    splitByNumberedLine,
    splitByTypeTag,
  ];
  for (const fn of strategies) {
    const out = fn(html);
    if (out && out.length > 1) return out;
  }
  return [html];
}

/** Strategy 0: the original strict regex. Kept as the happy path for
 *  well-formed project exports. */
function splitByStrictHeader(html: string): string[] | null {
  const re =
    /(\d+)\s*[（(](客观题|主观题)[)）]\s*([^<]+).*?答题时间[：:]\s*(\d{4}-\d{2}-\d{2})/g;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    indices.push(m.index);
  }
  if (indices.length < 2) return null;
  const out: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : html.length;
    out.push(html.substring(start, end));
  }
  return out;
}

/** Strategy 1: split at `<h1>…</h1>` / `<h2>…</h2>` boundaries. */
function splitByHeaderTags(html: string): string[] | null {
  // Look for the first <h1>/<h2>; everything before it is dropped
  // (preamble / table-of-contents), then split on subsequent <h1>/<h2>.
  const headerRe = /<h[12][^>]*>.*?<\/h[12]>/gi;
  const matches: { index: number; tag: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(html)) !== null) {
    matches.push({ index: m.index, tag: m[0] });
  }
  if (matches.length < 2) return null;
  const out: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    out.push(html.substring(start, end));
  }
  return out;
}

/** Strategy 2: split at numbered lines like `1. xxx` / `1、xxx`. */
function splitByNumberedLine(html: string): string[] | null {
  // Match the start of an element containing a leading "N." or "N、"
  // — typically a <p> or <li>. We anchor on the opening tag so the
  // boundary is the start of the new question, not the end of the old.
  const re = /<(?:p|li|div)[^>]*>\s*\d+\s*[、.．]\s*[^<]{0,80}/gi;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    indices.push(m.index);
  }
  if (indices.length < 2) return null;
  const out: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : html.length;
    out.push(html.substring(start, end));
  }
  return out;
}

/** Strategy 3: split at `<strong>客观题</strong>` /
 *  `<strong>主观题</strong>` blocks. */
function splitByTypeTag(html: string): string[] | null {
  const re = /<strong[^>]*>\s*(?:客观题|主观题)\s*<\/strong>/gi;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    indices.push(m.index);
  }
  if (indices.length < 2) return null;
  const out: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : html.length;
    out.push(html.substring(start, end));
  }
  return out;
}

/**
 * Best-effort metadata extraction for one question segment.
 *
 * Tries the original strict header pattern first; if it doesn't match,
 * falls back to defaults derived from the segment index.
 */
function extractQuestionMeta(
  segment: string,
  indexFallback: number,
): {
  number: number;
  type: "objective" | "subjective";
  chapter: string;
  answerDate: string;
} {
  const strictRe =
    /(\d+)\s*[（(](客观题|主观题)[)）]\s*([^<]+).*?答题时间[：:]\s*(\d{4}-\d{2}-\d{2})/;
  const m = segment.match(strictRe);
  if (m) {
    return {
      number: parseInt(m[1], 10),
      type: m[2] === "客观题" ? "objective" : "subjective",
      chapter: m[3].trim(),
      answerDate: m[4],
    };
  }
  // Type from <strong> tag if present, else default to objective.
  const typeMatch = segment.match(/<strong[^>]*>\s*(客观题|主观题)\s*<\/strong>/);
  const type: "objective" | "subjective" = typeMatch
    ? typeMatch[1] === "客观题"
      ? "objective"
      : "subjective"
    : "objective";
  // Number from leading "N." / "N、" if present, else fallback to index.
  const numMatch = segment.match(/^\s*\d+\s*[、.．]/);
  const number = numMatch
    ? parseInt(numMatch[0].match(/\d+/)?.[0] ?? `${indexFallback}`, 10)
    : indexFallback;
  return {
    number,
    type,
    chapter: "",
    answerDate: new Date().toISOString().slice(0, 10),
  };
}
