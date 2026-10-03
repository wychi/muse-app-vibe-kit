// E2E for select-region demo: drag a region, confirm, verify coordinates.
export default {
  path: "/select-region/",
  steps: async (page, shot) => {
    await page.waitForSelector("#pick");
    await shot("01-initial");
    await page.click("#pick");
    // Overlay should appear; drag a 200x200 rect.
    await page.waitForSelector(".select-region-overlay", { timeout: 5000 });
    await shot("02-overlay");
    await page.mouse.move(100, 300);
    await page.mouse.down();
    await page.mouse.move(300, 500, { steps: 10 });
    await page.mouse.up();
    await shot("03-dragged");
    await page.click("text=Confirm");
    await page.waitForFunction(
      () => !document.querySelector(".select-region-overlay"),
      { timeout: 5000 }
    );
    await shot("04-result");
  },
  assert: async (page) => {
    const text = await page.textContent("#out");
    let r;
    try { r = JSON.parse(text); }
    catch { throw new Error("output is not JSON: " + text); }
    if (!(r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0)) {
      throw new Error("bad region: " + text);
    }
    // Dragged 200x200, allow ±10 for pointer rounding.
    if (Math.abs(r.width - 200) > 10 || Math.abs(r.height - 200) > 10) {
      throw new Error("size off, expected ~200x200: " + text);
    }
  },
};
