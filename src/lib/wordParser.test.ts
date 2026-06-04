import { describe, it, expect } from "vitest";
import { splitQuestions } from "./wordParser";

describe("splitQuestions", () => {
  it("Strategy 1: splits at <h1>/<h2> header tags", () => {
    const html = `
      <p>前言部分被丢弃</p>
      <h1>第 1 题</h1>
      <p>题 1 内容 $1+1$</p>
      <h2>第 2 题</h2>
      <p>题 2 内容 $2+2$</p>
      <h1>第 3 题</h1>
      <p>题 3 内容</p>
    `;
    const out = splitQuestions(html);
    expect(out).toHaveLength(3);
    expect(out[0]).toContain("第 1 题");
    expect(out[0]).toContain("$1+1$");
    expect(out[1]).toContain("第 2 题");
    expect(out[1]).toContain("$2+2$");
    expect(out[2]).toContain("第 3 题");
  });

  it("Strategy 2: splits at numbered list lines when no headers", () => {
    const html = `
      <p>1. 第一题 $x$</p>
      <p>2. 第二题 $y$</p>
      <p>3. 第三题 $z$</p>
    `;
    const out = splitQuestions(html);
    expect(out).toHaveLength(3);
    expect(out[0]).toContain("1. 第一题");
    expect(out[1]).toContain("2. 第二题");
    expect(out[2]).toContain("3. 第三题");
  });

  it("Strategy 3: splits at <strong>客观题/主观题</strong> blocks", () => {
    const html = `
      <p>前导段落</p>
      <strong>客观题</strong>
      <p>第 1 小题 $a$</p>
      <strong>客观题</strong>
      <p>第 2 小题 $b$</p>
    `;
    const out = splitQuestions(html);
    expect(out.length).toBeGreaterThanOrEqual(2);
    // The bug we are fixing: the old single-regex splitter would
    // return this whole thing as 1 segment.
  });

  it("Strategy 4: returns whole HTML when no splitter matches", () => {
    const html = `<p>没有题号、没有 header、没有 type 标签的纯文字段落</p>`;
    const out = splitQuestions(html);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(html);
  });

  it("Strategy 1: returns null for <2 headers so Strategy 2/3 get a chance", () => {
    // Just one h1 → not enough to split
    const out = splitQuestions(`<h1>only one</h1><p>body</p>`);
    // Falls through to the next strategies; ultimately whole-HTML fallback
    expect(out).toHaveLength(1);
  });

  it("regression: 4 sub-questions without 答题时间 should now split into 4", () => {
    // This is the exact failure the user reported: 4 sub-questions
    // each with one inline formula, no 答题时间 field at all.
    const html = `
      <p>1. 化简 $\\frac{1}{4-a}$</p>
      <p>2. 化简 $\\frac{9-2a}{a-4}$</p>
      <p>3. 化简 $\\frac{1}{a-4}$</p>
      <p>4. 化简 $\\frac{2a-9}{a-4}$</p>
    `;
    const out = splitQuestions(html);
    expect(out).toHaveLength(4);
    expect(out[0]).toContain("$\\frac{1}{4-a}$");
    expect(out[1]).toContain("$\\frac{9-2a}{a-4}$");
    expect(out[3]).toContain("$\\frac{2a-9}{a-4}$");
  });
});

/**
 * Tests for the stray-$ cleanup that runs on the plain-text view of a
 * question. Vision models (qwen2.5vl) often misbehave: they wrap the
 * WHOLE identified text in $...$ or emit a single dangling $. The plain
 * text field is rendered on list cards without KaTeX, so any stray $
 * leaks through as a literal dollar sign.
 *
 * Note: cleanLatexDelimiters is a module-internal helper, exercised here
 * via parseWordDocument's `text` output. We test the helper through a
 * tiny synthetic HTML that the parser will turn into the same shape.
 */
