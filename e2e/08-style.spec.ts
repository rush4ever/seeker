import { test, expect } from "./fixtures";

test.describe("Notion 风格 smoke", () => {
  test("侧边栏用 notion-border 细边线 (#e9e9e7)", async ({ page }) => {
    await page.goto("/");
    const aside = page.locator("aside").first();
    await expect(aside).toBeVisible();
    const borderColor = await aside.evaluate(
      (el) => getComputedStyle(el).borderRightColor
    );
    // notion-border = #e9e9e7 = rgb(233, 233, 231)
    expect(borderColor).toBe("rgb(233, 233, 231)");
  });

  test("body 使用系统字体栈 (apple-system 优先)", async ({ page }) => {
    await page.goto("/");
    const family = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily
    );
    expect(family.toLowerCase()).toContain("apple-system");
  });

  test("header 使用 notion-border 底线 + 紧凑高度", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    const { borderBottomColor, height } = await header.evaluate((el) => ({
      borderBottomColor: getComputedStyle(el).borderBottomColor,
      height: getComputedStyle(el).height,
    }));
    expect(borderBottomColor).toBe("rgb(233, 233, 231)");
    // h-12 = 48px
    expect(height).toBe("48px");
  });
});
