import { defineConfig } from "vite";

export default defineConfig({
  // Tauri expects a fixed port in dev; keep it stable and out of src-tauri.
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    // Tauri serves the built frontend from dist/.
    target: "es2021",
  },
});
