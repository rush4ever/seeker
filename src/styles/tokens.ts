export const tokens = {
  color: {
    bg: "#ffffff",
    surface: "#fbfbfa",
    border: "#e9e9e7",
    textPrimary: "#37352f",
    textSecondary: "#787774",
    textTertiary: "#b4b4b0",
    accent: "#2383e2",
    accentBg: "#ddebf1",
    danger: "#e03e3e",
    success: "#0f7b6c",
    warning: "#cb912f",
  },
  radius: { sm: "4px", md: "6px", lg: "8px" },
  font: {
    stack:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  shadow: {
    hover: "0 1px 2px rgba(15,15,15,0.05)",
    modal: "0 8px 24px rgba(15,15,15,0.12)",
  },
} as const;
