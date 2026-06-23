import { describe, it, expect } from "vitest";
import { parseMineruMarkdown } from "./mineruParser";

const SAMPLE_MD = `# 邵瀚文-数学错题集-20260623

## 原错题1 （题目来源：1.2.4一元二次方程解法（公式法））

用公式法解方程 $2 x - 7 x ^ { 2 } { = } 5$ 时，首先要确定 、 、 的值，下列结论正确的是()A. ， ， B. ， ， C. ， ， D. ， ，

## 原错题2 （题目来源：1.2.4一元二次方程解法（公式法））

一元二次方程 $y ^ { 2 } + 4 y - 8 = 0$ 的解是()A. $y _ { 1 } { = } 2 { + } 2 { \\sqrt { 3 } } \\ , y _ { 2 } { = } 2 { - } 2 { \\sqrt { 3 } }$ B. $y _ { 1 } = 2 + 2 { \\sqrt { 2 } } \\ , y _ { 2 } = 2 - 2 { \\sqrt { 2 } }$ C. $y _ { 1 } = - 2 + 2 { \\sqrt { 2 } } \\ , y _ { 2 } = - 2 - 2 { \\sqrt { 2 } }$ D. $y _ { 1 } = - 2 + 2 { \\sqrt { 3 } } \\ , y _ { 2 } = - 2 - 2 { \\sqrt { 3 } }$

## 原错题3 （题目来源：10.5.3用分式方程解决问题（工程、行程））

某工厂现在平均每天比原计划多生产 台机器，现在生产 台机器所需时间比原计划生产 台机器所需时间少 天

原错题1 【基础题】【参考答案】1.

【解析】略

原错题2 【基础题】【参考答案】1.

【解析】略

## 原错题3 【基础题】【参考答案】 $3 x ^ { 2 } - 8 x + 5 = 0$

【解析】略
`;

describe("parseMineruMarkdown", () => {
  it("parses question number and chapter from header", () => {
    const result = parseMineruMarkdown(SAMPLE_MD);
    expect(result.questions).toHaveLength(3);
    expect(result.questions[0].number).toBe(1);
    expect(result.questions[0].chapter).toBe("1.2.4一元二次方程解法（公式法）");
  });

  it("extracts question content with LaTeX", () => {
    const result = parseMineruMarkdown(SAMPLE_MD);
    expect(result.questions[0].content).toContain("$2 x - 7 x ^ { 2 }");
    expect(result.questions[0].content).toContain("下列结论正确的是");
  });

  it("extracts correct answer from answer section", () => {
    const result = parseMineruMarkdown(SAMPLE_MD);
    expect(result.questions[0].correctAnswer).toBe("1.");
  });

  it("extracts answer with LaTeX content", () => {
    const result = parseMineruMarkdown(SAMPLE_MD);
    // Q3 answer has LaTeX
    expect(result.questions[2].correctAnswer).toContain("$3 x ^ { 2 } - 8 x + 5 = 0$");
  });

  it("returns today's date as answerDate", () => {
    const result = parseMineruMarkdown(SAMPLE_MD);
    const today = new Date().toISOString().slice(0, 10);
    for (const q of result.questions) {
      expect(q.answerDate).toBe(today);
    }
  });

  it("has empty contentHtml and images for PDF import", () => {
    const result = parseMineruMarkdown(SAMPLE_MD);
    for (const q of result.questions) {
      expect(q.contentHtml).toBe("");
      expect(q.images).toEqual([]);
      expect(q.rawHtml).toBe("");
    }
  });

  it("returns title from the first line", () => {
    const result = parseMineruMarkdown(SAMPLE_MD);
    expect(result.title).toBe("邵瀚文-数学错题集-20260623");
  });

  it("handles question without chapter info gracefully", () => {
    const mdWithoutChapter = `# Test
原错题1 
简单内容`;
    const result = parseMineruMarkdown(mdWithoutChapter);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].chapter).toBe("");
  });

  it("returns all questions even without answers", () => {
    const mdNoAnswer = `# Test
## 原错题1 （题目来源：章节A）
纯题目没有答案`;
    const result = parseMineruMarkdown(mdNoAnswer);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].correctAnswer).toBe("");
  });

  it("returns empty result for empty input", () => {
    const result = parseMineruMarkdown("");
    expect(result.questions).toEqual([]);
    expect(result.title).toBe("");
  });
});
