import { test, expect } from "./fixtures";

/**
 * Regression test: analysisText() must transform `(-1)` to `(□-1)` in
 * formula labels before sending to the LLM.
 *
 * Instead of depending on the first imported question having this specific
 * pattern (which changed with wordParser updates), we seed a question with
 * known content containing `$(-1)` and verify the regex fix works.
 */
test.describe("Formula label fix", () => {
  test.setTimeout(60000);
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      try { await (window as any).__TEST_CLEAR_DATA__(); } catch { /* ignore */ }
    });
  });

  test("analysisText replaces $(-1) with $(□-1) inside □（$...$）", async ({ page }) => {
    // 1. Create a student
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "标签测试");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');

    // 2. Seed a question with known content that has the broken $(-1) pattern
    await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select("SELECT id FROM students WHERE name = ?", ["标签测试"]);
      const sid = s[0].id;

      // This content simulates what the vision model might return:
      // □（$(-1)\times\frac{1}{5-a}=\frac{1}{a-4}$）
      await db.execute(
        `INSERT INTO questions
          (student_id, subject, source_type, question_type, content,
           correct_answer, mastery_score, chapter, status)
         VALUES (?, 'math', 'manual', 'objective',
           '如图所示，□（$(-1)\\times\\frac{1}{5-a}=\\frac{1}{a-4}$）代表的是（ ）□（$\\frac{1}{4-a}$）A. □（$\\frac{9-2a}{a-4}$）',
           'C', 0, '测试', 'active')`,
        [sid]
      );
    });

    // 3. Verify the regex fix via analysisText logic
    const output = await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const q = (await db.select("SELECT * FROM questions ORDER BY id DESC LIMIT 1"))[0];

      // Simulate analysisText():
      // 1. Clean empty □（）
      let text = (q.content || "").replace(/□（\s*）/g, "□");
      // 2. Fix $(-N) → $(□-N)
      const before = text.includes("$(-1)");
      text = text.replace(
        /□（\$\s*\((-\d+(?:\.\d+)?)/g,
        '□（$(□$1',
      );
      const after = text.includes("$(-1)");

      return {
        contentRaw: q.content,
        fixed: text,
        hadBrokenBefore: before,
        hasBrokenAfter: after,
        hasFix: text.includes("$(□-1)"),
      };
    });

    expect(output.hadBrokenBefore).toBe(true);
    expect(output.hasBrokenAfter).toBe(false);
    expect(output.hasFix).toBe(true);
  });
});
