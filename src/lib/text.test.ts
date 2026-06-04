import { describe, it, expect } from "vitest";
import { cleanLatexDelimiters, cleanLatexDelimitersInHtml } from "./text";

describe("cleanLatexDelimiters", () => {
  it("returns input unchanged when no $ present", () => {
    expect(cleanLatexDelimiters("解方程 2x + 5 = 13")).toBe("解方程 2x + 5 = 13");
  });

  it("returns empty string for empty input", () => {
    expect(cleanLatexDelimiters("")).toBe("");
  });

  it("strips a single dangling $ at the end (the exact bug user reported)", () => {
    const out = cleanLatexDelimiters("计算：$(a+b) ÷ (1/a + 1/b) =$");
    expect(out).not.toContain("$");
    expect(out).toContain("计算");
    expect(out).toContain("(a+b)");
  });

  it("unwraps whole-text $...$ when it covers ≥70% of content", () => {
    const out = cleanLatexDelimiters("$计算：化简 1/(4-a)$");
    expect(out).not.toContain("$");
    expect(out).toContain("计算");
    expect(out).toContain("1/(4-a)");
  });

  it("keeps a properly-paired inline $\\frac{1}{x}$", () => {
    const out = cleanLatexDelimiters("化简 $\\frac{1}{4-a}$ 的值");
    expect(out).toContain("$\\frac{1}{4-a}$");
  });

  it("drops $ around a non-math inner (e.g. plain text)", () => {
    const out = cleanLatexDelimiters("已知 $x=2$ 求值");
    // 'x=2' is not in our math keyword list → $ dropped
    expect(out).not.toContain("$");
    expect(out).toContain("x=2");
  });

  it("drops ALL $ when count is odd (defensive)", () => {
    const out = cleanLatexDelimiters("解方程 $2x + 5");
    expect(out).not.toContain("$");
  });

  it("handles multiple pairs: keep math, drop non-math", () => {
    const input = "若 $\\frac{1}{2}$ 加 $2$ 等于";
    const out = cleanLatexDelimiters(input);
    expect(out).toContain("$\\frac{1}{2}$");
    expect(out).not.toContain("$2$");
    expect(out).toContain("2");
  });

  it("preserves Chinese punctuation and spacing", () => {
    const out = cleanLatexDelimiters("化简 $\\frac{1}{x}$ 的值：");
    expect(out).toContain("$\\frac{1}{x}$");
    expect(out).toContain("化简");
    expect(out).toContain("的值");
  });

  it("preserves the □ torn-corner placeholder character (Bug A regression)", () => {
    // The user reported that "已知 (-□-1) × 1/(5-a) = 1/(a-4)" lost
    // the □ character after import, leaving "-1" with no marker for
    // the torn corner. The cleaner must NOT eat non-$ characters.
    const out = cleanLatexDelimiters("已知 (-□-1) × 1/(5-a) = 1/(a-4)");
    expect(out).toContain("□");
    expect(out).toContain("(-□-1)");
  });
});

describe("cleanLatexDelimitersInHtml (DOM-only — skipped in Node)", () => {
  it("returns input unchanged when no $ present", () => {
    expect(cleanLatexDelimitersInHtml("<p>解方程 2x+5=13</p>")).toBe(
      "<p>解方程 2x+5=13</p>",
    );
  });
  // Browser-only behavioral tests live in e2e/10 — vitest in Node has no
  // DOMParser. The 10-latex-cleanup e2e covers the content_html path
  // with the exact user-reported bug string.
});
