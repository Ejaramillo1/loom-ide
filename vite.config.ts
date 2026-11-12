import { defineConfig } from "vite";

export default defineConfig({
  // Tauri expects a fixed port in dev; keep it stable and out of src-tauri.
  server: {
    port: 1420,
    strictPort: true,
    // The browser fallback in src/api.ts talks to the Loom server
    // through /api/loom so the dev server can reach it without CORS
    // trouble. In the Tauri app the Rust backend calls Loom directly.
    proxy: {
      "/api/loom": {
        target: "http://localhost:5006",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/loom/, ""),
      },
    },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    // Tauri serves the built frontend from dist/.
    target: "es2021",
  },
});
