import { useEffect, useState } from "react";
import {
  Folder,
  Plus,
  RefreshCw,
  Download,
} from "lucide-react";
import {
  pickSyncFolder,
  createLocalSnapshot,
  listLocalSnapshots,
  restoreSnapshot,
  backupToSyncFolder,
  getSyncFolderConfig,
  setSyncFolderConfig,
  type SnapshotInfo,
} from "../../lib/backup";
import { formatRelativeTime, formatBytes } from "../../lib/backupConfig";

export default function SettingsPage() {
  const [syncFolder, setSyncFolder] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function refresh() {
    const [cfg, snaps] = await Promise.all([
      getSyncFolderConfig(),
      listLocalSnapshots().catch(() => [] as SnapshotInfo[]),
    ]);
    setSyncFolder(cfg);
    setSnapshots(snaps);
  }
  useEffect(() => {
    refresh();
  }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handlePickFolder() {
    const p = await pickSyncFolder();
    if (p) {
      await setSyncFolderConfig(p);
      setSyncFolder(p);
      flash("已保存");
    }
  }

  async function handleCreateSnapshot() {
    setBusy(true);
    try {
      await createLocalSnapshot();
      await refresh();
      flash("快照已创建");
    } finally {
      setBusy(false);
    }
  }

  async function handleBackupToSync() {
    if (!syncFolder) return;
    setBusy(true);
    try {
      await backupToSyncFolder(syncFolder);
      flash("已备份到同步盘");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(path: string) {
    if (pendingRestore === path) {
      setBusy(true);
      try {
        await restoreSnapshot(path);
        flash("已恢复，应用将重启");
      } finally {
        setBusy(false);
        setPendingRestore(null);
      }
    } else {
      setPendingRestore(path);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold">设置</h2>

      <section className="notion-card space-y-3">
        <h3 className="text-sm font-medium">同步盘备份</h3>
        <div className="text-sm">
          {syncFolder ? (
            <code className="text-xs text-notion-muted break-all">
              {syncFolder}
            </code>
          ) : (
            <span className="text-notion-muted">未设置</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePickFolder}
            className="notion-btn-ghost text-sm"
          >
            <Folder size={14} /> {syncFolder ? "更换" : "选择文件夹"}
          </button>
          {syncFolder && (
            <button
              onClick={handleBackupToSync}
              disabled={busy}
              className="notion-btn-primary text-sm"
            >
              <Download size={14} /> 立即备份
            </button>
          )}
        </div>
      </section>

      <section className="notion-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">本地快照</h3>
          <button
            onClick={handleCreateSnapshot}
            disabled={busy}
            className="notion-btn-ghost text-sm"
          >
            <Plus size={14} /> 立即创建快照
          </button>
        </div>
        {snapshots.length === 0 ? (
          <p className="text-sm text-notion-muted">暂无快照</p>
        ) : (
          <ul className="divide-y divide-notion-border">
            {snapshots.map((s) => (
              <li
                key={s.path}
                className="py-2 flex items-center gap-3 text-sm"
              >
                <span className="flex-1">
                  {formatRelativeTime(s.created_at)}
                </span>
                <span className="text-notion-muted">
                  {formatBytes(s.size_bytes)}
                </span>
                {pendingRestore === s.path ? (
                  <>
                    <span className="text-xs text-red-600">确认恢复？</span>
                    <button
                      onClick={() => handleRestore(s.path)}
                      disabled={busy}
                      className="notion-btn-danger text-xs"
                    >
                      确认
                    </button>
                    <button
                      onClick={() => setPendingRestore(null)}
                      className="notion-btn-ghost text-xs"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleRestore(s.path)}
                    className="notion-btn-ghost text-xs"
                  >
                    <RefreshCw size={12} /> 恢复
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {toast && (
        <div className="fixed top-4 right-4 notion-card text-sm shadow-notion-modal">
          {toast}
        </div>
      )}
    </div>
  );
}
