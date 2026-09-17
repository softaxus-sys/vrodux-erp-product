import type { Config } from "tailwindcss";

/**
 * Brand tokens live here and in src/lib/brand.ts. The ramps below are the
 * client's existing palette, carried over so the new site matches their
 * established identity.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand red.
        brand: {
          50: "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          300: "#FCA5A5",
          400: "#F26D70",
          500: "#E5262B",
          600: "#C81F24",
          700: "#A81A1E",
          800: "#8A1619",
          900: "#6B1114",
        },
        // Neutral ramp, matching the client's existing greys.
        ink: {
          50: "#F7FAFC",
          100: "#EDF2F7",
          200: "#E2E8F0",
          300: "#CBD5E0",
          400: "#A0AEC0",
          500: "#718096",
          600: "#4A5568",
          700: "#2D3748",
          800: "#1A202C",
          900: "#141922",
          950: "#0D1017",
        },
      },
      fontFamily: {
        // Cabin for headings and navigation, Poppins for body — the client's
        // existing typefaces.
        display: ["var(--font-display)", "Cabin", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "Poppins", "system-ui", "sans-serif"],
      },
      letterSpacing: { widest: "0.18em" },
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
