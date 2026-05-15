const { test, expect } = require('@playwright/test');

test('打开添加学生表单', async ({ page }) => {
  await page.goto('http://localhost:1420/');
  await page.click('text=添加学生');
  await expect(page.locator('text=姓名')).toBeVisible();
});
