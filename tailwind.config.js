/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        mastery: {
          low: "#ef4444",
          medium: "#eab308",
          high: "#22c55e",
        },
        notion: {
          bg: "#ffffff",
          surface: "#fbfbfa",
          border: "#e9e9e7",
          text: "#37352f",
          muted: "#787774",
          subtle: "#b4b4b0",
          accent: "#2383e2",
          "accent-bg": "#ddebf1",
          danger: "#e03e3e",
          success: "#0f7b6c",
          warning: "#cb912f",
        },
      },
      borderRadius: {
        notion: "6px",
      },
      fontFamily: {
        notion: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
      boxShadow: {
        "notion-hover": "0 1px 2px rgba(15,15,15,0.05)",
        "notion-modal": "0 8px 24px rgba(15,15,15,0.12)",
      },
    },
  },
  plugins: [],
};
