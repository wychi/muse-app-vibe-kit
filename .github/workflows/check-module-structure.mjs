// Validates every modules/<name>/ against MODULE_SPEC.md.
// Run: node .github/workflows/check-module-structure.mjs
// Exits non-zero with a list of violations.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;
const MODULES = join(ROOT, "modules");
let errors = [];

function err(mod, msg) {
  errors.push(`[${mod}] ${msg}`);
}

function checkFile(mod, rel, required = true) {
  const p = join(MODULES, mod, rel);
  if (!existsSync(p)) {
    if (required) err(mod, `missing required file: ${rel}`);
    return null;
  }
  return readFileSync(p, "utf8");
}

for (const mod of readdirSync(MODULES, { withFileTypes: true })) {
  if (!mod.isDirectory()) continue;
  const name = mod.name;

  // Required top-level files
  checkFile(name, "module.yaml");
  checkFile(name, "RECIPE.md");
  checkFile(name, "SPEC.md");

  // reference/package.json rules
  const pkgJson = checkFile(name, "reference/package.json");
  if (pkgJson) {
    let pkg;
    try { pkg = JSON.parse(pkgJson); }
    catch { err(name, "reference/package.json is not valid JSON"); continue; }

    const expectedName = `@muse-app-vibe-kit/${name}`;
    if (pkg.name !== expectedName) {
      err(name, `package.json name is "${pkg.name}", expected "${expectedName}"`);
    }
    if (pkg.exports?.["."] && !existsSync(join(MODULES, name, "reference", pkg.exports["."].replace(/^\.\//, "")))) {
      err(name, `exports["."] points to non-existent file: ${pkg.exports["."]}`);
    }
    for (const f of pkg.files ?? []) {
      if (!existsSync(join(MODULES, name, "reference", f))) {
        err(name, `files[] lists non-existent: ${f}`);
      }
    }
    const repoUrl = pkg.repository?.url ?? "";
    if (repoUrl.includes("USER/") || (repoUrl && !repoUrl.includes("wychi/muse-app-vibe-kit"))) {
      err(name, `repository.url looks wrong: ${repoUrl}`);
    }
  }

  checkFile(name, "reference/index.ts");
  checkFile(name, "reference/README.md");
  checkFile(name, "reference/LICENSE");
  checkFile(name, "reference/CHANGELOG.md");
  checkFile(name, "example/README.md");

  // demo checks
  const demoHtml = checkFile(name, "demo/index.html");
  if (demoHtml) {
    if (/from\s+["']\.\//.test(demoHtml)) {
      err(name, "demo/index.html uses ES import for local bundle — must use <script src> (IIFE)");
    }
    const hasCss = existsSync(join(MODULES, name, "reference", "styles.css"));
    const linksCss = demoHtml.includes('href="./styles.css"') || demoHtml.includes("href='styles.css'");
    if (hasCss && !linksCss) {
      err(name, "reference/styles.css exists but demo/index.html does not <link> it");
    }
  }
  const e2e = checkFile(name, "demo/e2e.mjs");
  if (e2e) {
    if (!e2e.includes("export default")) {
      err(name, "demo/e2e.mjs must have a default export");
    }
    for (const key of ["path", "steps", "assert"]) {
      if (!new RegExp(`\\b${key}\\b`).test(e2e)) {
        err(name, `demo/e2e.mjs missing "${key}"`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Module structure violations:\n" + errors.map(e => "  ✗ " + e).join("\n"));
  process.exit(1);
}
console.log("All modules conform to MODULE_SPEC.md ✓");
