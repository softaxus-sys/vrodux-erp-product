import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Web build (nginx) must use an absolute base so deep links / hard refreshes resolve
// assets from "/assets/...". Electron loads over file:// and needs a relative base,
// so the electron build passes `--mode electron`.
export default defineConfig(({ mode }) => ({
  base: mode === "electron" ? "./" : "/",
  plugins: [react()],
  define: {
    // Prevent "process is not defined" from any leftover process.env references
    "process.env": {},
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Ensure a single React copy — react-i18next (and other hook-using libs) must
    // share the app's React instance or hooks throw "Invalid hook call".
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    rollupOptions: {
      output: {
        // Granular chunk splitting for better cache efficiency
        manualChunks: {
          "react-vendor":  ["react", "react-dom"],
          "router":        ["react-router-dom"],
          "query":         ["@tanstack/react-query"],
          "ui-radix":      [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-tabs",
            "@radix-ui/react-select",
            "@radix-ui/react-scroll-area",
          ],
          "motion":        ["framer-motion"],
          "charts":        ["recharts", "apexcharts", "react-apexcharts"],
          "forms":         ["react-hook-form", "@hookform/resolvers", "zod"],
          "zustand":       ["zustand"],
          "icons":         ["lucide-react"],
          "i18n":          ["i18next", "react-i18next", "i18next-browser-languagedetector"],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "zustand",
      "framer-motion",
      "lucide-react",
      "i18next",
      "react-i18next",
      "i18next-browser-languagedetector",
    ],
  },
}));
