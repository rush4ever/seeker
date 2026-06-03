// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveBrowserFile } from "./download";

// jsdom doesn't ship URL.createObjectURL / revokeObjectURL — polyfill so
// the implementation can call them. The polyfill is reset per test.
const objectURLStore = new Map<Blob, string>();
let objectURLCounter = 0;
beforeEach(() => {
  objectURLStore.clear();
  objectURLCounter = 0;
  if (!URL.createObjectURL) {
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      const url = `blob:mock-${++objectURLCounter}`;
      objectURLStore.set(obj as Blob, url);
      return url;
    };
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = () => {};
  }
});

describe("saveBrowserFile", () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on HTMLAnchorElement.click so we can assert the download was
    // triggered without jsdom trying to navigate.
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  it("default download: writes to <a download> when picker absent", async () => {
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined;

    const blob = new Blob(["hello"], { type: "text/plain" });
    const result = await saveBrowserFile(blob, "test.txt");

    expect(result).toEqual({ saved: true, displayName: "test.txt" });
    expect(clickSpy).toHaveBeenCalled();
  });

  it("showSaveFilePicker happy path: writes via handle, returns saved=true", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = vi
      .fn()
      .mockResolvedValue({ createWritable });

    const blob = new Blob(["pdf bytes"], { type: "application/pdf" });
    const result = await saveBrowserFile(blob, "report.pdf");

    expect(result).toEqual({ saved: true, displayName: "report.pdf" });
    expect(write).toHaveBeenCalledWith(blob);
    expect(close).toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("showSaveFilePicker user cancel: returns saved=false, does not throw", async () => {
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("User cancelled"), { name: "AbortError" }),
      );

    const blob = new Blob(["x"], { type: "application/pdf" });
    const result = await saveBrowserFile(blob, "x.pdf");

    expect(result).toEqual({ saved: false, displayName: "x.pdf" });
  });

  it("showSaveFilePicker real error: re-throws so caller can toast it", async () => {
    (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = vi
      .fn()
      .mockRejectedValue(new Error("Permission denied"));

    const blob = new Blob(["x"], { type: "application/pdf" });
    await expect(saveBrowserFile(blob, "x.pdf")).rejects.toThrow(/Permission denied/);
  });
});
