/**
 * Regression: a question containing LaTeX (e.g. `$x^2$`) should
 * render to a PDF where the LaTeX has been converted to a KaTeX
 * PNG (via katexToPng) — not appear as the literal `$x^2$` source.
 *
 * PDF text extraction is finicky across libs. We use a pragmatic
 * check: the PDF byte size with KaTeX PNGs is significantly larger
 * than the PDF with literal LaTeX. Concretely, we seed a question
 * with `$x^2$`, export, and assert the resulting PDF is at least
 * 1.5 KB. A PDF with literal `$x^2$` text would be <1 KB.
 */
import { test, expect } from "./fixtures";

test.describe("LaTeX 公式在 PDF 中渲染 (Tauri-mock 路径)", () => {
  test("含 $x^2$ 的题目导出 PDF 体积 > 1.5KB（KaTeX PNG 嵌入）", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      try {
        await (window as { __TEST_CLEAR_DATA__?: () => Promise<void> }).__TEST_CLEAR_DATA__?.();
      } catch {
        /* ignore */
      }
    });

    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "LaTeX 测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=LaTeX 测试生");
    await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>(
        "SELECT id FROM students WHERE name = ?",
        ["LaTeX 测试生"],
      );
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type,
           content, mastery_score, status)
         VALUES (?, 'math', 'manual', 'objective',
                 '已知 $x^2 + 1 = 0$ 的解',
                 0, 'active')`,
        [s[0].id],
      );
    });

    await page.click("text=错题本");
    await page.waitForTimeout(400);

    await page.locator('button:has-text("导出 PDF")').click();

    const lastSaved = await page.waitForFunction(
      () => (window as { __LAST_SAVED_FILE__?: unknown }).__LAST_SAVED_FILE__,
      undefined,
      { timeout: 15000 },
    );
    const captured = await lastSaved.jsonValue() as {
      suggestedName: string;
      kind: string;
      bytes: number[];
    };
    expect(captured.kind).toBe("pdf");
    // The KaTeX PNG embedded for `$x^2$` is at least a few hundred
    // bytes. Threshold of 1.5KB is conservative but well above the
    // ~600 bytes a no-math PDF would be.
    expect(captured.bytes.length).toBeGreaterThan(1500);
  });
});
