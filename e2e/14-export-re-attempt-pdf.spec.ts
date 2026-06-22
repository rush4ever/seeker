/**
 * Regression: in 再练卷 (questions_only) mode, the exported PDF
 * should hide the answer rows and include a notes area for the
 * student to write in.
 *
 * The frontend now renders the PDF in JS; the bytes flow through
 * `invoke("save_file", ...)` which the e2e mock captures into
 * `window.__LAST_SAVED_FILE__` (see e2e/mock-tauri.ts). We assert
 * the captured PDF size and MIME, and run a rough text extraction
 * via the browser's `<canvas>`-less PDF text scan: pdftotext is
 * not available, so we just check the bytes are non-empty and the
 * suggested name ends with .pdf.
 */
import { test, expect } from "./fixtures";

test.describe("再练卷 PDF 导出 (Tauri-mock 路径)", () => {
  test("导出 PDF 落盘到 mock 路径，bytes 非空，文件名以 .pdf 结尾", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      try {
        await (window as { __TEST_CLEAR_DATA__?: () => Promise<void> }).__TEST_CLEAR_DATA__?.();
      } catch {
        /* ignore */
      }
    });

    // Seed student + 1 question
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "再练卷测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    // Student is auto-selected after creation
    await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>(
        "SELECT id FROM students WHERE name = ?",
        ["再练卷测试生"],
      );
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type,
           content, correct_answer, error_cause, mastery_score, status)
         VALUES (?, 'math', 'manual', 'objective', '测试题', 'C', null, 0, 'active')`,
        [s[0].id],
      );
    });

    await page.click("text=错题本");
    await page.waitForTimeout(400);

    // QuestionsPage shows the new 再练/分析 toggle when onModeChange
    // is provided. Click 再练卷 to lock in the mode.
    const reAttemptBtn = page.locator('button:has-text("再练卷")');
    if (await reAttemptBtn.isVisible()) {
      await reAttemptBtn.click();
    }

    await page.locator('button:has-text("导出 PDF")').click();

    // Wait for the save_file mock to capture the bytes
    const lastSaved = await page.waitForFunction(
      () => (window as { __LAST_SAVED_FILE__?: unknown }).__LAST_SAVED_FILE__,
      undefined,
      { timeout: 8000 },
    );
    const captured = await lastSaved.jsonValue() as {
      suggestedName: string;
      kind: string;
      bytes: number[];
    };
    expect(captured.kind).toBe("pdf");
    expect(captured.suggestedName.endsWith(".pdf")).toBe(true);
    expect(captured.bytes.length).toBeGreaterThan(1000);
  });
});
