import { test, expect } from "./fixtures";

test.describe("数据注入验证", () => {
  test("注入的学生数据可在数据库中查询", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      try {
        await (window as any).__TEST_CLEAR_DATA__();
        await (window as any).__TEST_SEED_DATA__(
          [{ name: "E2E学生", grade: 9, semester: 1 }],
          []
        );
        // Query directly
        const mod = await import('/src/lib/db.ts');
        const db = await mod.getDb();
        const rows = await db.select('SELECT * FROM students');
        return { success: true, rows };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    });

    console.log("Injection result:", result);
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("E2E学生");
  });

  test("注入的错题数据可在数据库中查询", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      try {
        await (window as any).__TEST_CLEAR_DATA__();
        await (window as any).__TEST_SEED_DATA__(
          [{ name: "E2E学生", grade: 8, semester: 2 }],
          [{
            student_id: 1,
            subject: "math",
            content: "解方程: 2x + 3 = 7",
            correct_answer: "x = 2",
            error_cause: "concept",
            difficulty: "easy",
            mastery_score: 25,
            chapter: "一元一次方程",
          }]
        );
        const mod = await import('/src/lib/db.ts');
        const db = await mod.getDb();
        const rows = await db.select('SELECT * FROM questions');
        return { success: true, rows };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    });

    console.log("Question injection result:", result);
    expect(result.success).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].content).toBe("解方程: 2x + 3 = 7");
  });
});
