/**
 * Regression: import failures should surface via sonner toast instead
 * of the native `alert()` dialog.
 *
 * Asserts:
 *   1. A failed import produces a sonner toast (not a dialog).
 *   2. No native `page.on("dialog")` ever fires during the run.
 */
import { test, expect } from "@playwright/test";

test.describe("Toast 取代 alert", () => {
  test("导入失败时弹 toast，不弹原生 dialog", async ({ page }) => {
    // Track every native dialog that fires
    const nativeDialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      nativeDialogs.push(`${dialog.type()}: ${dialog.message()}`);
      await dialog.dismiss();
    });

    await page.goto("/");
    const shimActive = await page.evaluate(
      () => (window as { __TAURI_BROWSER_SHIM__?: boolean }).__TAURI_BROWSER_SHIM__ === true,
    );
    expect(shimActive).toBe(true);

    // Seed a student so the import flow is reachable
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "Toast 测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=Toast 测试生");

    // Navigate to 错题本 where the import button + file input live
    await page.click("text=错题本");
    await page.waitForTimeout(400);

    // Upload a deliberately broken docx — mammoth will throw on parse
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "broken.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("this is not a valid docx file"),
    });

    // A sonner toast should appear with the failure text
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 8000 });
    const toastText = await toast.innerText();
    expect(toastText).toContain("导入失败");

    // No native dialog should have fired during the whole flow
    expect(nativeDialogs).toEqual([]);
  });
});
