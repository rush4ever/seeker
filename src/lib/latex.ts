/**
 * LaTeX rendering utilities shared by the UI (MathContent), the
 * browser PDF renderer (renderPdf), and the browser Word renderer
 * (renderWord).
 *
 *  - parseSegments: tokenize plain text into text / inline-math ($...$)
 *    / display-math ($$...$$) segments. Unwraps `[图: ...]` markers.
 *  - katexToHtml:    render a single LaTeX string to HTML+CSS via KaTeX.
 *  - katexToPng:     render a single LaTeX string to a PNG buffer
 *    (for embedding into PDF / Word where KaTeX HTML is not an option).
 *    Uses a hidden DOM, foreignObject SVG, and a canvas snapshot.
 *    Falls back to a per-span canvas walk when foreignObject is
 *    unavailable (some Tauri webviews).
 *
 * KaTeX is the only dependency.
 */
import katex from "katex";

export type Segment =
  | { type: "text"; content: string }
  | { type: "math"; content: string }
  | { type: "display"; content: string };

/**
 * Parse plain text into a sequence of plain-text, inline-math, and
 * display-math segments. `$$...$$` is matched before `$...$` so a
 * `$$` always opens a display block. Also unwraps `[图: ...]` markers
 * (the description inside becomes plain text).
 */
export function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];

  const cleaned = text.replace(/\[图:\s*([^\]]+)\]/g, "$1");

  // Display math first, then inline math. Non-greedy match.
  const regex = /(\$\$[\s\S]*?\$\$)|(\$[\s\S]*?\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: cleaned.slice(lastIndex, match.index),
      });
    }

    const raw = match[0];
    if (raw.startsWith("$$") && raw.endsWith("$$")) {
      segments.push({ type: "display", content: raw.slice(2, -2).trim() });
    } else if (raw.startsWith("$") && raw.endsWith("$")) {
      segments.push({ type: "math", content: raw.slice(1, -1).trim() });
    }

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < cleaned.length) {
    segments.push({ type: "text", content: cleaned.slice(lastIndex) });
  }

  return segments;
}

/**
 * Render a LaTeX string to a KaTeX HTML+CSS string. Safe on bad input
 * (KaTeX with `throwOnError: false` returns the input wrapped in a
 * red span on error).
 */
export function katexToHtml(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    // Should not happen with throwOnError: false, but keep the
    // boundary so a future KaTeX change can't break the export.
    return displayMode
      ? `<span style="color:#dc2626">$$${escapeHtml(latex)}$$</span>`
      : `<span style="color:#dc2626">$${escapeHtml(latex)}$</span>`;
  }
}

export interface PngResult {
  /** Raw PNG bytes. */
  png: Uint8Array;
  /** Natural width of the rendered math in CSS pixels. */
  width: number;
  /** Natural height of the rendered math in CSS pixels. */
  height: number;
}

/**
 * Render a LaTeX string to a PNG suitable for embedding in PDF/Word.
 *
 * Uses a hidden off-screen DOM, KaTeX to fill it, then a foreignObject
 * SVG → Image → Canvas pipeline. Some Tauri webviews (WebView2 /
 * wkwebview on certain OS versions) reject SVG with embedded
 * foreignObject. We detect that failure and fall back to a per-span
 * canvas walk that draws each text node directly.
 *
 * @param scale  Render at `scale × natural` resolution. Default 2
 *   is plenty for print legibility. 0.4 is fine for inline math.
 */
export async function katexToPng(
  latex: string,
  displayMode: boolean,
  scale = 2,
): Promise<PngResult> {
  if (typeof document === "undefined") {
    throw new Error("katexToPng requires a browser environment (document)");
  }

  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.background = "#ffffff";
  container.style.padding = "4px";
  // CJK in math mode (\text{解}) inherits the parent font; set a chain
  // that covers the platforms we ship to.
  container.style.fontFamily =
    '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif';
  container.style.color = "#000000";
  document.body.appendChild(container);

  try {
    katex.render(latex, container, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width));
    const height = Math.max(1, Math.ceil(rect.height));

    const png = await rasterize(container, width, height, scale);
    return { png, width, height };
  } finally {
    container.remove();
  }
}

/* ------------------------------------------------------------------ */
/*                              Internals                              */
/* ------------------------------------------------------------------ */

async function rasterize(
  source: HTMLElement,
  width: number,
  height: number,
  scale: number,
): Promise<Uint8Array> {
  // Try the foreignObject path first.
  try {
    return await rasterizeViaForeignObject(source, width, height, scale);
  } catch {
    // Fall through to the canvas-walk fallback.
  }
  return rasterizeViaCanvasWalk(source, width, height, scale);
}

async function rasterizeViaForeignObject(
  source: HTMLElement,
  width: number,
  height: number,
  scale: number,
): Promise<Uint8Array> {
  const xhtml = new XMLSerializer().serializeToString(source);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">${xhtml}</foreignObject>
    </svg>
  `.trim();

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await canvasToPngBytes(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG image load failed"));
    img.src = url;
  });
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("canvas.toBlob returned null"));
        return;
      }
      const buffer = await blob.arrayBuffer();
      resolve(new Uint8Array(buffer));
    }, "image/png");
  });
}

/**
 * Pure-canvas fallback for environments where SVG foreignObject is
 * unavailable (some Tauri webviews). Walks every text node inside
 * KaTeX's output, computes its absolute position via
 * `getBoundingClientRect`, and draws it with `fillText`. This is
 * approximate — it ignores glyph positioning tricks that KaTeX uses
 * for things like \sqrt, so the output may be uglier than the
 * foreignObject path. But it always works.
 */
async function rasterizeViaCanvasWalk(
  source: HTMLElement,
  width: number,
  height: number,
  scale: number,
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "middle";

  const baseRect = source.getBoundingClientRect();

  const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = (node.nodeValue ?? "").trim();
    if (!text) continue;
    const parent = node.parentElement;
    if (!parent) continue;
    const r = parent.getBoundingClientRect();
    const fontSize = parseFloat(getComputedStyle(parent).fontSize) || 16;
    const fontFamily = getComputedStyle(parent).fontFamily;
    ctx.font = `${fontSize * scale}px ${fontFamily}`;
    ctx.fillText(
      text,
      (r.left - baseRect.left) * scale,
      (r.top - baseRect.top + r.height / 2) * scale,
    );
  }

  return await canvasToPngBytes(canvas);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
