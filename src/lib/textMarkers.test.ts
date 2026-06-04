import { describe, it, expect } from "vitest";
import {
  INLINE_IMAGE_MARKER,
  INLINE_FORMULA_IMG_RE,
  VISION_DESCRIPTION_RE,
} from "./textMarkers";

describe("textMarkers strategy (Bug A regression: □ is a single source of truth)", () => {
  it("INLINE_IMAGE_MARKER is the literal □ (U+25A1)", () => {
    // The marker must be a single grapheme that survives every
    // pipeline pass (KaTeX, MathContent, HTML, plain text) so the
    // user always sees the position hint in the math expression.
    expect(INLINE_IMAGE_MARKER).toBe("□");
    expect(INLINE_IMAGE_MARKER.length).toBe(1);
    expect(INLINE_IMAGE_MARKER.codePointAt(0)).toBe(0x25a1);
  });

  it("INLINE_FORMULA_IMG_RE matches the inline-formula <img> tag", () => {
    const html = `<p>已知 (<img src="data:image/png;base64,..." class="inline-formula" />-1) × 1/(5-a)</p>`;
    const matches = html.match(INLINE_FORMULA_IMG_RE);
    expect(matches).toHaveLength(1);
    expect(matches![0]).toContain("inline-formula");
  });

  it("INLINE_FORMULA_IMG_RE does NOT match images without inline-formula class", () => {
    // A regular image (e.g. vision-parsed) should NOT be replaced by
    // the inline marker — it stays as an <img> and renders inline,
    // or is handled by the vision-description path.
    const html = `<p><img src="data:image/png;base64,..." alt="homework" /></p>`;
    expect(html.match(INLINE_FORMULA_IMG_RE)).toBeNull();
  });

  it("VISION_DESCRIPTION_RE matches [图: description] markers", () => {
    const text = "已知 [图: 一元一次方程] 的解为 x=2";
    const matches = [...text.matchAll(VISION_DESCRIPTION_RE)];
    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toBe("一元一次方程");
  });

  it("VISION_DESCRIPTION_RE does NOT collide with INLINE_IMAGE_MARKER (□)", () => {
    // The two marker categories use distinct syntaxes (`[图:…]`
    // vs `□`) so a question body that has both renders both
    // correctly.
    const text = `已知 [图: 分式] 解法: (-□-1) × 1/(5-a)`;
    expect([...text.matchAll(VISION_DESCRIPTION_RE)]).toHaveLength(1);
    expect(text.includes(INLINE_IMAGE_MARKER)).toBe(true);
  });

  it("strategy is end-to-end: inline-formula img in real HTML becomes the marker via the regex", () => {
    // The end-to-end use case: the Word-import pipeline produces
    // HTML with inline-formula imgs; the parser's `text` builder
    // applies INLINE_FORMULA_IMG_RE to leave INLINE_IMAGE_MARKER
    // in place of the img. This test pins that contract.
    const updatedHtml = `<p>已知 (<img class="inline-formula" src="data:..." />-1) × 1/(5-a)</p>`;
    const text = updatedHtml
      .replace(INLINE_FORMULA_IMG_RE, INLINE_IMAGE_MARKER)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    expect(text).toBe("已知 (□-1) × 1/(5-a)");
  });
});
