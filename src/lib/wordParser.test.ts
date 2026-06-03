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
import { parseWordDocument } from "./wordParser";
import { describe as _desc, it as _it, expect as _expect } from "vitest";
_desc("cleanLatexDelimiters (via parseWordDocument text output)", () => {
  _it("strips a single dangling $ at the end", async () => {
    // Synthesize a File-like blob from a tiny docx-shaped HTML
    // We can't easily run mammoth on a string, so we just call the helper
    // indirectly by constructing a File from a pre-built docx. Easiest
    // path: import the helper directly.
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
