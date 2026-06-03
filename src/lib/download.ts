/**
 * Browser-mode "save blob to disk" helper.
 *
 * Three save paths, in priority order:
 *   1. `window.showSaveFilePicker` — Chrome/Edge/Opera show a native
 *      "Save As" dialog. User picks location. Best UX, native feel.
 *   2. `<a download>` — Triggers the browser's default download (file goes
 *      to ~/Downloads). Works in Firefox/Safari and as a Chrome fallback
 *      when showSaveFilePicker throws.
 *   3. (Not implemented) Open blob URL in new tab as last resort.
 *
 * Returned `{ saved, displayName }`:
 *   - `saved = true`  — file was successfully written somewhere
 *   - `saved = false` — user cancelled the picker (AbortError); caller
 *                       should silently no-op
 *   - `displayName`   — the filename shown to the user in the toast
 */
import { supportsShowSaveFilePicker } from "./env";

export interface SaveResult {
  saved: boolean;
  displayName: string;
}

interface FileSystemWritableFileStream {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
}
interface FileSystemFileHandle {
  createWritable: () => Promise<FileSystemWritableFileStream>;
}
interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}
interface SaveFilePickerOptionsArg {
  showSaveFilePicker: (opts?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
}

export async function saveBrowserFile(
  blob: Blob,
  suggestedName: string,
): Promise<SaveResult> {
  if (supportsShowSaveFilePicker()) {
    try {
      // The Web spec requires the extension to start with "." (e.g. ".pdf",
      // not "pdf"). Without the leading dot the call throws.
      const ext = "." + (suggestedName.split(".").pop() ?? "");
      const handle = await (window as unknown as SaveFilePickerOptionsArg).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "File",
            accept: { [blob.type || "application/octet-stream"]: [ext] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { saved: true, displayName: suggestedName };
    } catch (e) {
      // User cancelled the picker — return saved=false so caller can no-op.
      // Check by name (not instanceof DOMException) so test mocks that
      // throw plain Error objects with name="AbortError" work too.
      if (
        typeof e === "object" &&
        e !== null &&
        "name" in e &&
        (e as { name?: string }).name === "AbortError"
      ) {
        return { saved: false, displayName: suggestedName };
      }
      // Real error (permission, disk full, etc.) — bubble up.
      throw e;
    }
  }
  // Fallback: trigger default download via temporary <a> element.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { saved: true, displayName: suggestedName };
}
