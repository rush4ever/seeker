/**
 * Browser-mode Tauri shim.
 *
 * Loaded by index.html BEFORE /src/main.tsx. In a real Tauri shell,
 * window.__TAURI_INTERNALS__ is injected by the runtime, so this
 * script is a no-op. In a plain browser (e.g. `npm run dev`), no
 * runtime exists and every `invoke(...)` would throw
 * `TypeError: Cannot read properties of undefined (reading 'invoke')`.
 *
 * This shim installs a default mock for the same commands the e2e
 * fixtures cover, so the app stays usable for UI development /
 * browser-only demos. e2e tests inject their own handlers via
 * page.addInitScript() — that runs BEFORE this shim, so e2e
 * handlers always win.
 *
 * If you see `__TAURI_INTERNALS__` already installed, this is the
 * e2e/playwright path — back off and let it own the mock.
 */
(function () {
  if (typeof window === "undefined") return;
  if (window.__TAURI_INTERNALS__) {
    // Real Tauri runtime OR e2e fixture already injected a mock.
    return;
  }

  // Default handlers — return plausible shapes so the UI can proceed.
  // Commands not listed log a warning and return null.
  var handlers = {
    // Plugin: dialog (used by save() / open())
    "plugin:dialog|save": function () {
      return "/tmp/mock-export-" + Date.now() + ".pdf";
    },
    "plugin:dialog|open": function () {
      return "/tmp/mock-open-" + Date.now();
    },
    "plugin:dialog|message": function () {
      return null;
    },
    "plugin:dialog|ask": function () {
      return false;
    },
    "plugin:dialog|confirm": function () {
      return false;
    },

    // Tauri commands declared in src-tauri/src/commands/*
    export_pdf: function () {
      return "/tmp/mock-export.pdf";
    },
    export_word: function () {
      return "/tmp/mock-export.docx";
    },
    save_answer_photo: function (args) {
      var a = args || {};
      return (
        "/tmp/answers/" +
        (a.studentId || "x") +
        "/" +
        (a.sessionId || "x") +
        "/" +
        (a.questionIndex || 0) +
        ".jpg"
      );
    },
    save_uploaded_photo: function (args) {
      var a = args || {};
      return (
        "/tmp/photos/" + (a.studentId || "x") + "/mock-" + (a.filename || "photo")
      );
    },
    list_local_snapshots: function () {
      return [];
    },
    create_local_snapshot: function () {
      return {
        path: "/tmp/mock-snapshot.db",
        created_at: new Date().toISOString(),
        size_bytes: 1024,
      };
    },
    restore_snapshot: function () {
      return null;
    },
    cleanup_old_snapshots: function () {
      return 0;
    },
    backup_to_sync_folder: function () {
      return {
        path: "/tmp/mock-sync/seeker.db",
        created_at: new Date().toISOString(),
        size_bytes: 1024,
      };
    },
    list_students: function () {
      return [];
    },
  };

  window.__TAURI_INTERNALS__ = {
    invoke: function (cmd, args) {
      var handler = handlers[cmd];
      if (handler) {
        try {
          return Promise.resolve(handler(args || {}));
        } catch (e) {
          return Promise.reject(e);
        }
      }
      // Unhandled — keep going rather than blow up the UI.
      console.warn("[tauri-shim] Unhandled command:", cmd, args);
      return Promise.resolve(null);
    },
    convertFileSrc: function (path) {
      return "file://" + path;
    },
  };

  // Diagnostic so a developer opening DevTools can confirm the shim ran.
  // Also sets a marker that tests can read to distinguish "shim present"
  // from "real Tauri runtime present".
  window.__TAURI_BROWSER_SHIM__ = true;
  console.log(
    "[tauri-shim] Browser-mode Tauri mock installed (no real runtime present).",
  );
})();
