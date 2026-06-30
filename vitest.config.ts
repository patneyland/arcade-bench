import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // The harness package owns its own vitest config / test run.
    exclude: ["**/node_modules/**", "harness/**", ".next/**"],
    // Run test files sequentially: the recordVote enforcement test spins up an isolated
    // SQLite DB via `prisma db push`, and parallel workers contend on SQLite file locks +
    // subprocess startup, causing flaky failures. Determinism > marginal speed here.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
