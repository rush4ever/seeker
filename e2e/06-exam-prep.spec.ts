import { test, expect } from "./fixtures";

test.describe("#19 考前模式", () => {
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

  test("切到考前模式，选择知识点后显示错题", async ({ page }) => {
    // setup student
    await page.click("text=添加学生");
    await page.fill('input[type="text"]', "考前测试生");
    await page.selectOption("select >> nth=0", "8");
    await page.selectOption("select >> nth=1", "2");
    await page.click('button:has-text("添加")');
    // Student is auto-selected after creation

    // Seed: one root-level knowledge node + one question linked to it.
    // Using a root-level (parent_id=NULL) node so it's visible at depth=0
    // without expanding the tree.
    const seeded = await page.evaluate(async () => {
      const mod = await import("/src/lib/db.ts");
      const db = await mod.getDb();
      const s = await db.select<{ id: number }[]>(
        "SELECT id FROM students WHERE name = ?",
        ["考前测试生"]
      );
      const sid = s[0].id;

      // Insert a unique top-level knowledge node for this test
      const kpName = "E2E考前测试章节";
      await db.execute(
        `INSERT INTO knowledge_nodes (subject, grade, semester, chapter, name, parent_id, is_preset)
         VALUES ('math', 8, 2, ?, ?, NULL, 0)`,
        [kpName, kpName]
      );
      // sql.js db.run() doesn't return a reliable lastInsertId, so query
      // the SQLite-side last_insert_rowid() directly.
      const kpIdRow = await db.select<{ id: number }[]>(
        "SELECT last_insert_rowid() as id"
      );
      const kpId = kpIdRow[0].id;

      // Insert one question and link it
      await db.execute(
        `INSERT INTO questions (student_id, subject, source_type, question_type, content,
           correct_answer, mastery_score, chapter, status)
         VALUES (?, 'math', 'manual', 'objective', ?, 'A', 30, ?, 'active')`,
        [sid, `考前题-${kpName}`, kpName]
      );
      const qIdRow = await db.select<{ id: number }[]>(
        "SELECT last_insert_rowid() as id"
      );
      const qId = qIdRow[0].id;

      await db.execute(
        "INSERT INTO question_knowledge (question_id, knowledge_id, confidence) VALUES (?, ?, 1.0)",
        [qId, kpId]
      );

      return { kpName };
    });

    // navigate
    await page.click("text=练习卷");
    await page.click('button:has-text("考前")');
    await expect(page.locator("text=选择知识点")).toBeVisible();

    // Find the row holding our knowledge node, then check its checkbox.
    const row = page.locator(`text=${seeded.kpName}`).first();
    await expect(row).toBeVisible({ timeout: 5000 });
    // The checkbox sits to the left of the row label; xpath-walk up to the
    // row container and grab the checkbox.
    await page
      .locator(
        `xpath=//*[normalize-space(text())="${seeded.kpName}"]/ancestor::div[contains(@class, "rounded-lg")][1]//input[@type="checkbox"]`
      )
      .check();

    // Verify the question content appears in the right pane.
    await expect(
      page.locator(`text=考前题-${seeded.kpName}`).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator(`text=考前题-${seeded.kpName}`).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
