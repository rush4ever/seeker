import { test, expect } from "./fixtures";

test.describe("M11 备份", () => {
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

  test("设置页可访问且显示同步盘 + 快照 section", async ({ page }) => {
    // add student
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "备份测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    // Student is auto-selected after creation

    // switch to parent
    await page.getByRole("button", { name: /学生模式/ }).click();
    // Click 设置 via the parent nav button (sidebar), not the h2.
    await page.getByRole("button", { name: "设置" }).click();
    await expect(
      page.locator("h2", { hasText: "设置" }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator("h3", { hasText: "同步盘备份" }),
    ).toBeVisible();
    await expect(
      page.locator("h3", { hasText: "本地快照" }),
    ).toBeVisible();
  });

  test("snapshot 元数据格式化正确（纯函数）", async ({ page }) => {
    const out = await page.evaluate(async () => {
      const mod = await import("/src/lib/backupConfig.ts");
      const now = new Date("2026-06-02T10:00:00Z");
      return {
        just: mod.formatRelativeTime("2026-06-02T09:59:30Z", now),
        minutes: mod.formatRelativeTime("2026-06-02T09:55:00Z", now),
        hours: mod.formatRelativeTime("2026-06-02T07:00:00Z", now),
        yesterday: mod.formatRelativeTime("2026-06-01T10:00:00Z", now),
        days: mod.formatRelativeTime("2026-05-28T10:00:00Z", now),
        mb: mod.formatBytes(5 * 1024 * 1024),
      };
    });
    expect(out.just).toBe("刚刚");
    expect(out.minutes).toBe("5 分钟前");
    expect(out.hours).toBe("3 小时前");
    expect(out.yesterday).toBe("昨天");
    expect(out.days).toBe("5 天前");
    expect(out.mb).toBe("5.0 MB");
  });
});
