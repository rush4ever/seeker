/**
 * Runtime environment detection.
 *
 * Two axes of "where are we running":
 *   1. Tauri shell vs plain browser (determines which export backend we use)
 *   2. Whether the browser supports `showSaveFilePicker` (determines how we
 *      ask the user to pick a save location)
 *
 * The Tauri-vs-browser check uses the marker set by `public/tauri-shim.js`:
 *   - shim sets `window.__TAURI_BROWSER_SHIM__ = true`
 *   - real Tauri runtime does NOT set this marker
 *   - e2e fixture (addInitScript) injects `__TAURI_INTERNALS__` but does NOT
 *     set the shim marker, so it correctly tests the Tauri path
 *
 * If the shim marker is missing AND `__TAURI_INTERNALS__` is present, we
 * assume real Tauri. If neither is present, we assume plain browser.
 */
declare global {
  interface Window {
    __TAURI_BROWSER_SHIM__?: boolean;
    __TAURI_INTERNALS__?: { invoke: (...args: unknown[]) => unknown };
    showSaveFilePicker?: (opts?: unknown) => Promise<unknown>;
  }
}

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  // The browser-mode shim sets this marker. Real Tauri does not.
  return !("__TAURI_BROWSER_SHIM__" in window);
}

export function supportsShowSaveFilePicker(): boolean {
  return typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";
}
