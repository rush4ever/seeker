import { test, expect } from "./fixtures";

test.describe("详情 modal UX", () => {
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

  test("已分析题打开后展示知识点 / 章节 / 解题思路 / 步骤 / 单张原图", async ({
    page,
  }) => {
    // add a student
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "详情测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=详情测试生");

    // Seed: a math knowledge node, an active question that's been
    // "analyzed" (has error_cause/difficulty + solution_approach + JSON
    // steps), 1 linked knowledge_node, 1 inline image.
    const seed = await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>(
        "SELECT id FROM students WHERE name = ?",
        ["详情测试生"],
      );
      const sid = s[0].id;

      // knowledge node
      await db.execute(
        `INSERT INTO knowledge_nodes (subject, grade, semester, chapter, name, parent_id, is_preset)
         VALUES ('math', 8, 2, '分式', '分式的运算', NULL, 0)`,
      );
      const kpIdRow = await db.select<{ id: number }[]>(
        "SELECT last_insert_rowid() as id",
      );
      const kpId = kpIdRow[0].id;

      // question with one tiny placeholder image (1x1 png)
      const onePx =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==";
      const contentImages = JSON.stringify([
        {
          name: "tiny.png",
          data: onePx,
          mimeType: "image/png",
          description: "",
        },
      ]);
      const steps = JSON.stringify([
        "通分",
        "比较分子",
        "得出结论",
      ]);
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type,
           content, content_html, content_images, correct_answer, error_cause,
           difficulty, solution_approach, solution_steps, mastery_score,
           chapter, status)
         VALUES (?, 'math', 'manual', 'objective', ?, ?, ?, 'A', 'concept',
           'medium', '先通分再比较', ?, 30, '分式', 'active')`,
        [
          sid,
          "E2E化简分式-1除以4减a",
          "<p>E2E化简分式-1除以4减a</p>",
          contentImages,
          steps,
        ],
      );
      const qIdRow = await db.select<{ id: number }[]>(
        "SELECT last_insert_rowid() as id",
      );
      const qId = qIdRow[0].id;
      await db.execute(
        "INSERT INTO question_knowledge (question_id, knowledge_id, confidence) VALUES (?, ?, 1.0)",
        [qId, kpId],
      );
      return { qId, kpId };
    });

    // open the question detail
    await page.click("text=错题本");
    await page.waitForTimeout(300);
    // click on the question content
    await page
      .locator("text=E2E化简分式-1除以4减a")
      .first()
      .click();

    // Each section header must be present
    await expect(
      page.getByRole("heading", { name: "题目", exact: true }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("heading", { name: "涉及知识点", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "对应章节", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "解题思路", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "解题步骤", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "参考答案", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "掌握度", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "原始题目图片", exact: true }),
    ).toBeVisible();

    // Solution steps render as <ol> with at least one <li>
    const ol = page
      .getByRole("heading", { name: "解题步骤", exact: true })
      .locator("..")
      .locator("ol");
    await expect(ol).toBeVisible();
    const liCount = await ol.locator("li").count();
    expect(liCount).toBe(3);

    // Knowledge tag is visible (chose 分式的运算)
    await expect(page.locator("text=分式的运算").first()).toBeVisible();

    // Exactly ONE original image (NOT per-formula blocks)
    const imgSection = page
      .getByRole("heading", { name: "原始题目图片", exact: true })
      .locator("..");
    const imgCount = await imgSection.locator("img").count();
    expect(imgCount).toBe(1);

    // "识别结果" caption must NOT appear (we removed that)
    await expect(
      page
        .getByRole("heading", { name: "原始题目图片", exact: true })
        .locator("..")
        .locator("text=识别结果"),
    ).toHaveCount(0);
  });

  test("未分析题显示 AI 分析 CTA 块", async ({ page }) => {
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "未分析测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    await page.click("text=未分析测试生");

    await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>(
        "SELECT id FROM students WHERE name = ?",
        ["未分析测试生"],
      );
      const sid = s[0].id;
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type,
           content, mastery_score, status)
         VALUES (?, 'math', 'manual', 'objective', '未分析的题', 0, 'active')`,
        [sid],
      );
    });

    await page.click("text=错题本");
    await page.waitForTimeout(300);
    await page.locator("text=未分析的题").first().click();

    await expect(
      page.getByRole("heading", { name: "AI 分析", exact: true }),
    ).toBeVisible();
    // 解题思路 / 解题步骤 sections must NOT exist (replaced by CTA)
    await expect(
      page.getByRole("heading", { name: "解题思路", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "解题步骤", exact: true }),
    ).toHaveCount(0);
  });
});
