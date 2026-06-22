import { test, expect } from "./fixtures";

/**
 * Focused regression test for question import bug:
 * After fix, questions should appear in the list after import.
 * Tests the full flow: student creation → import docx → verify questions.
 */
const TEST_DOCX_MATH = "./refer/邵瀚文-数学错题集-20260514.docx";

test.describe("错题导入回归测试", () => {
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      try { await (window as any).__TEST_CLEAR_DATA__(); } catch { /* ignore */ }
    });
  });

  test("导入 docx 后错题出现在错题本列表中", async ({ page }) => {
    // 1. Add a student — auto-selected and navigates to home
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "导入测试");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await expect(page.locator('h1:has-text("导入测试")')).toBeVisible({ timeout: 5000 });

    // 2. Go to questions page
    await page.click("text=错题本");
    await expect(page.locator("text=暂无错题")).toBeVisible();

    // 3. Import a .docx file
    await page.click('button:has-text("导入 Word")');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_DOCX_MATH);

    // 4. Wait for confirmation dialog
    await expect(page.locator('h3:has-text("确认导入")')).toBeVisible({ timeout: 30000 });

    // 5. Confirm import
    await page.click('button:has-text("确认导入")');

    // 6. **THE CRITICAL ASSERTION**: questions appear in the list
    // Wait for the dialog to close and questions to load
    await expect(page.locator('h3:has-text("确认导入")')).not.toBeVisible({ timeout: 10000 });

    // Verify the empty state is gone
    await expect(page.locator("text=暂无错题")).not.toBeVisible({ timeout: 10000 });

    // Verify at least one question card renders
    const firstContent = await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const r = await db.select("SELECT COUNT(*) as c FROM questions");
      return r[0].c;
    });
    expect(firstContent).toBe(12);
  });
});
