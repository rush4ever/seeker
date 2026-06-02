import { test, expect } from "./fixtures";

/**
 * E2E tests for Word document import with vision model image parsing.
 * Requires Ollama to be running with qwen2.5:32b and qwen2.5vl:7b models.
 */

const TEST_DOCX_PATH = "./refer/邵瀚文-数学错题集-20260514.docx";

async function setupTestStudent(page: any, name: string = "导入测试生") {
  await page.goto("/");
  await page.click("text=添加学生");
  await page.fill('input[type="text"]', name);
  await page.selectOption("select >> nth=0", "8");
  await page.selectOption("select >> nth=1", "2");
  await page.click('button:has-text("添加")');
  await expect(page.locator(`text=${name}`)).toBeVisible({ timeout: 5000 });
  await page.click(`text=${name}`);
}

test.describe("Word 导入流程", () => {
  test.setTimeout(180000); // 3 minutes for vision model calls
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      try {
        await (window as any).__TEST_CLEAR_DATA__();
      } catch { /* ignore */ }
    });
  });

  test("导入数学错题集: 解析题目、渲染公式、显示内联图片", async ({ page }) => {
    await setupTestStudent(page, "邵瀚文");

    // Navigate to questions page
    await page.click("text=错题本");
    await expect(page.locator('h2:has-text("错题本")')).toBeVisible();

    // Click import button
    await page.click('button:has-text("导入 Word")');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_DOCX_PATH);

    // Wait for parsing progress (vision model calls take time)
    // Progress should show something like "3/12 正在解析第 3 题的图片"
    await expect(page.locator('button:has-text("/")')).toBeVisible({ timeout: 60000 });

    // Wait for confirmation dialog
    await expect(page.locator('h3:has-text("确认导入")')).toBeVisible({ timeout: 120000 });
    await expect(page.locator("text=共解析出")).toBeVisible();

    // Confirm import
    await page.click('button:has-text("确认导入")');

    // Wait for import to complete and questions to appear
    await expect(page.locator('h2:has-text("错题本 (12 道)")')).toBeVisible({ timeout: 30000 });

    // Verify questions are displayed
    // Q1 should be visible with math content
    await expect(page.locator("text=小敏同学")).toBeVisible({ timeout: 10000 });

    // Check that KaTeX rendered formulas are present (look for katex HTML classes)
    const katexElements = page.locator('.katex');
    await expect(katexElements.first()).toBeVisible({ timeout: 10000 });
    const katexCount = await katexElements.count();
    expect(katexCount).toBeGreaterThan(0);
    console.log(`Found ${katexCount} KaTeX-rendered formulas`);

    // Check inline formula images are present (small images rendered inline)
    const inlineImages = page.locator('img.inline-formula');
    const inlineCount = await inlineImages.count();
    console.log(`Found ${inlineCount} inline formula images`);

    // Click on first question to open detail modal
    await page.locator("text=小敏同学").first().click();

    // Detail modal should show
    await expect(page.locator('text=原始图片')).toBeVisible({ timeout: 5000 });

    // Close modal by clicking the X button
    await page.locator('.fixed.inset-0 .bg-white button').first().click();
  });

  test("导入后题目包含完整 HTML 内容: content_html 字段存储渲染后的 HTML", async ({ page }) => {
    await setupTestStudent(page, "HTML测试生");

    await page.click("text=错题本");
    await page.click('button:has-text("导入 Word")');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_DOCX_PATH);

    await expect(page.locator('h3:has-text("确认导入")')).toBeVisible({ timeout: 120000 });
    await page.click('button:has-text("确认导入")');

    await expect(page.locator('h2:has-text("错题本 (12 道)")')).toBeVisible({ timeout: 30000 });

    // Verify in database that content_html exists and contains expected HTML
    const hasContentHtml = await page.evaluate(async () => {
      const mod = await import('/src/lib/db.ts');
      const db = await mod.getDb();
      const rows = await db.select('SELECT content_html FROM questions WHERE student_id = (SELECT id FROM students WHERE name = ?)', ['HTML测试生']);
      if (rows.length === 0) return false;
      const html = (rows[0] as any).content_html;
      return html && html.includes('<img') && html.includes('class="inline-formula"');
    });

    expect(hasContentHtml).toBe(true);
  });

  test("导入进度指示器显示正确", async ({ page }) => {
    await setupTestStudent(page, "进度测试生");

    await page.click("text=错题本");
    await page.click('button:has-text("导入 Word")');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_DOCX_PATH);

    // Progress should appear quickly
    await expect(page.locator('button svg.animate-spin')).toBeVisible({ timeout: 5000 });

    // Should eventually show "12/12" or similar completion
    await expect(page.locator('h3:has-text("确认导入")')).toBeVisible({ timeout: 120000 });
  });

  test("4 个无答题时间字段的子题应拆成 4 段而非塌成 1 段", async ({ page }) => {
    // Regression test for the bug the user reported: splitQuestions
    // used a single ultra-strict regex that required 题号+(客观|主观)题
    // +章节+答题时间:YYYY-MM-DD all in one match. Sub-questions missing
    // 答题时间 collapsed into the previous question's body. Now we
    // use a multi-strategy splitter. This E2E exercises it via the
    // exported splitQuestions function — no real docx required.
    const out = await page.evaluate(async () => {
      const mod = await import("/src/lib/wordParser.ts");
      const html = `
        <p>1. 化简 $\\frac{1}{4-a}$</p>
        <p>2. 化简 $\\frac{9-2a}{a-4}$</p>
        <p>3. 化简 $\\frac{1}{a-4}$</p>
        <p>4. 化简 $\\frac{2a-9}{a-4}$</p>
      `;
      return mod.splitQuestions(html);
    });
    expect(out).toHaveLength(4);
    expect(out[0]).toContain("$\\frac{1}{4-a}$");
    expect(out[3]).toContain("$\\frac{2a-9}{a-4}$");
  });
});
