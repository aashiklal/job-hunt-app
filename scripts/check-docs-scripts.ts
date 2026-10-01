import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Fails the build when the documentation promises an npm script that does not
 * exist.
 *
 * This repository previously documented a test suite, a typecheck script and a
 * CI pipeline that had never been written. A reviewer who runs a documented
 * command and gets "Missing script" stops trusting everything else the docs
 * say, so the cheapest guard is to make that specific lie impossible.
 */

const ROOT = process.cwd();
const DOC_FILES = ["README.md", "CLAUDE.md"];

const pkg = JSON.parse(
  readFileSync(resolve(ROOT, "package.json"), "utf8")
) as { scripts?: Record<string, string> };
const declared = new Set(Object.keys(pkg.scripts ?? {}));

// Matches `npm run <name>` and `npm test`, inside backticks or bare.
const NPM_RUN = /\bnpm run ([a-z0-9:_-]+)/gi;
const NPM_TEST = /\bnpm test\b/i;

type Problem = { file: string; script: string };
const problems: Problem[] = [];

for (const file of DOC_FILES) {
  const path = resolve(ROOT, file);
  if (!existsSync(path)) continue;

  const contents = readFileSync(path, "utf8");

  for (const match of contents.matchAll(NPM_RUN)) {
    const script = match[1];
    if (!declared.has(script)) {
      problems.push({ file, script: `npm run ${script}` });
    }
  }

  if (NPM_TEST.test(contents) && !declared.has("test")) {
    problems.push({ file, script: "npm test" });
  }
}

// A script can exist in package.json and still point at a file that was
// deleted, which is the same broken promise one step later.
const SCRIPT_TARGET = /\b(?:tsx|node)\b[^&|;]*?\s(scripts\/[\w./-]+\.[cm]?[jt]s)\b/g;
for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
  for (const match of command.matchAll(SCRIPT_TARGET)) {
    if (!existsSync(resolve(ROOT, match[1]))) {
      problems.push({
        file: "package.json",
        script: `npm run ${name} (missing ${match[1]})`,
      });
    }
  }
}

if (problems.length > 0) {
  console.error("\nDocumentation references npm scripts that do not exist:\n");
  for (const { file, script } of problems) {
    console.error(`  ${file}: ${script}`);
  }
  console.error(
    "\nEither add the script to package.json or remove the claim from the docs.\n"
  );
  process.exit(1);
}

console.log(
  `Checked ${DOC_FILES.join(", ")}: every documented npm script exists, and every script's file exists.`
);
