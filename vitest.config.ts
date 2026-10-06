import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.{ts,tsx}", "src/server/**/*.{ts,tsx}"],
      // Thin framework wrappers: covered by end-to-end tests instead.
      exclude: ["src/lib/supabase/**", "**/*.test.{ts,tsx}"],
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
});
