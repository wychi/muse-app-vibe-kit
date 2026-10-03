// Runs each module's demo/e2e.mjs against the deployed Pages site.
// Each e2e module exports { path, steps(page, shot), assert(page) }.
// Screenshots go to e2e-shots/<module>/<name>.png
// Exits non-zero on first assertion failure.

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const BASE = process.env.DEMO_BASE_URL || "https://wychi.github.io/muse-app-vibe-kit";
const ROOT = new URL("../..", import.meta.url).pathname;
const SHOT_DIR = join(ROOT, "e2e-shots");

// Install check: playwright must be available
try {
  execFileSync("npx", ["playwright", "--version"], { stdio: "pipe" });
} catch {
  console.error("Playwright not found. Run: npx playwright install chromium");
  process.exit(1);
}

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const failures = [];

for (const mod of readdirSync(join(ROOT, "modules"), { withFileTypes: true })) {
  if (!mod.isDirectory()) continue;
  const e2ePath = join(ROOT, "modules", mod.name, "demo", "e2e.mjs");
  let test;
  try {
    test = (await import(pathToFileURL(e2ePath).href)).default;
  } catch {
    console.log(`[${mod.name}] no e2e.mjs, skipping`);
    continue;
  }

  console.log(`\n[${mod.name}] testing ${BASE}${test.path}`);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const modShotDir = join(SHOT_DIR, mod.name);
  mkdirSync(modShotDir, { recursive: true });
  const shot = (name) => page.screenshot({ path: join(modShotDir, `${name}.png`) });

  try {
    await page.goto(BASE + test.path, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForFunction(() => document.fonts?.ready, { timeout: 10000 }).catch(() => {});
    await test.steps(page, shot);
    await test.assert(page);
    console.log(`[${mod.name}] ✓ passed`);
  } catch (e) {
    console.error(`[${mod.name}] ✗ FAILED: ${e.message}`);
    try { await shot("99-failure"); } catch {}
    failures.push(`${mod.name}: ${e.message}`);
  }
  await page.close();
}

await browser.close();

if (failures.length > 0) {
  console.error("\nFailures:\n" + failures.map(f => "  - " + f).join("\n"));
  process.exit(1);
}
console.log("\nAll demo E2E tests passed ✓");
