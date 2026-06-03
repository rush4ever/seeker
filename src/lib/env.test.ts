import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isTauriRuntime, supportsShowSaveFilePicker } from "./env";

describe("isTauriRuntime", () => {
  let savedWindow: unknown;

  beforeEach(() => {
    savedWindow = (globalThis as { window?: unknown }).window;
  });

  afterEach(() => {
    // Restore
    (globalThis as { window?: unknown }).window = savedWindow;
  });

  it("returns false when window is undefined (SSR / node)", () => {
    const w = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = undefined;
    try {
      expect(isTauriRuntime()).toBe(false);
    } finally {
      (globalThis as { window?: unknown }).window = w;
    }
  });

  it("returns false when shim marker is present (browser mode)", () => {
    (globalThis as { window?: unknown }).window = { __TAURI_BROWSER_SHIM__: true };
    expect(isTauriRuntime()).toBe(false);
  });

  it("returns true when no shim marker (real Tauri runtime)", () => {
    (globalThis as { window?: unknown }).window = { __TAURI_INTERNALS__: { invoke: () => null } };
    expect(isTauriRuntime()).toBe(true);
  });

  it("returns true on empty window (no marker, no internals)", () => {
    (globalThis as { window?: unknown }).window = {};
    expect(isTauriRuntime()).toBe(true);
  });
});

describe("supportsShowSaveFilePicker", () => {
  it("returns false when window is undefined", () => {
    const w = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = undefined;
    try {
      expect(supportsShowSaveFilePicker()).toBe(false);
    } finally {
      (globalThis as { window?: unknown }).window = w;
    }
  });

  it("returns false when showSaveFilePicker is missing", () => {
    (globalThis as { window?: unknown }).window = {};
    expect(supportsShowSaveFilePicker()).toBe(false);
  });

  it("returns true when showSaveFilePicker is a function", () => {
    (globalThis as { window?: unknown }).window = { showSaveFilePicker: () => Promise.resolve() };
    expect(supportsShowSaveFilePicker()).toBe(true);
  });
});
