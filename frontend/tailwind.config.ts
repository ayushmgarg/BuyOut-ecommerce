import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          50: "#f0f0ff",
          100: "#e0e0ff",
          500: "#6b5ce7",
          600: "#5a4bd6",
          700: "#4a3bc5",
          800: "#1a1a2e",
          900: "#0f0f1a",
          950: "#080810",
        },
        snkrs: {
          crimson: "#c41230",
          orange: "#ff6b35",
          success: "#00d68f",
        },
      },
      fontFamily: {
        display: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
