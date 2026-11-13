import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node environment: api.ts runs its localStorage fallback path here
    // (window is undefined, so IN_TAURI is false). localStorage is stubbed
    // in the test files; no DOM is needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
