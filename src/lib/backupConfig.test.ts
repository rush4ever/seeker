import { describe, it, expect } from "vitest";
import {
  formatRelativeTime,
  formatBytes,
  sortSnapshotsByTime,
} from "./backupConfig";

describe("formatRelativeTime", () => {
  const now = new Date("2026-06-02T10:00:00Z");
  it("returns 刚刚 for < 60s", () => {
    expect(formatRelativeTime("2026-06-02T09:59:30Z", now)).toBe("刚刚");
  });
  it("returns N 分钟前", () => {
    expect(formatRelativeTime("2026-06-02T09:55:00Z", now)).toBe("5 分钟前");
  });
  it("returns N 小时前", () => {
    expect(formatRelativeTime("2026-06-02T07:00:00Z", now)).toBe("3 小时前");
  });
  it("returns 昨天 for yesterday", () => {
    expect(formatRelativeTime("2026-06-01T10:00:00Z", now)).toBe("昨天");
  });
  it("returns N 天前", () => {
    expect(formatRelativeTime("2026-05-28T10:00:00Z", now)).toBe("5 天前");
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });
  it("formats KB", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
  it("formats MB", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
  it("formats GB", () => {
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
  });
});

describe("sortSnapshotsByTime", () => {
  it("sorts by created_at desc", () => {
    const s = [
      { path: "a", created_at: "2026-01-01", size_bytes: 1 },
      { path: "b", created_at: "2026-06-01", size_bytes: 1 },
    ];
    expect(sortSnapshotsByTime(s).map((x) => x.path)).toEqual(["b", "a"]);
  });
});
