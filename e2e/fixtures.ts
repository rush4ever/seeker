import { test as base, expect } from "@playwright/test";
import { generateMockScript } from "./mock-tauri";

/**
 * Extended test fixture that injects Tauri mock before page navigation.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Inject Tauri mock as init script so it's available before page JS runs
    await page.addInitScript(generateMockScript());
    await use(page);
  },
});

export { expect };
