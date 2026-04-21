import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Stub `server-only` so modules that use it can still be unit-tested.
      // In app runtime this package throws when imported from client code —
      // in Node test land we just noop it.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    // Narrow include so vitest doesn't try to parse Next server-only files.
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
  },
});
