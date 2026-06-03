/**
 * Regression: browser-mode export must produce a real downloadable file
 * (not a /tmp/... shim fake) and surface a sonner toast.
 *
 * This spec deliberately does NOT use ./fixtures — it exercises the
 * same code path as `npm run dev`. The browser-mode shim from
 * public/tauri-shim.js is what makes the export button work; the
 * absence of showSaveFilePicker forces the <a download> fallback.
 */
import { test, expect } from "@playwright/test";

test.describe("浏览器模式导出 (real download)", () => {
  test("导出 PDF：触发下载 + 弹出成功 toast", async ({ page, context }) => {
    const consoleLogs: string[] = [];
    page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
    page.on("pageerror", (err) => consoleLogs.push(`[pageerror] ${err.message}`));

    await page.goto("/");
    // The browser-mode shim from index.html should be active
    const shimActive = await page.evaluate(
      () => (window as { __TAURI_BROWSER_SHIM__?: boolean }).__TAURI_BROWSER_SHIM__ === true,
    );
    expect(shimActive).toBe(true);

    // Force the <a download> fallback: showSaveFilePicker opens a real
    // picker in Playwright Chromium that we can't dismiss, so remove it
    // to exercise the code path most browsers (Firefox/Safari) take.
    await page.evaluate(() => {
      delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
    });

    // Capture downloads AFTER the page loads
    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });

    // Seed a student + 1 question
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "浏览器导出生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=浏览器导出生");
    await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>(
        "SELECT id FROM students WHERE name = ?",
        ["浏览器导出生"],
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

    // Click PDF export — should trigger a real browser download
    await page.locator('button:has-text("导出 PDF")').click();

    let download;
    try {
      download = await downloadPromise;
    } catch (e) {
      console.log("--- console logs (no download fired) ---");
      console.log(consoleLogs.join("\n"));
      throw e;
    }
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    // A sonner toast should appear (its container has [data-sonner-toaster])
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 3000 });
    const toastText = await page.locator('[data-sonner-toast]').first().innerText();
    expect(toastText).toContain("已下载");
  });
});
