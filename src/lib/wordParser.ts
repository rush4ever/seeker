import mammoth from "mammoth";
import JSZip from "jszip";

export interface ParsedQuestion {
  number: number;
  type: "objective" | "subjective";
  chapter: string;
  answerDate: string;
  content: string;
  contentHtml: string;
  images: { name: string; data: Uint8Array; mimeType: string }[];
  options?: string[];
  correctAnswer: string;
}

export interface ParseResult {
  title: string;
  questions: ParsedQuestion[];
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

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export async function parseWordDocument(file: File): Promise<ParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // Extract images using JSZip
  const zip = await JSZip.loadAsync(buffer);
  const images: Map<string, { data: Uint8Array; mimeType: string }> = new Map();

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
      images.set(path.replace("word/media/", ""), { data, mimeType });
    }
  }

  // Convert to HTML using mammoth
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  // Extract title (first text before any table)
  const titleMatch = html.match(/([^<]+错题集[^<]+)/);
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

    const content = extractTextFromHtml(contentHtml);

    // Extract answer from answer section
    const correctAnswer = extractAnswerFromHtml(answerHtml, info.number);

    questions.push({
      number: info.number,
      type: info.type,
      chapter: info.chapter,
      answerDate: info.answerDate,
      content: content,
      contentHtml,
      images: [], // TODO: implement image extraction
      options:
        info.type === "objective" ? parseOptions(contentHtml) : undefined,
      correctAnswer,
    });
  }

  return { title, questions };
}
