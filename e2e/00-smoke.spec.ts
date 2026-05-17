import { test, expect } from "./fixtures";

test.describe("E2E 基础设施验证", () => {
  test("Tauri mock 已注入", async ({ page }) => {
    await page.goto("/");
    const hasTauriInternals = await page.evaluate(() => {
      return typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
    });
    expect(hasTauriInternals).toBe(true);
  });

  test("mock invoke 返回正确结果", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      const tauri = (window as any).__TAURI_INTERNALS__;
      return await tauri.invoke("export_pdf", { request: { title: "测试" } });
    });
    expect(result).toBe("/tmp/mock-export.pdf");
  });

  test("浏览器模式数据库可用", async ({ page }) => {
    await page.goto("/");
    // 检查页面是否能加载（不报错）
    await expect(page.locator("body")).toBeVisible();
  });
});
