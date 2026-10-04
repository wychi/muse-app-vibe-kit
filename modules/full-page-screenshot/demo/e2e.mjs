// E2E for full-page-screenshot demo: capture, verify output image + measurement.
export default {
  path: "/screenshot/",
  steps: async (page, shot) => {
    await page.waitForSelector("#capture-btn");
    await shot("01-initial");
    await page.click("#capture-btn");
    await page.waitForSelector("#shot-img[src]", { timeout: 30000 });
    await shot("02-captured");
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
