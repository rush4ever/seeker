import type { ParsedQuestion, ParseResult } from "./wordParser";

/**
 * Parse MinerU Markdown output into the standard ParsedQuestion format.
 *
 * MinerU produces Markdown with two interleaved section types:
 *   - Question:  `## 原错题N（题目来源：章节）` — question content
 *   - Answer:    `原错题N 【基础题】【参考答案】...` — answer + optional 【解析】
 *
 * We split into logical blocks, merge by number, and output ParsedQuestion[].
 */

// Regex: header that introduces a question (has 题目来源)
// Use greedy (.+) so chapters with nested parens like `（公式法）` are fully captured
const QUESTION_HEADER_RE = /^#{0,2}\s*原错题(\d+)\s*（题目来源：(.+)）/;
// Fallback: "原错题N" without chapter — we still capture it
const QUESTION_HEADER_FALLBACK_RE = /^#{0,2}\s*原错题(\d+)\s*$/;
// Regex: header that introduces an answer (has 【参考答案】)
const ANSWER_HEADER_RE = /^#{0,2}\s*原错题(\d+)\s*【基础题】/;
// Regex: extract 【参考答案】content from same line
const ANSWER_INLINE_RE = /【参考答案】\s*(.*)$/;
// Regex: extract 【解析】 block
const ANALYSIS_RE = /【解析】\s*([\s\S]*?)$/;

interface RawQuestion {
  number: number;
  chapter: string;
  content: string;
}

interface RawAnswer {
  number: number;
  correctAnswer: string;
  analysis: string;
}

export function parseMineruMarkdown(markdown: string): ParseResult {
  if (!markdown.trim()) {
    return { title: "", questions: [] };
  }

  // Extract title from first line
  const titleLine = markdown.split("\n")[0];
  const title = titleLine.startsWith("# ") ? titleLine.slice(2).trim() : titleLine.trim();

  // Split into lines for sequential parsing
  const lines = markdown.split("\n");

  const rawQuestions: RawQuestion[] = [];
  const rawAnswers: RawAnswer[] = [];
  let currentQuestion: RawQuestion | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for answer header first
    const answerMatch = line.match(ANSWER_HEADER_RE);
    if (answerMatch) {
      // If there's inline content on the same line after 【参考答案】
      const inlineAnswer = line.match(ANSWER_INLINE_RE);
      const answerText = inlineAnswer ? inlineAnswer[1].trim() : "";

      // Collect following lines until next header or 【解析】
      let restLines: string[] = [];
      let analysisText = "";
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (nextLine.match(QUESTION_HEADER_RE) || nextLine.match(ANSWER_HEADER_RE)) {
          break;
        }
        restLines.push(nextLine);
      }

      // Extract 【解析】from the collected lines
      const fullBlock = restLines.join("\n");
      const analysisMatch = fullBlock.match(ANALYSIS_RE);
      if (analysisMatch) {
        analysisText = analysisMatch[1].trim();
        // Remove analysis from rest to get pure answer content
        const beforeAnalysis = fullBlock.replace(ANALYSIS_RE, "").trim();
        rawAnswers.push({
          number: parseInt(answerMatch[1], 10),
          correctAnswer: (answerText || beforeAnalysis).trim(),
          analysis: analysisText,
        });
      } else {
        rawAnswers.push({
          number: parseInt(answerMatch[1], 10),
          correctAnswer: answerText || restLines.join("\n").trim(),
          analysis: "",
        });
      }
      continue;
    }

    // Check for question header (with chapter)
    const questionMatch = line.match(QUESTION_HEADER_RE);
    let questionNumber: number | null = null;
    let questionChapter = "";

    if (questionMatch) {
      questionNumber = parseInt(questionMatch[1], 10);
      questionChapter = questionMatch[2].trim();
    } else {
      // Fallback: question header without chapter info
      const fallback = line.match(QUESTION_HEADER_FALLBACK_RE);
      if (fallback) {
        questionNumber = parseInt(fallback[1], 10);
      }
    }

    if (questionNumber !== null) {
      // Save previous question if exists
      if (currentQuestion) {
        rawQuestions.push(currentQuestion);
      }
      currentQuestion = {
        number: questionNumber,
        chapter: questionChapter,
        content: "",
      };
      continue;
    }

    // Accumulate content for the current question
    if (currentQuestion) {
      // Skip lines that are just whitespace between sections
      if (currentQuestion.content === "" && line.trim() === "") continue;
      currentQuestion.content += (currentQuestion.content ? "\n" : "") + line;
    }
  }

  // Don't forget the last question
  if (currentQuestion) {
    rawQuestions.push(currentQuestion);
  }

  // Merge questions with their answers by number
  const today = new Date().toISOString().slice(0, 10);
  const answerMap = new Map<number, RawAnswer>();
  for (const ra of rawAnswers) {
    answerMap.set(ra.number, ra);
  }

  const questions: ParsedQuestion[] = rawQuestions.map((rq) => {
    const answer = answerMap.get(rq.number);
    return {
      number: rq.number,
      type: "subjective" as const, // MinerU can't reliably detect objective vs subjective from PDF
      chapter: rq.chapter,
      answerDate: today,
      content: rq.content.trim(),
      contentHtml: "", // No HTML from PDF
      rawHtml: "",     // No raw HTML from PDF
      images: [],      // Images are embedded in markdown via mineru but we don't extract them yet
      correctAnswer: answer?.correctAnswer ?? "",
    };
  });

  return { title, questions };
}
