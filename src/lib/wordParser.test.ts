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
