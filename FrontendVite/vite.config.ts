import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // Prevent "process is not defined" from any leftover process.env references
    "process.env": {},
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
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
    ],
  },
});
