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
      // Tests may import pure helpers that live next to a model (e.g. isValidTransition)
      "src/**/*.test.ts",
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
    // Local git worktrees carry their own .next output; never lint them.
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
