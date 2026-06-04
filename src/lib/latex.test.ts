// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { parseSegments, katexToHtml } from "./latex";

describe("parseSegments", () => {
  it("returns a single text segment when there is no math", () => {
    expect(parseSegments("普通文字")).toEqual([
      { type: "text", content: "普通文字" },
    ]);
  });

  it("splits inline $...$ from surrounding text", () => {
    expect(parseSegments("已知 $x^2$ 的解")).toEqual([
      { type: "text", content: "已知 " },
      { type: "math", content: "x^2" },
      { type: "text", content: " 的解" },
    ]);
  });

  it("splits display $$...$$ from surrounding text", () => {
    expect(parseSegments("推导 $$\\frac{a}{b}$$ 结论")).toEqual([
      { type: "text", content: "推导 " },
      { type: "display", content: "\\frac{a}{b}" },
      { type: "text", content: " 结论" },
    ]);
  });

  it("matches display $$ before inline $ (greedy precedence)", () => {
    // The $$ pair must close the display block, not be split into two
    // inline blocks. KaTeX in practice: $$\frac{1}{2}$$ renders as a
    // single display block.
    expect(parseSegments("$$\\frac{1}{2}$$")).toEqual([
      { type: "display", content: "\\frac{1}{2}" },
    ]);
  });

  it("unwraps [图: ...] markers to plain text", () => {
    expect(parseSegments("看 [图: 三角形ABC] 思考")).toEqual([
      { type: "text", content: "看 三角形ABC 思考" },
    ]);
  });

  it("handles multiple math segments in one string", () => {
    expect(parseSegments("$a$ 和 $b$")).toEqual([
      { type: "math", content: "a" },
      { type: "text", content: " 和 " },
      { type: "math", content: "b" },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseSegments("")).toEqual([]);
  });
});

describe("katexToHtml", () => {
  it("returns a non-empty string for valid LaTeX", () => {
    const html = katexToHtml("x^2", false);
    expect(html).toBeTruthy();
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });

  it("returns a different (display) result for displayMode", () => {
    const inline = katexToHtml("\\frac{1}{2}", false);
    const display = katexToHtml("\\frac{1}{2}", true);
    expect(display).toBeTruthy();
    expect(inline).not.toEqual(display);
  });

  it("does not throw on malformed LaTeX (returns a fallback span)", () => {
    // KaTeX with throwOnError: false returns the input wrapped in a
    // red span for unparseable input.
    const html = katexToHtml("\\notacommand", false);
    expect(html).toBeTruthy();
    expect(typeof html).toBe("string");
  });
});
