import { useMemo } from "react";
import katex from "katex";

interface MathContentProps {
  text: string;
  className?: string;
}

function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return displayMode
      ? `<span class="text-red-500">$$${latex}$$</span>`
      : `<span class="text-red-500">$${latex}$</span>`;
  }
}

/**
 * Parse text into segments: plain text, inline math, display math.
 * Also unwrap [图: ...] markers.
 */
function parseSegments(text: string): { type: "text" | "math" | "display"; content: string }[] {
  const segments: { type: "text" | "math" | "display"; content: string }[] = [];

  // Replace [图: ...] with just the inner content
  const cleaned = text.replace(/\[图:\s*([^\]]+)\]/g, "$1");

  // Pattern: display math $$...$$ first, then inline math $...$
  const regex = /(\$\$[\s\S]*?\$\$)|(\$[\s\S]*?\$)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: cleaned.slice(lastIndex, match.index),
      });
    }

    const raw = match[0];
    if (raw.startsWith("$$") && raw.endsWith("$$")) {
      segments.push({
        type: "display",
        content: raw.slice(2, -2).trim(),
      });
    } else if (raw.startsWith("$") && raw.endsWith("$")) {
      segments.push({
        type: "math",
        content: raw.slice(1, -1).trim(),
      });
    }

    lastIndex = match.index + raw.length;
  }

  // Remaining plain text
  if (lastIndex < cleaned.length) {
    segments.push({ type: "text", content: cleaned.slice(lastIndex) });
  }

  return segments;
}

/**
 * Detect if a text segment looks like raw LaTeX that wasn't wrapped in $...$.
 * LLM output sometimes includes \frac, \sqrt, \times etc. without $ delimiters.
 */
const RAW_LATEX_RE = /\\[a-zA-Z]+[{[]/;

function looksLikeLatex(s: string): boolean {
  return RAW_LATEX_RE.test(s);
}

export function MathContent({ text, className = "" }: MathContentProps) {
  const html = useMemo(() => {
    const segments = parseSegments(text);
    return segments
      .map((seg) => {
        if (seg.type === "text") {
          const textContent = seg.content
            .replace(/\[图片\]/g, '<span class="text-gray-400 italic">[图片]</span>')
            .replace(/\n/g, "<br/>");
          // If the text segment contains raw LaTeX, render it as inline math.
          // This catches cases where the LLM output \frac{...}{...} without
          // wrapping in $ delimiters.
          if (looksLikeLatex(textContent)) {
            return renderLatex(textContent, false);
          }
          return textContent;
        }
        if (seg.type === "display") {
          return `<div class="my-2">${renderLatex(seg.content, true)}</div>`;
        }
        return renderLatex(seg.content, false);
      })
      .join("");
  }, [text]);

  return (
    <span
      className={`math-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
