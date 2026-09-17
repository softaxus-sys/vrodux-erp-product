import type { Config } from "tailwindcss";

/**
 * Brand tokens live here, not scattered through components.
 * Swap these three ramps and the whole site re-skins for the client.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f6f5",
          100: "#e7e7e4",
          200: "#cfcfc9",
          300: "#adaca3",
          400: "#85837a",
          500: "#6a6860",
          600: "#54524c",
          700: "#44423e",
          800: "#2b2a27",
          900: "#1a1918",
          950: "#0f0e0d",
        },
        sand: {
          50: "#fbf8f3",
          100: "#f4ede0",
          200: "#e7d9bf",
          300: "#d7bf96",
          400: "#c5a16c",
          500: "#b78a4f",
          600: "#a67343",
          700: "#8a5a39",
          800: "#714935",
          900: "#5d3e2e",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: { widest: "0.22em" },
      maxWidth: { content: "78rem" },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { rise: "rise .6s cubic-bezier(.16,1,.3,1) both" },
    },
  },
  plugins: [],
};

export default config;
