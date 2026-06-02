import { test, expect } from "./fixtures";

/**
 * E2E tests for PDF/Word export of question sets.
 * The Rust export_pdf / export_word commands are mocked in
 * mock-tauri.ts, plus a plugin:dialog|save fallback that returns
 * a fake path so the browser-mode flow runs end-to-end.
 */

test.describe("PDF / Word 导出", () => {
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

  test("错题本页导出按钮：点击 PDF 触发 export_pdf", async ({ page }) => {
    // Add a student + 2 questions directly via DB
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "导出测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=导出测试生");

    await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>(
        "SELECT id FROM students WHERE name = ?",
        ["导出测试生"],
      );
      const sid = s[0].id;
      for (let i = 0; i < 2; i++) {
        await db.execute(
          `INSERT INTO questions (student_id, subject, source_type, question_type,
             content, mastery_score, status)
           VALUES (?, 'math', 'manual', 'objective', ?, 0, 'active')`,
          [sid, `测试题 ${i + 1}`],
        );
      }
    });

    // Capture console to confirm export_pdf mock ran
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      consoleLogs.push(msg.text());
    });

    // Navigate to 错题本
    await page.click("text=错题本");
    await page.waitForTimeout(400);

    // The export button group is rendered in the page header
    const pdfBtn = page.locator('button:has-text("导出 PDF")');
    await expect(pdfBtn).toBeVisible();

    // Register dialog handler BEFORE clicking so we don't miss the alert
    let alertText = "";
    page.once("dialog", async (dialog) => {
      alertText = dialog.message();
      await dialog.dismiss();
    });

    await pdfBtn.click();
    // give the export flow time to resolve
    await page.waitForTimeout(800);

    // The mock console.log fires on export_pdf / export_word invocation
    const sawExport = consoleLogs.some((l) => l.includes("[MOCK] export_pdf"));
    expect(sawExport).toBe(true);
    // The alert should show the mock path
    expect(alertText).toMatch(/已导出.*\.pdf/);
  });

  test("Word 导出按钮：点击触发 export_word", async ({ page }) => {
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "Word 导出测试");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=Word 导出测试");

    await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>(
        "SELECT id FROM students WHERE name = ?",
        ["Word 导出测试"],
      );
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type,
           content, mastery_score, status)
         VALUES (?, 'math', 'manual', 'objective', '某道题', 0, 'active')`,
        [s[0].id],
      );
    });

    const consoleLogs: string[] = [];
    page.on("console", (msg) => consoleLogs.push(msg.text()));

    await page.click("text=错题本");
    await page.waitForTimeout(400);

    await page.locator('button:has-text("导出 Word")').click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.waitForTimeout(800);

    const sawExport = consoleLogs.some((l) => l.includes("[MOCK] export_word"));
    expect(sawExport).toBe(true);
  });

  test("错题本为空时导出按钮不渲染", async ({ page }) => {
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "空题测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=空题测试生");

    await page.click("text=错题本");
    await page.waitForTimeout(400);

    // When no questions, ExportButtonGroup is conditionally hidden
    await expect(page.locator('button:has-text("导出 PDF")')).toHaveCount(0);
    await expect(page.locator('button:has-text("导出 Word")')).toHaveCount(0);
  });
});
