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

  const text = updatedHtml
    .replace(/<img[^>]*class="inline-formula"[^>]*>/g, " [图] ")
    .replace(/<span class="image-desc"[^>]*>(.*?)<\/span>/g, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { updatedHtml, text, images };
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

  // Find all question headers
  const questionPattern =
    /(\d+)\s*[（(](客观题|主观题)[)）]\s*([^<]+).*?答题时间[：:]\s*(\d{4}-\d{2}-\d{2})/g;
  let match;
  const questionInfos: {
    number: number;
    type: "objective" | "subjective";
    chapter: string;
    answerDate: string;
    index: number;
  }[] = [];

  while ((match = questionPattern.exec(questionHtml)) !== null) {
    questionInfos.push({
      number: parseInt(match[1], 10),
      type: match[2] === "客观题" ? "objective" : "subjective",
      chapter: match[3].trim(),
      answerDate: match[4],
      index: match.index,
    });
  }

  // Extract content for each question
  for (let i = 0; i < questionInfos.length; i++) {
    const info = questionInfos[i];
    const startIdx = info.index;
    const endIdx =
      i + 1 < questionInfos.length
        ? questionInfos[i + 1].index
        : questionHtml.length;

    let contentHtml = questionHtml.substring(startIdx, endIdx);

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
        total: questionInfos.length,
        message: `正在解析第 ${info.number} 题...`,
      });
    }
    const { updatedHtml, text, images } = await parseImagesInHtml(
      contentHtml,
      info.number,
      onProgress
    );

    // Extract answer from answer section
    const correctAnswer = extractAnswerFromHtml(answerHtml, info.number);

    questions.push({
      number: info.number,
      type: info.type,
      chapter: info.chapter,
      answerDate: info.answerDate,
      content: text,
      contentHtml: updatedHtml,
      images,
      options:
        info.type === "objective" ? parseOptions(updatedHtml) : undefined,
      correctAnswer,
    });
  }

  return { title, questions };
}
