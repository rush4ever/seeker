import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { SnapshotInfo } from "./backupConfig";
export type { SnapshotInfo } from "./backupConfig";

export async function pickSyncFolder(): Promise<string | null> {
  return (await open({ directory: true, multiple: false })) as string | null;
}

export async function createLocalSnapshot(): Promise<SnapshotInfo> {
  return invoke("create_local_snapshot");
}

export async function listLocalSnapshots(): Promise<SnapshotInfo[]> {
  return invoke("list_local_snapshots");
}

export async function restoreSnapshot(path: string): Promise<void> {
  return invoke("restore_snapshot", { path });
}

export async function backupToSyncFolder(
  syncFolder: string,
): Promise<SnapshotInfo> {
  return invoke("backup_to_sync_folder", { syncFolder });
}

export async function getSyncFolderConfig(): Promise<string | null> {
  const db = await (await import("./db")).getDb();
  const r = await db.select<{ value: string }[]>(
    "SELECT value FROM app_config WHERE key = ?",
    ["sync_folder"],
  );
  return r[0]?.value ?? null;
}

export async function setSyncFolderConfig(path: string | null): Promise<void> {
  const db = await (await import("./db")).getDb();
  if (path) {
    await db.execute(
      "INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))",
      ["sync_folder", path],
    );
  } else {
    await db.execute("DELETE FROM app_config WHERE key = ?", ["sync_folder"]);
  }
}
