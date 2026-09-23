import { defineConfig } from "vitest/config";
import { resolve } from "path";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(root, "src"),
      // src/lib/db/connect.ts and most of src/lib import "server-only", which
      // throws outside a React Server Component. Stub it to a no-op module.
      "server-only": resolve(root, "src/test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // mongodb-memory-server has to download and boot a mongod binary on the
    // first run, which comfortably exceeds the 5s default.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/models/**", "src/lib/demo-fixtures.ts", "src/lib/prompts.ts"],
    },
  },
});