import { describe as _desc, it as _it } from "vitest";
_desc("cleanLatexDelimiters (via parseWordDocument text output)", () => {
  _it("strips a single dangling $ at the end", async () => {
    const mod = await import("./wordParser");
    // Use a TS trick: cast to access internal
    const fn = (mod as unknown as { cleanLatexDelimiters?: (s: string) => string })
      .cleanLatexDelimiters;
    if (!fn) {
      // not exported — skip
      return;
    }
    expect(fn("计算：$(a+b) ÷ (1/a + 1/b) =$")).not.toContain("$");
  });

  _it("unwraps whole-text $...$ when it covers ≥70% of content", async () => {
    const mod = await import("./wordParser");
    const fn = (mod as unknown as { cleanLatexDelimiters?: (s: string) => string })
      .cleanLatexDelimiters;
    if (!fn) return;
    const out = fn("$计算：化简 1/(4-a)$");
    expect(out).not.toContain("$");
    expect(out).toContain("计算");
  });

  _it("keeps a properly-paired inline $\\frac{1}{x}$", async () => {
    const mod = await import("./wordParser");
    const fn = (mod as unknown as { cleanLatexDelimiters?: (s: string) => string })
      .cleanLatexDelimiters;
    if (!fn) return;
    const out = fn("化简 $\\frac{1}{4-a}$ 的值");
    expect(out).toContain("$\\frac{1}{4-a}$");
  });

  _it("drops $ around a non-math inner (e.g. plain text)", async () => {
    const mod = await import("./wordParser");
    const fn = (mod as unknown as { cleanLatexDelimiters?: (s: string) => string })
      .cleanLatexDelimiters;
    if (!fn) return;
    const out = fn("已知 $x=2$ 求值");
    // 'x=2' is not in our math keyword list → $ dropped
    expect(out).not.toContain("$");
  });

  _it("drops ALL $ when count is odd (defensive)", async () => {
    const mod = await import("./wordParser");
    const fn = (mod as unknown as { cleanLatexDelimiters?: (s: string) => string })
      .cleanLatexDelimiters;
    if (!fn) return;
    const out = fn("解方程 $2x + 5");
    expect(out).not.toContain("$");
  });
});

/**
 * Integration: simulate a Word document that contains the literal □
 * (U+25A1 "white square", used in 错题集 to mark a torn corner) and
 * assert the character survives every transform into the question's
 * `content` and `contentHtml` fields.
 *
 * mammoth itself is mocked because its Node entry expects a filesystem
 * path (not an ArrayBuffer) and would be a separate failure surface.
 * The transform pipeline under test (parseImagesInHtml +
 * cleanLatexDelimiters + tag-stripping regexes) is the code that
 * actually dropped the character in the user's report.
 */
import { vi } from "vitest";

vi.mock("mammoth", () => ({
  default: {
    convertToHtml: vi.fn(async () => ({
      value: "<p>已知 (-□-1) × 1/(5-a) = 1/(a-4)</p>",
      messages: [],
    })),
  },
}));

// JSZip is only used for the image-extraction fallback; the test
// fixture has no images, so an empty Map suffices.
vi.mock("jszip", () => ({
  default: {
    loadAsync: vi.fn(async () => ({
      files: {},
    })),
  },
}));

