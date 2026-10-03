// E2E for annotate-image demo: open annotator, draw strokes, complete, verify result.
export default {
  path: "/annotate/",
  steps: async (page, shot) => {
    await page.waitForSelector("#annotate-sample");
    await shot("01-initial");
    await page.click("#annotate-sample");
    await page.waitForSelector(".vk-annotate", { timeout: 5000 });
    await shot("02-annotator-open");
    // Draw two strokes on the canvas.
    const canvas = await page.$(".vk-annotate canvas");
    const box = await canvas.boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    for (const dx of [-60, 60]) {
      await page.mouse.move(cx + dx - 40, cy - 40);
      await page.mouse.down();
      await page.mouse.move(cx + dx + 40, cy + 40, { steps: 10 });
      await page.mouse.up();
    }
    await shot("03-strokes");
    // Complete via the Done/Confirm button.
    const doneBtn = await page.$(".vk-annotate button:has-text('Done'), .vk-annotate button:has-text('Complete'), .vk-annotate button:has-text('✓')");
    if (doneBtn) await doneBtn.click();
    await page.waitForSelector("#result-img[src]", { timeout: 5000 });
    await shot("04-result");
  },
  assert: async (page) => {
    const src = await page.getAttribute("#result-img", "src");
    if (!src || !src.startsWith("data:image/")) {
      throw new Error("result-img has no data URL");
    }
    const meta = await page.textContent("#result-meta");
    if (!meta || meta.trim().length === 0) {
      throw new Error("result-meta is empty");
    }
  },
};
