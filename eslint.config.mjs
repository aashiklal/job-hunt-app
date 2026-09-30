import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      // Allowed to import models directly
      "src/lib/models/**",
      "src/lib/repositories/**",
      "src/lib/auth-helpers.ts",
      "src/lib/usage.ts",
      // Tests construct fixture state and assert on raw documents. Forcing
      // that through the repository layer would mean testing the repositories
      // with themselves.
      "src/**/*.test.ts",
      "src/test/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/models/*", "**/lib/models/*"],
              message:
                "Do not import Mongoose models directly. Use a function from src/lib/repositories/ instead.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Flat config does not read .gitignore, so gitignored trees that still
    // contain source have to be listed here or they fail the lint run.
    ".worktrees/**",
    "tmp/**",
  ]),
]);

export default eslintConfig;
