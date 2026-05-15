import type Database from "@tauri-apps/plugin-sql";

type TauriDatabase = InstanceType<typeof Database>;

let dbInstance: TauriDatabase | SqlJsAdapter | null = null;

// Detect Tauri environment
function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI__;
}

// Adapter for sql.js (browser fallback)
class SqlJsAdapter {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async select<T>(sql: string, bindValues?: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    if (bindValues && bindValues.length > 0) {
      stmt.bind(bindValues);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  async execute(sql: string, bindValues?: unknown[]): Promise<{
    rowsAffected: number;
    lastInsertId: number;
  }> {
    const info = this.db.run(sql, bindValues || []);
    return {
      rowsAffected: info.changes || 0,
      lastInsertId: Number(info.lastID) || 0,
    };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

async function initBrowserDb(): Promise<SqlJsAdapter> {
  const { default: initSqlJs } = await import("sql.js");
  const SQL = await initSqlJs({
    locateFile: (file: string) => `/node_modules/sql.js/dist/${file}`,
  });
  const db = new SQL.Database();

  // Run schema migrations (remove comment lines first, then split by semicolon)
  const schemaSql = await fetch("/db-schema.sql").then((r) => r.text());
  const cleanSchema = schemaSql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  for (const stmt of cleanSchema.split(";")) {
    const trimmed = stmt.trim();
    if (trimmed) {
      try {
        db.run(trimmed);
      } catch {
        // ignore duplicate CREATE TABLE etc.
      }
    }
  }

  // Seed knowledge nodes from JSON
  const knowledgeTree = await fetch("/knowledge_tree.json").then((r) =>
    r.json()
  );
  for (const subject of ["math", "physics"] as const) {
    const nodes = knowledgeTree[subject];
    if (!nodes) continue;
    for (const node of nodes) {
      try {
        db.run(
          `INSERT OR IGNORE INTO knowledge_nodes (id, subject, grade, semester, chapter, name, parent_id, is_preset)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            node.id,
            subject,
            node.grade,
            node.semester,
            "",
            node.name,
            node.parent_id,
          ]
        );
      } catch {
        // ignore duplicates
      }
    }
  }

  return new SqlJsAdapter(db);
}

export async function getDb(): Promise<TauriDatabase | SqlJsAdapter> {
  if (!dbInstance) {
    if (isTauri()) {
      const { default: Database } = await import("@tauri-apps/plugin-sql");
      dbInstance = await Database.load("sqlite:seeker.db");
    } else {
      dbInstance = await initBrowserDb();
    }
  }
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}
