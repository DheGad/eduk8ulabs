import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

/**
 * Vite config for Chrome/Edge Manifest V3 extension.
 *
 * MV3 requires multiple separate entry points (NOT a single bundle):
 *   • background/serviceWorker — MUST be a single ES module file
 *   • content/interceptor      — injected into target pages
 *   • popup                    — the browser action popup
 *   • options                  — optional settings page
 *
 * We use Vite's lib mode with rollupOptions to emit each as
 * a separate chunk at a predictable path in dist/.
 */
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  define: {
    __DEV__:          JSON.stringify(mode === "development"),
    __VERSION__:      JSON.stringify("94.0.0"),
    __STREETMP_URL__: JSON.stringify(
      mode === "development"
        ? "http://localhost:4000"
        : "https://os.streetmp.com"
    ),
  },

  build: {
    outDir:    "dist",
    emptyOutDir: true,
    sourcemap: mode === "development" ? "inline" : false,
    minify:    mode === "production",
    target:    "es2022",

    rollupOptions: {
      input: {
        // Service worker (background)
        background: resolve(__dirname, "src/background/serviceWorker.ts"),
        // Content script injected into AI sites
        "content/interceptor": resolve(__dirname, "src/content/interceptor.ts"),
        // Popup UI (React)
        popup: resolve(__dirname, "src/popup/index.html"),
        // Options page
        options: resolve(__dirname, "src/options/index.html"),
      },

      output: {
        // Flat file names — required by MV3 manifest references
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          // CSS files from the popup/content
          if (assetInfo.name?.endsWith(".css")) {
            return assetInfo.name.includes("shield")
              ? "content/shield.css"
              : "assets/[name][extname]";
          }
          return "assets/[name][extname]";
        },
        // Ensure service worker is NOT split (MV3 requirement)
        manualChunks: undefined,
      },
    },
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
}));