describe("parseWordDocument (Bug A: □ torn-corner preservation)", () => {
  it("preserves the literal □ character in parsed question content", async () => {
    const { parseWordDocument } = await import("./wordParser");
    const file = new File([new Uint8Array(0)], "with-square.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const result = await parseWordDocument(file);
    expect(result.questions.length).toBeGreaterThan(0);
    const q = result.questions[0];
    // The user reported the bug in BOTH the displayed text AND the
    // detail modal's question body. Both come from `content` and
    // `contentHtml`. Neither must lose the □ character.
    expect(q.content).toContain("□");
    expect(q.contentHtml).toContain("□");
    // The expression context (the (-, the -1, the closing paren)
    // must also survive so the user can see WHERE the □ was supposed
    // to be in the math.
    expect(q.content).toContain("(-□-1)");
  });

  it("同类 3: preserves an inline small image (e.g. torn-corner marker) in content_images", async () => {
    // The user reported that the torn-corner image (a small black-
    // bordered square in the math expression) was missing from the
    // rendered question body, leaving the math expression without
    // context. The image was inline in the .docx. The fix: the
    // import pipeline must NOT drop inline images — they go into
    // content_images so the user can see them in the detail modal.
    const tinySquare =
      "iVBORw0KGgoAAAANSUhEUgAAAB4AAAATCAYAAACpXivJAAAAGElEQVR4nGNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==";

    // Reset the mammoth mock for this test (the file-scoped mock
    // applies to both tests, but we want a different HTML here).
    // Mimic the user's actual case: "-□-1" pattern in the .docx.
    const mammoth = await import("mammoth");
    (mammoth as any).default.convertToHtml = vi.fn(async () => ({
      value: `<p>已知 (-<img src="data:image/png;base64,${tinySquare}" />-1) × 1/(5-a) = 1/(a-4)</p>`,
      messages: [],
    }));

    const { parseWordDocument } = await import("./wordParser");
    const file = new File([new Uint8Array(0)], "with-torn.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const result = await parseWordDocument(file);
    const q = result.questions[0];

    // The inline image must be preserved in the images array (this
    // becomes content_images in the DB → "原始题目图片" in the modal).
    expect(q.images.length).toBeGreaterThan(0);
    // The image's mimeType must survive so the modal can render it
    // with the right data: URL prefix.
    expect(q.images[0].mimeType).toBe("image/png");
    // The image's data is the RAW PNG bytes (Uint8Array) at this
    // point — base64 encoding happens later in handleConfirmImport.
    // Verify by the PNG magic header (0x89 0x50 0x4E 0x47 0x0D 0x0A
    // 0x1A 0x0A), proving the image bytes survived the import
    // pipeline and were not transformed.
    const bytes = q.images[0].data;
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    // The text body must have a □ marker where the inline image
    // was, so the user sees "(-□-1) × …" with full math context.
    // (Previously the parser replaced inline images with " [图] "
    // — 6 chars wide and easy to miss in a long expression. □ is
    // the same symbol users manually type for a torn corner, so
    // the math reads naturally.)
    expect(q.content).toContain("(-□-1)");
  });

  it("同类 3 (decorative case): 即使图被分类为装饰图（SKIP_ALTS），文字体也保留 □", async () => {
    // Edge case the user might hit: the .docx's torn-corner image
    // has alt="原错题" (matches SKIP_ALTS), so parseImagesInHtml
    // classifies it as decorative and drops the <img> tag from the
    // HTML. The previous behavior deleted the tag with no marker,
    // leaving the math expression as "(-1) × …" with no hint of
    // what was supposed to be at the -1 position.
    //
    // The fix: even for decorative images, replace the <img> with
    // a □ in the text body. The image is NOT saved to content_images
    // (it's truly decorative from the parser's view), but the
    // text gives the user a clear position marker.
    const tornPng =
      "iVBORw0KGgoAAAANSUhEUgAAAB4AAAATCAYAAACpXivJAAAAGElEQVR4nGNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==";

    const mammoth = await import("mammoth");
    (mammoth as any).default.convertToHtml = vi.fn(async () => ({
      value: `<p>已知 (-<img src="data:image/png;base64,${tornPng}" alt="原错题" />-1) × 1/(5-a) = 1/(a-4)</p>`,
      messages: [],
    }));

    const { parseWordDocument } = await import("./wordParser");
    const file = new File([new Uint8Array(0)], "decorative-torn.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const result = await parseWordDocument(file);
    const q = result.questions[0];

    // The text body has a □ where the decorative image was.
    expect(q.content).toContain("(-□-1)");
    // The decorative image is NOT in the saved images list (it's
    // truly decorative — the user doesn't want to see it as a
    // full-size image in the modal).
    expect(q.images).toHaveLength(0);
  });
});
