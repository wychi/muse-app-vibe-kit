// E2E for full-page-screenshot demo: capture, verify output image + measurement.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The module's output IS the product — save it as the README shot.
const SHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "e2e-shots", "full-page-screenshot");

export default {
  path: "/screenshot/",
  steps: async (page, shot) => {
    await page.waitForSelector("#capture-btn");
    await shot("01-initial");
    await page.click("#capture-btn");
    await page.waitForSelector("#shot-img[src]", { timeout: 30000 });
    await shot("02-captured");
    const bytes = await page.evaluate(async () => {
      const blob = await (await fetch(document.querySelector("#shot-img").src)).blob();
      return [...new Uint8Array(await blob.arrayBuffer())];
    });
    mkdirSync(SHOT_DIR, { recursive: true });
    writeFileSync(join(SHOT_DIR, "output.png"), Buffer.from(bytes));
  },
  assert: async (page) => {
    const src = await page.getAttribute("#shot-img", "src");
    if (!src || !src.startsWith("blob:")) {
      throw new Error("shot-img has no blob URL");
    }
    const measurement = await page.textContent("#measurement");
    if (!measurement || !/\d+\s*×\s*\d+/.test(measurement)) {
      throw new Error("measurement missing dimensions: " + measurement);
    }
  },
};
