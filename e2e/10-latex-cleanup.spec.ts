import { test, expect } from "./fixtures";

/**
 * Regression tests for the stray-$ bug. Vision models often wrap plain
 * text in $...$ or leave dangling delimiters; list cards must render
 * without visible $ regardless of the data's source.
 */
test.describe("LaTeX $ 清理（渲染时）", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      try {
        await (window as any).__TEST_CLEAR_DATA__();
      } catch {
        /* ignore */
      }
    });
  });

  test("list card 渲染时清洗掉单挂 $（模拟 vision 误识别遗留）", async ({
    page,
  }) => {
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "$ 测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=$ 测试生");

    // Seed: a question with the EXACT bug the user reported — dangling
    // $ at start and end. Simulates legacy / pre-fix data.
    await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>(
        "SELECT id FROM students WHERE name = ?",
        ["$ 测试生"],
      );
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type,
           content, mastery_score, status)
         VALUES (?, 'math', 'manual', 'objective',
           '计算：$(a+b) ÷ (1/a + 1/b) =$', 0, 'active')`,
        [s[0].id],
      );
    });

    await page.click("text=错题本");
    await page.waitForTimeout(400);

    // The list card must NOT contain a literal $ sign
    const cardText = await page
      .locator("p.line-clamp-2")
      .first()
      .innerText();
    expect(cardText).not.toContain("$");
    expect(cardText).toContain("计算");
    expect(cardText).toContain("(a+b)");
  });

  test("保留合法 LaTeX 配对 $\\frac{1}{x}$", async ({ page }) => {
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "LaTeX生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=LaTeX生");

    await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>(
        "SELECT id FROM students WHERE name = ?",
        ["LaTeX生"],
      );
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type,
           content, mastery_score, status)
         VALUES (?, 'math', 'manual', 'objective',
           '化简 $\\frac{1}{4-a}$ 的值', 0, 'active')`,
        [s[0].id],
      );
    });

    await page.click("text=错题本");
    await page.waitForTimeout(400);

    const cardText = await page
      .locator("p.line-clamp-2")
      .first()
      .innerText();
    // The legit LaTeX pair should be preserved as-is
    expect(cardText).toContain("$\\frac{1}{4-a}$");
    expect(cardText).toContain("化简");
  });
});
