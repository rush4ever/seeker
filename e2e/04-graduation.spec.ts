import { test, expect } from "./fixtures";

test.describe("#21 毕业触发", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      try { await (window as any).__TEST_CLEAR_DATA__(); } catch { /* ignore */ }
    });
  });

  test("已毕业 chip 在 QuestionsPage 列表正确显示", async ({ page }) => {
    // 1. Add student via UI
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "毕业测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=毕业测试生");

    // 2. Seed: one graduated + one active (with content_html for visible rendering)
    await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>("SELECT id FROM students WHERE name = ?", ["毕业测试生"]);
      const sid = s[0].id;
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type, content,
          content_html, correct_answer, error_cause, difficulty, mastery_score, chapter, status)
         VALUES (?, 'math', 'manual', 'objective', '毕业题', '毕业题', 'A', 'concept', 'easy', 95, 'x', 'graduated')`,
        [sid]
      );
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type, content,
          content_html, correct_answer, error_cause, difficulty, mastery_score, chapter, status)
         VALUES (?, 'math', 'manual', 'objective', '未毕业题', '未毕业题', 'B', 'careless', 'medium', 50, 'y', 'active')`,
        [sid]
      );
    });

    // 3. Navigate to questions page
    await page.click("text=错题本");
    await expect(page.locator('h2:has-text("错题本")')).toBeVisible();

    // 4. Verify "已毕业" chip visible (rendered in graduated question's badge row)
    await expect(page.locator("text=已毕业").first()).toBeVisible({ timeout: 10000 });

    // 5. Verify "未毕业题" content is visible (chip-less row)
    await expect(page.locator("text=未毕业题").first()).toBeVisible();

    // 6. Verify graduated question content is also visible
    await expect(page.locator("text=毕业题").first()).toBeVisible();
  });
});
