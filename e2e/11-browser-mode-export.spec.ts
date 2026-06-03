/**
 * Regression: the user opens the app via `npm run dev` (NOT the e2e
 * fixture) and clicks export. In a vanilla browser, there is no
 * `window.__TAURI_INTERNALS__`, so every plugin call
 * (save / open / invoke) throws "Cannot read properties of undefined
 * (reading 'invoke')".
 *
 * This spec intentionally does NOT use ./fixtures — it goes through the
 * same code path the user does, then asserts the browser-mode mock
 * covers the export flow.
 */
import { test, expect } from "@playwright/test";

test.describe("浏览器模式（无 fixture）导出", () => {
  test("无 Tauri runtime 时导出不应再报 'invoke' undefined 错", async ({ page }) => {
    // 1. This spec intentionally does NOT use the e2e fixture, so the
    //    only Tauri mock available is the index.html shim. Verify it
    //    installed itself.
    await page.goto("/");
    const shimActive = await page.evaluate(() => {
      return (window as any).__TAURI_BROWSER_SHIM__ === true;
    });
    expect(shimActive).toBe(true);

    // 2. Seed a student + question via the same path the e2e suites use.
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "裸浏览器测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=裸浏览器测试生");
    await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>(
        "SELECT id FROM students WHERE name = ?",
        ["裸浏览器测试生"],
      );
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type,
           content, mastery_score, status)
         VALUES (?, 'math', 'manual', 'objective', '测试题', 0, 'active')`,
        [s[0].id],
      );
    });

    await page.click("text=错题本");
    await page.waitForTimeout(400);

    // 3. Click PDF export and capture the alert.
    let alertText = "";
    page.once("dialog", async (dialog) => {
      alertText = dialog.message();
      await dialog.dismiss();
    });

    await page.locator('button:has-text("导出 PDF")').click();
    await page.waitForTimeout(800);

    // 4. Symptom: previously the alert read
    //    "导出失败: TypeError: Cannot read properties of undefined
    //     (reading 'invoke')"
    expect(alertText).not.toContain("TypeError");
    expect(alertText).not.toContain("reading 'invoke'");
    // The browser-mode mock should make the chain complete and report a
    // successful export.
    expect(alertText).toMatch(/已导出/);
  });
});
