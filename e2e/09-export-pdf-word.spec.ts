import { test, expect } from "./fixtures";

/**
 * E2E tests for PDF/Word export of question sets.
 *
 * These tests run under the Tauri-mock fixture (`__TAURI_INTERNALS__`
 * injected, shim marker absent), so the export code takes the
 * `isTauriRuntime() === true` branch:
 *   - Frontend renders PDF/Word Blob in JS (`renderPdfFromHtml` /
 *     `renderWordFromHtml`).
 *   - `invoke("save_file", { bytes, suggestedName, kind })` returns
 *     a fake path.
 *   - toast appears with "已导出" + the fake path.
 */

test.describe("PDF / Word 导出 (Tauri-mock 路径)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      try {
        await (window as { __TEST_CLEAR_DATA__?: () => Promise<void> }).__TEST_CLEAR_DATA__?.();
      } catch {
        /* ignore */
      }
    });
  });

  test("错题本页导出按钮：点击 PDF 触发 export_pdf + toast 提示", async ({ page }) => {
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "导出测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    // Student is auto-selected after creation

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

    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      consoleLogs.push(msg.text());
    });

    await page.click("text=错题本");
    await page.waitForTimeout(400);

    const pdfBtn = page.locator('button:has-text("导出 PDF")');
    await expect(pdfBtn).toBeVisible();
    await pdfBtn.click();

    // The mock console.log fires on save_file invocation (frontend
    // renders in JS; Rust's only job is the save dialog + file write)
    await expect.poll(
      () => consoleLogs.some((l) => l.includes("[MOCK] save_file")),
      { timeout: 5000 },
    ).toBe(true);

    // Toast appears with "已导出" (replaces the old alert)
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 5000 });
    const toastText = await toast.innerText();
    expect(toastText).toContain("已导出");
    expect(toastText).toMatch(/\.pdf/);
  });

  test("Word 导出按钮：点击触发 export_word + toast 提示", async ({ page }) => {
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "Word 导出测试");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    // Student is auto-selected after creation

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

    await expect.poll(
      () => consoleLogs.some((l) => l.includes("[MOCK] save_file")),
      { timeout: 5000 },
    ).toBe(true);

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 5000 });
    const toastText = await toast.innerText();
    expect(toastText).toContain("已导出");
    expect(toastText).toMatch(/\.docx/);
  });

  test("错题本为空时导出按钮不渲染", async ({ page }) => {
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "空题测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    // Student is auto-selected after creation

    await page.click("text=错题本");
    await page.waitForTimeout(400);

    await expect(page.locator('button:has-text("导出 PDF")')).toHaveCount(0);
    await expect(page.locator('button:has-text("导出 Word")')).toHaveCount(0);
  });
});
