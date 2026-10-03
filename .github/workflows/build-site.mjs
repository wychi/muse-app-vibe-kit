// Assembles the GitHub Pages site from the modules — the single source of truth.
// For every modules/*/module.yaml with a `demo:` block:
//   - bundles reference/index.ts -> _site/<demo.path>/<bundle.file> (IIFE)
//   - copies reference/styles.css -> _site/<demo.path>/styles.css (if present)
//   - copies demo/* -> _site/<demo.path>/
// Then generates _site/index.html, the collection landing page.
// Run from the repo root: `node .github/workflows/build-site.mjs`

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "_site");
const ESBUILD = "esbuild@0.28.2";

// --- Minimal YAML reader: supports flat `key: value` (quoted strings, [flow,
// lists]) plus nested maps via 2-space indentation, up to 3 levels. Fails loudly
// on anything else so module.yaml never silently mis-parses.
function parseYaml(text) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  for (const rawLine of text.split("\n")) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    if (indent % 2 !== 0) throw new Error(`bad indent (must be 2-space): ${rawLine}`);
    const m = rawLine.trim().match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) throw new Error(`cannot parse line: ${rawLine}`);
    const [, key, rest] = m;
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    if (rest === "") {
      const child = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
    } else {
      parent[key] = parseScalar(rest);
    }
  }
  return root;
}

function parseScalar(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  if (s.startsWith("[") && s.endsWith("]")) return s.slice(1, -1).split(",").map((x) => parseScalar(x.trim())).filter((x) => x !== "");
  return s;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const modules = [];
for (const name of readdirSync(join(ROOT, "modules"), { withFileTypes: true })) {
  if (!name.isDirectory()) continue;
  const dir = join(ROOT, "modules", name.name);
  const yamlPath = join(dir, "module.yaml");
  if (!existsSync(yamlPath)) continue;
  const meta = parseYaml(readFileSync(yamlPath, "utf8"));
  if (!meta.demo || !meta.demo.path) continue;

  const demoPath = String(meta.demo.path);
  const outDir = join(OUT, demoPath);
  mkdirSync(outDir, { recursive: true });

  // 1. Bundle the reference implementation (what npm ships) as an IIFE.
  const entry = join(dir, "reference", "index.ts");
  const bundleFile = String(meta.demo.bundle?.file ?? `${name.name}.js`);
  const bundleGlobal = String(meta.demo.bundle?.global ?? "VibeKitModule");
  execFileSync("npx", ["--yes", ESBUILD, entry, "--bundle", "--format=iife",
    `--global-name=${bundleGlobal}`, "--minify", `--outfile=${join(outDir, bundleFile)}`],
    { stdio: "inherit" });

  // 2. Ship the reference stylesheet alongside, if the module has one.
  const css = join(dir, "reference", "styles.css");
  if (existsSync(css)) cpSync(css, join(outDir, "styles.css"));

  // 3. Copy the demo source (HTML + assets). Never contains build output.
  // README.md stays out of the deployed site — it's for developers, not visitors.
  const demoDir = join(dir, "demo");
  for (const f of readdirSync(demoDir)) {
    if (f.toLowerCase() === "readme.md") continue;
    cpSync(join(demoDir, f), join(outDir, f), { recursive: true });
  }

  // 4. Collect metadata for the collection page.
  let description = "";
  try {
    description = JSON.parse(readFileSync(join(dir, "reference", "package.json"), "utf8")).description ?? "";
  } catch { /* optional */ }
  modules.push({
    name: String(meta.name ?? name.name),
    displayName: String(meta.display_name ?? name.name),
    npm: String(meta.npm ?? ""),
    description,
    demoPath,
  });
  console.log(`built demo: ${name.name} -> /${demoPath}/`);
}

// 5. Collection landing page.
const cards = modules.map((m) => `
    <a class="card" href="./${esc(m.demoPath)}/">
      <h2>${esc(m.displayName)}</h2>
      <code>${esc(m.npm)}</code>
      <p>${esc(m.description)}</p>
      <span class="cta">Live demo →</span>
    </a>`).join("\n");

writeFileSync(join(OUT, "index.html"), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>muse-app-vibe-kit — live demos</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; color: #1d1d1f; }
  header { padding: 72px 24px 56px; text-align: center; background: #111827; color: #f9fafb; }
  header h1 { margin: 0 0 10px; font-size: clamp(28px, 5vw, 40px); }
  header p { max-width: 620px; margin: 0 auto; color: #d1d5db; }
  header a { color: #6ee7b7; }
  main { max-width: 860px; margin: 0 auto; padding: 48px 24px; display: grid;
         grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
  .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 24px; text-decoration: none; color: inherit; }
  .card:hover { border-color: #0071e3; }
  .card h2 { margin: 0 0 8px; font-size: 1.25rem; }
  .card code { background: #f5f5f7; padding: 2px 8px; border-radius: 6px; font-size: 0.85em; }
  .card p { color: #666; font-size: 0.95rem; }
  .card .cta { color: #0071e3; font-weight: 600; }
  footer { text-align: center; padding: 32px; color: #888; font-size: 0.9rem; }
  footer a { color: #0071e3; }
</style>
</head>
<body>
<header>
  <h1>muse-app-vibe-kit</h1>
  <p>Small, agent-friendly web modules: a recipe plus a reference implementation.
     Every demo below runs the module's published bundle — try them.</p>
  <p><a href="https://github.com/wychi/muse-app-vibe-kit">github.com/wychi/muse-app-vibe-kit</a></p>
</header>
<main>
${cards}
</main>
<footer>muse-app-vibe-kit · MIT</footer>
</body>
</html>
`);
console.log(`wrote _site/index.html with ${modules.length} demo(s)`);
