// Refreshes modules/*/demo/screenshots/readme.png from E2E screenshots,
// but ONLY when the UI visibly changed (change-driven, not per-release).
//
// For each module with `demo.readme_shot` in module.yaml, pixel-diffs
// e2e-shots/<name>/<readme_shot> against the committed readme.png. When the
// diff exceeds THRESHOLD, the whole batch of changed shots is committed to
// the chore/readme-screenshots branch and a single PR is opened (or the
// existing one updated) for human review.
//
// The build-stamp corner (bottom-right) is masked out of the diff — it
// changes on every build by design.
// Run from the repo root: `node .github/workflows/refresh-readme-shots.mjs`
// Set DRY_RUN=1 to diff without committing/pushing/opening a PR.

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BRANCH = "chore/readme-screenshots";
const THRESHOLD = 0.02; // 2% of pixels
const DRY_RUN = process.env.DRY_RUN === "1";

// --- Minimal YAML reader (flat keys + nested maps via 2-space indent). ---
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
      let v = rest;
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      parent[key] = v;
    }
  }
  return root;
}

// --- Pixel diff with the build-stamp corner masked out. ---
async function diffRatio(freshPath, committedPath) {
  const { PNG } = await import("pngjs");
  const { default: pixelmatch } = await import("pixelmatch");
  const a = PNG.sync.read(readFileSync(freshPath));
  const b = PNG.sync.read(readFileSync(committedPath));
  if (a.width !== b.width || a.height !== b.height) return 1;
  // Mask bottom-right 360x60 (build stamp: fixed, bottom:8px, right:8px).
  for (const img of [a, b]) {
    const { width, height, data } = img;
    for (let y = Math.max(0, height - 60); y < height; y++) {
      for (let x = Math.max(0, width - 360); x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  return changed / (a.width * a.height);
}

const changed = [];
for (const entry of readdirSync(join(ROOT, "modules"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const name = entry.name;
  const meta = parseYaml(readFileSync(join(ROOT, "modules", name, "module.yaml"), "utf8"));
  const shotFile = meta.demo?.readme_shot;
  if (!shotFile) {
    console.log(`[${name}] no demo.readme_shot, skipping`);
    continue;
  }
  const fresh = join(ROOT, "e2e-shots", name, String(shotFile));
  const target = join(ROOT, "modules", name, "demo", "screenshots", "readme.png");
  if (!existsSync(fresh)) {
    console.log(`[${name}] fresh shot missing (${shotFile}), skipping`);
    continue;
  }
  const ratio = existsSync(target) ? await diffRatio(fresh, target) : 1;
  console.log(`[${name}] visual diff: ${(ratio * 100).toFixed(2)}%`);
  if (ratio > THRESHOLD) {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(fresh, target);
    changed.push(name);
  }
}

if (changed.length === 0) {
  console.log("No visual changes — readme.png files are up to date.");
  process.exit(0);
}

console.log(`Changed: ${changed.join(", ")}`);
if (DRY_RUN) {
  console.log("DRY_RUN=1 — skipping git push and PR.");
  process.exit(0);
}

const git = (args) => execFileSync("git", args, { stdio: "inherit", cwd: ROOT });
git(["checkout", "-B", BRANCH]);
git(["add", ...changed.map((n) => `modules/${n}/demo/screenshots/readme.png`)]);
git(["-c", "user.name=github-actions[bot]", "-c", "user.email=github-actions[bot]@users.noreply.github.com",
  "commit", "-m", `chore: refresh README screenshots (${changed.join(", ")})`]);
git(["push", "-f", "origin", BRANCH]);

let existing = "";
try {
  existing = execFileSync("gh", ["pr", "list", "--head", BRANCH, "--state", "open",
    "--json", "number", "--jq", ".[0].number"], { encoding: "utf8", cwd: ROOT }).trim();
} catch { /* gh not available or no PR */ }
if (!existing || existing === "null") {
  execFileSync("gh", ["pr", "create",
    "--title", "chore: refresh README screenshots",
    "--body", `Visual change detected in E2E screenshots vs committed \`readme.png\`.\n\nUpdated: ${changed.join(", ")}\n\nPlease review the images before merging — screenshots are curated documentation.`,
  ], { stdio: "inherit", cwd: ROOT });
  console.log("Opened PR for README screenshot refresh.");
} else {
  console.log(`Updated existing PR #${existing}.`);
}
