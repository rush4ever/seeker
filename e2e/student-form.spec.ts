import { test, expect } from "@playwright/test";

test.describe("添加学生 (PRD User Story 30)", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`[BROWSER ERROR] ${msg.text()}`);
      }
    });
    await page.goto("/");
  });

  test("打开添加学生表单", async ({ page }) => {
    await page.click('text=添加学生');
    await expect(page.locator('label:has-text("姓名")')).toBeVisible();
    await expect(page.locator('label:has-text("年级")')).toBeVisible();
    await expect(page.locator('label:has-text("学期")')).toBeVisible();
  });

  test("填写并提交学生表单", async ({ page }) => {
    await page.click('text=添加学生');
    await page.fill('input[type="text"]', '测试学生');
    await page.selectOption('select >> nth=0', '9');
    await page.selectOption('select >> nth=1', '1');
    await page.click('button:has-text("添加")');

    // 提交后表单应关闭，学生被自动选中
    await expect(page.locator('h1').filter({ hasText: '测试学生' })).toBeVisible({ timeout: 5000 });
  });

  test("取消添加学生", async ({ page }) => {
    await page.click('text=添加学生');
    await page.click('button:has-text("取消")');
    await expect(page.locator('label:has-text("姓名")')).not.toBeVisible();
  });
});
