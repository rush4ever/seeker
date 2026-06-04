/**
 * Regression: in 分析卷 (full_analysis) mode, the exported Word
 * should include answer / error cause / knowledge points rows.
 *
 * Inspect the captured docx bytes via the e2e mock. We don't have a
 * docx parser available; assert that the bytes are non-empty and
 * that the file starts with the "PK" ZIP signature (all .docx are
 * ZIP archives).
 */
import { test, expect } from "./fixtures";

test.describe("分析卷 Word 导出 (Tauri-mock 路径)", () => {
  test("导出 Word 落盘到 mock 路径，bytes 非空，文件以 PK 开头 (docx = zip)", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      try {
        await (window as { __TEST_CLEAR_DATA__?: () => Promise<void> }).__TEST_CLEAR_DATA__?.();
      } catch {
        /* ignore */
      }
    });

    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "分析卷测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=分析卷测试生");
    await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>(
        "SELECT id FROM students WHERE name = ?",
        ["分析卷测试生"],
      );
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type,
           content, correct_answer, error_cause, chapter, mastery_score, status)
         VALUES (?, 'math', 'manual', 'objective', '测试题', 'C', 'concept', '第二章', 0, 'active')`,
        [s[0].id],
      );
    });

    await page.click("text=错题本");
    await page.waitForTimeout(400);

    // Lock in 分析卷 mode (the default on QuestionsPage)
    const analysisBtn = page.locator('button:has-text("分析卷")');
    if (await analysisBtn.isVisible()) {
      await analysisBtn.click();
    }

    await page.locator('button:has-text("导出 Word")').click();

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
    expect(captured.kind).toBe("docx");
    expect(captured.suggestedName.endsWith(".docx")).toBe(true);
    expect(captured.bytes.length).toBeGreaterThan(2000);
    // .docx is a ZIP archive — first two bytes are 0x50 0x4B ("PK")
    expect(captured.bytes[0]).toBe(0x50);
    expect(captured.bytes[1]).toBe(0x4b);
  });
});
