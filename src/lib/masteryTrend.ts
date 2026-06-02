export interface WeeklyMasteryPoint {
  weekLabel: string;
  overall: number;
  math?: number;
  physics?: number;
}

export interface MasteryTrendRow {
  week: string;
  subject: string;
  avg_score: number;
}

export function buildMasteryTrendQuery(studentId: number): { sql: string; params: (string | number)[] } {
  return {
    sql: `SELECT
            strftime('%Y-W%W', mh.recorded_at) as week,
            kn.subject,
            ROUND(AVG(mh.score), 1) as avg_score
          FROM mastery_history mh
          JOIN knowledge_nodes kn ON mh.knowledge_id = kn.id
          WHERE mh.student_id = ?
            AND kn.parent_id IS NOT NULL
            AND kn.name NOT IN ('数学', '物理')
          GROUP BY week, kn.subject
          ORDER BY week`,
    params: [studentId],
  };
}

export function formatMasteryTrend(rows: MasteryTrendRow[]): WeeklyMasteryPoint[] {
  const weekMap = new Map<string, { math?: number; physics?: number; overallSum: number; overallCount: number }>();

  for (const row of rows) {
    const existing = weekMap.get(row.week);
    if (existing) {
      if (row.subject === "math") existing.math = Math.round(row.avg_score);
      if (row.subject === "physics") existing.physics = Math.round(row.avg_score);
      existing.overallSum += row.avg_score;
      existing.overallCount++;
    } else {
      weekMap.set(row.week, {
        math: row.subject === "math" ? Math.round(row.avg_score) : undefined,
        physics: row.subject === "physics" ? Math.round(row.avg_score) : undefined,
        overallSum: row.avg_score,
        overallCount: 1,
      });
    }
  }

  const result: WeeklyMasteryPoint[] = [];
  for (const [week, data] of weekMap) {
    result.push({
      weekLabel: formatWeekLabel(week),
      overall: Math.round(data.overallSum / data.overallCount),
      math: data.math,
      physics: data.physics,
    });
  }

  return result;
}

function formatWeekLabel(weekStr: string): string {
  // Input: "2026-W20" → Output: "5月第3周" (approximate)
  const match = weekStr.match(/(\d{4})-W(\d{2})/);
  if (!match) return weekStr;

  const weekNum = parseInt(match[2], 10);

  // Approximate month from week number
  const month = Math.min(12, Math.floor(weekNum / 4.3) + 1);
  const monthNames = ["", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  return `${monthNames[month]}W${weekNum}`;
}
