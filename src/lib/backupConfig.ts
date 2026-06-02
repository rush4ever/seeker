export type SnapshotInfo = {
  path: string;
  created_at: string;
  size_bytes: number;
};

export function formatRelativeTime(ts: string, now: Date = new Date()): string {
  const t = new Date(ts).getTime();
  const diffSec = Math.floor((now.getTime() - t) / 1000);
  if (diffSec < 60) return "刚刚";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return "昨天";
  return `${days} 天前`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function sortSnapshotsByTime(
  snapshots: SnapshotInfo[],
): SnapshotInfo[] {
  return [...snapshots].sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
  );
}
