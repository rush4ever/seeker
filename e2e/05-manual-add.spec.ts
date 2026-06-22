import { test, expect } from "./fixtures";

test.describe("#2 手动加题", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      try {
        await (window as any).__TEST_CLEAR_DATA__();
      } catch {
        /* ignore */
      }
    });
  });

  test("添加一条错题并出现在错题本", async ({ page }) => {
    // setup: add and select a student
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "手添测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    // Student is auto-selected after creation, navigate to questions page

    // open form
    await page.click("text=错题本");
    await page.getByRole("button", { name: "添加", exact: true }).click();
    await expect(page.locator("text=手动添加错题")).toBeVisible();

    // fill
    await page.fill("textarea", "求 x 的值: 2x+5=13");
    await page.fill('input[placeholder="章节"]', "一元一次方程");
    await page.fill('input[placeholder="参考答案"]', "x=4");
    await page.click('button:has-text("完成添加")');

    // verify the newly added row renders
    await expect(page.locator("text=求 x 的值: 2x+5=13").first()).toBeVisible({ timeout: 5000 });

    // verify in db
    const count = await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const r = await db.select<{ c: number }[]>(
        "SELECT COUNT(*) as c FROM questions WHERE content = ?",
        ["求 x 的值: 2x+5=13"]
      );
      return r[0].c;
    });
    expect(count).toBe(1);
  });

  test("空内容提交显示错误", async ({ page }) => {
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "校验测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    // Student is auto-selected after creation

    await page.click("text=错题本");
    await page.getByRole("button", { name: "添加", exact: true }).click();
    await page.click('button:has-text("完成添加")');

    await expect(page.locator("text=题目内容不能为空")).toBeVisible();
  });
});
