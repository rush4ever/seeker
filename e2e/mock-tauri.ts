/**
 * Mock Tauri invoke for browser-mode E2E testing.
 * Injects window.__TAURI_INTERNALS__ with stub implementations.
 * Also exposes window.__TEST_SEED_DATA__ for injecting test data via sql.js.
 */

export interface MockInvokeHandlers {
  [cmd: string]: (args: Record<string, unknown>) => unknown;
}

const defaultHandlers: MockInvokeHandlers = {
  // Student commands
  list_students: () => [],

  // Dialog plugin — used by @tauri-apps/plugin-dialog's save() in the
  // export flow. Returns a fake path that preserves the suggested
  // extension so callers can detect the chosen format.
  "plugin:dialog|save": (args: { defaultPath?: string; options?: { defaultPath?: string } }) => {
    // Tauri 2 wraps the options object: invoke(cmd, { options: {...} })
    const dp = args?.defaultPath ?? args?.options?.defaultPath;
    const ext = dp?.split(".").pop() ?? "pdf";
    return `/tmp/mock-${Date.now()}.${ext}`;
  },
  "plugin:dialog|open": () => `/tmp/mock-open-${Date.now()}`,

  // Opener plugin — used to "open file" after export
  "plugin:opener|open_path": ({ path }: { path: string }) => {
    console.log("[MOCK] opener.open_path:", path);
    return null;
  },
  "plugin:opener|reveal_item_in_dir": ({ path }: { path: string }) => {
    console.log("[MOCK] opener.reveal_item_in_dir:", path);
    return null;
  },

  // Export: frontend now renders the bytes in JS. Rust's only job
  // is the native save dialog + filesystem write. `save_file` is
  // that new command. We return a mock path that preserves the
  // suggested extension, AND stash the bytes in
  // `window.__LAST_SAVED_FILE__` so e2e tests can inspect the
  // generated PDF/Word bytes without going through the filesystem.
  save_file: ({
    bytes,
    suggestedName,
    kind,
  }: {
    bytes: number[];
    suggestedName: string;
    kind: string;
  }) => {
    console.log(
      "[MOCK] save_file:",
      suggestedName,
      "kind=",
      kind,
      "bytes=",
      bytes?.length ?? 0,
    );
    if (typeof window !== "undefined") {
      (window as { __LAST_SAVED_FILE__?: unknown }).__LAST_SAVED_FILE__ = {
        suggestedName,
        kind,
        bytes: new Uint8Array(bytes ?? []),
      };
    }
    return { saved: true, path: `/tmp/mock-${suggestedName}` };
  },

  // Legacy export commands (no longer called — kept for old e2e
  // specs that may not have migrated yet; safe to delete after one
  // full green run).
  export_pdf: ({ request }: { request: { title: string } }) => {
    console.log("[MOCK] export_pdf (legacy):", request.title);
    return "/tmp/mock-export.pdf";
  },
  export_word: ({ request }: { request: { title: string } }) => {
    console.log("[MOCK] export_word (legacy):", request.title);
    return "/tmp/mock-export.docx";
  },

  // Grading commands
  save_answer_photo: ({ studentId, sessionId, questionIndex }: {
    studentId: number;
    sessionId: number;
    questionIndex: number;
  }) => {
    console.log("[MOCK] save_answer_photo:", { studentId, sessionId, questionIndex });
    return `/tmp/answers/${studentId}/${sessionId}/${questionIndex}.jpg`;
  },
  save_uploaded_photo: ({ studentId, filename }: {
    studentId: number;
    filename: string;
  }) => {
    console.log("[MOCK] save_uploaded_photo:", { studentId, filename });
    return `/tmp/photos/${studentId}/mock-${filename}`;
  },

  // Backup commands (no real FS in browser mode — return empty list / no-op)
  list_local_snapshots: () => [],
  create_local_snapshot: () => ({
    path: "/tmp/mock-snapshot.db",
    created_at: new Date().toISOString(),
    size_bytes: 1024,
  }),
  restore_snapshot: () => null,
  cleanup_old_snapshots: () => 0,
  backup_to_sync_folder: () => ({
    path: "/tmp/mock-sync/seeker.db",
    created_at: new Date().toISOString(),
    size_bytes: 1024,
  }),
};

/**
 * Generate the inline script to inject into the page.
 */
export function generateMockScript(handlers: MockInvokeHandlers = {}): string {
  const merged = { ...defaultHandlers, ...handlers };

  const handlerMap: Record<string, string> = {};
  for (const [cmd, fn] of Object.entries(merged)) {
    handlerMap[cmd] = fn.toString();
  }

  return `
    window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || {};
    window.__TAURI_INTERNALS__.invoke = async function(cmd, args) {
      const handlers = ${JSON.stringify(handlerMap)};
      if (handlers[cmd]) {
        const fn = eval('(' + handlers[cmd] + ')');
        return fn(args || {});
      }
      console.warn('[MOCK] Unhandled Tauri command:', cmd, args);
      return null;
    };
    window.__TAURI_INTERNALS__.convertFileSrc = function(path) {
      return 'file://' + path;
    };

    // Expose test data seeding helper
    window.__TEST_SEED_DATA__ = async function(students, questions) {
      const mod = await import('/src/lib/db.ts');
      const db = await mod.getDb();
      for (const s of students || []) {
        await db.execute(
          'INSERT INTO students (name, current_grade, current_semester, textbook_version) VALUES (?, ?, ?, ?)',
          [s.name, s.grade, s.semester, '苏科版']
        );
      }
      for (const q of questions || []) {
        await db.execute(
          'INSERT INTO questions (student_id, subject, source_type, question_type, content, correct_answer, error_cause, difficulty, mastery_score, chapter, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [q.student_id, q.subject, 'manual', 'objective', q.content, q.correct_answer, q.error_cause || null, q.difficulty || null, q.mastery_score, q.chapter || null, 'active']
        );
      }
      return 'ok';
    };

    window.__TEST_CLEAR_DATA__ = async function() {
      const mod = await import('/src/lib/db.ts');
      const db = await mod.getDb();
      await db.execute('DELETE FROM question_knowledge');
      await db.execute('DELETE FROM questions');
      await db.execute('DELETE FROM mastery_history');
      await db.execute('DELETE FROM practice_sessions');
      await db.execute('DELETE FROM practice_answers');
      await db.execute('DELETE FROM review_schedule');
      await db.execute('DELETE FROM students');
      return 'ok';
    };

    console.log('[MOCK] Tauri internals + test helpers injected');
  `;
}

/**
 * Playwright page function to inject the mock.
 */
export async function injectTauriMock(page: any, customHandlers?: MockInvokeHandlers): Promise<void> {
  await page.evaluate(generateMockScript(customHandlers));
}
