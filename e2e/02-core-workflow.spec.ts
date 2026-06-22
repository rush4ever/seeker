import { test, expect } from "./fixtures";

/**
 * Core E2E tests covering the complete user journey.
 * Creates test student via UI, seeds questions via injection, then tests flows.
 */

async function setupTestStudent(page: any, name: string = "邵瀚文") {
  await page.goto("/");
  await page.click("text=添加学生");
  await page.fill('input[type="text"]', name);
  await page.selectOption("select >> nth=0", "8");
  await page.selectOption("select >> nth=1", "2");
  await page.click('button:has-text("添加")');
  // Student is auto-selected after creation — verify the header shows it
  await expect(page.locator('h1').filter({ hasText: name })).toBeVisible({ timeout: 5000 });
}

async function seedQuestions(page: any) {
  await page.evaluate(async () => {
    const mod = await import('/src/lib/db.ts');
    const db = await mod.getDb();
    const studentRows = await db.select('SELECT id FROM students LIMIT 1');
    const studentId = studentRows[0]?.id || 1;

    const questions = [
      {
        student_id: studentId,
        subject: "math",
        content: "解方程: 2x + 5 = 13",
        correct_answer: "x = 4",
        error_cause: "concept",
        difficulty: "easy",
        mastery_score: 20,
        chapter: "一元一次方程",
      },
      {
        student_id: studentId,
        subject: "math",
        content: "化简分式: (x² - 1) / (x - 1)",
        correct_answer: "x + 1",
        error_cause: "calculation",
        difficulty: "medium",
        mastery_score: 45,
        chapter: "分式",
      },
      {
        student_id: studentId,
        subject: "physics",
        content: "计算压强: F=10N, S=2m²",
        correct_answer: "5Pa",
        error_cause: "careless",
        difficulty: "easy",
        mastery_score: 60,
        chapter: "压强",
      },
    ];

    for (const q of questions) {
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type, content,
          correct_answer, error_cause, difficulty, mastery_score, chapter, status)
         VALUES (?, ?, 'manual', 'objective', ?, ?, ?, ?, ?, ?, 'active')`,
        [q.student_id, q.subject, q.content, q.correct_answer,
         q.error_cause, q.difficulty, q.mastery_score, q.chapter]
      );
    }
  });
}

test.describe("核心用户流程", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Clear previous test data
    await page.evaluate(async () => {
      try {
        await (window as any).__TEST_CLEAR_DATA__();
      } catch { /* ignore */ }
    });
  });

  test("完整流程: 添加学生 → 注入错题 → 查看错题本 → 知识图谱 → 统计", async ({ page }) => {
    await setupTestStudent(page, "邵瀚文");
    await seedQuestions(page);

    // 1. Questions page
    await page.click("text=错题本");
    await expect(page.locator("text=解方程: 2x + 5 = 13")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=化简分式: (x² - 1) / (x - 1)")).toBeVisible();
    await expect(page.locator("text=计算压强: F=10N, S=2m²")).toBeVisible();

    // Filter to math
    await page.selectOption("select", "math");
    await expect(page.locator("text=解方程")).toBeVisible();
    await expect(page.locator("text=计算压强")).not.toBeVisible();
    await page.selectOption("select", "all");

    // 2. Knowledge graph
    await page.click("text=知识图谱");
    await expect(page.locator('h2:has-text("知识图谱")')).toBeVisible();
    await expect(page.locator("text=薄弱").first()).toBeVisible();
    await expect(page.locator("text=掌握").first()).toBeVisible();

    // 3. Stats
    await page.getByRole("button", { name: "统计" }).click();
    await expect(page.locator('h2:has-text("学习统计")')).toBeVisible();
    await expect(page.locator('h3:has-text("考试风险预测")')).toBeVisible();
  });

  test("错题本: 筛选学科后显示对应错题", async ({ page }) => {
    await setupTestStudent(page, "测试生");
    await seedQuestions(page);

    await page.click("text=错题本");

    // Default shows all
    await expect(page.locator("text=解方程")).toBeVisible();
    await expect(page.locator("text=计算压强")).toBeVisible();

    // Filter to math
    await page.selectOption("select", "math");
    await expect(page.locator("text=解方程")).toBeVisible();
    await expect(page.locator("text=计算压强")).not.toBeVisible();

    // Filter to physics
    await page.selectOption("select", "physics");
    await expect(page.locator("text=计算压强")).toBeVisible();
    await expect(page.locator("text=解方程")).not.toBeVisible();
  });

  test("统计页面: 显示学科分布和考试预测", async ({ page }) => {
    await setupTestStudent(page, "统计生");
    await seedQuestions(page);

    await page.getByRole("button", { name: "统计" }).click();

    // Weekly summary cards
    await expect(page.locator("text=本周新增").first()).toBeVisible();
    await expect(page.locator("text=已分析").first()).toBeVisible();
    await expect(page.locator("text=薄弱题").first()).toBeVisible();

    // Subject distribution
    await expect(page.locator('h3:has-text("学科分布")')).toBeVisible();

    // Exam prediction
    await expect(page.locator('h3:has-text("考试风险预测")')).toBeVisible();
  });

  test("角色切换: 学生模式 ↔ 家长模式", async ({ page }) => {
    await setupTestStudent(page, "角色生");
    await seedQuestions(page);

    // Switch to parent mode
    await page.getByRole("button", { name: /学生模式/ }).click();
    await expect(page.locator('h2:has-text("角色生 的学习概况")')).toBeVisible();

    // Switch back to student mode
    await page.getByRole("button", { name: /家长模式/ }).click();
    await expect(page.locator("text=今日薄弱点快练")).toBeVisible();
  });

  test("练习卷: 选择题后显示导出按钮", async ({ page }) => {
    await setupTestStudent(page, "练习生");
    await seedQuestions(page);

    await page.click("text=练习卷");

    // Select questions
    await page.click("text=解方程: 2x + 5 = 13");
    await expect(page.locator("text=已选择 1 道错题")).toBeVisible();

    await page.click("text=化简分式: (x² - 1) / (x - 1)");
    await expect(page.locator("text=已选择 2 道错题")).toBeVisible();

    // Export buttons should be visible
    await expect(page.locator("text=导出 PDF")).toBeVisible();
    await expect(page.locator("text=导出 Word")).toBeVisible();
  });

  test("批改页面: 需要选择学生后才能使用", async ({ page }) => {
    // Without selecting student
    await page.getByRole("button", { name: "批改" }).click();
    await expect(page.locator("text=请先在左侧选择一个学生")).toBeVisible();

    // Select student and verify page loads
    await setupTestStudent(page, "批改生");
    await page.getByRole("button", { name: "批改" }).click();
    await expect(page.locator('h2:has-text("练习批改")')).toBeVisible();
    await expect(page.locator('h2:has-text("练习批改")')).toBeVisible();
  });

  test("知识图谱: 页面加载后显示统计卡片", async ({ page }) => {
    await setupTestStudent(page, "图谱生");
    await seedQuestions(page);

    await page.getByRole("button", { name: "知识图谱" }).click();
    await expect(page.locator('h2:has-text("知识图谱")')).toBeVisible();
    // Summary cards
    await expect(page.locator("text=薄弱").first()).toBeVisible();
    await expect(page.locator("text=一般").first()).toBeVisible();
    await expect(page.locator("text=掌握").first()).toBeVisible();
    await expect(page.locator("text=未学习").first()).toBeVisible();
  });
});
