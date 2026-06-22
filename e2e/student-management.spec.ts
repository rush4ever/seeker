import { test, expect } from "./fixtures";

test.describe("学生管理 (User Story 30)", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log(`[BROWSER ERROR] ${msg.text()}`);
      }
    });
    await page.goto("/");
  });

  test("打开添加学生表单", async ({ page }) => {
    await page.click("text=添加学生");
    await expect(page.locator('label:has-text("姓名")')).toBeVisible();
    await expect(page.locator('label:has-text("年级")')).toBeVisible();
    await expect(page.locator('label:has-text("学期")')).toBeVisible();
  });

  test("填写并提交学生表单", async ({ page }) => {
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "测试学生");
    await page.selectOption("select >> nth=0", "9");
    await page.selectOption("select >> nth=1", "1");
    await page.click('button:has-text("添加")');

    // 提交后表单应关闭，学生被自动选中
    await expect(page.locator('h1').filter({ hasText: "测试学生" })).toBeVisible({ timeout: 5000 });
  });

  test("取消添加学生", async ({ page }) => {
    await page.click("text=添加学生");
    await page.click('button:has-text("取消")');
    await expect(page.locator('label:has-text("姓名")')).not.toBeVisible();
  });

  test("切换学生后首页显示对应数据", async ({ page }) => {
    // 先添加两个学生，每次添加后自动选中
    for (const name of ["学生A", "学生B"]) {
      await page.click("text=添加学生");
      await page.fill('input[type="text"]', name);
      await page.selectOption("select >> nth=0", "8");
      await page.selectOption("select >> nth=1", "2");
      await page.click('button:has-text("添加")');
    }

    // 最后一次添加的学生 B 已被自动选中
    // 顶部标题应显示学生B
    await expect(page.locator("text=学生B · 初二")).toBeVisible();
  });
});
