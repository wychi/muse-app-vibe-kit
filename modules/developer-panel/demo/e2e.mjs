// E2E for the developer-panel demo: full report flow against a mock wiring.
// html2canvas is bundled into the IIFE, so no CDN is needed.

export default {
  path: "/dev-panel/",
  steps: async (page, shot) => {
    await page.waitForSelector(".dev-panel-trigger", { timeout: 15000 });
    await shot("01-closed");

    // Open the panel.
    await page.click(".dev-panel-trigger");
    await page.waitForSelector(".dev-panel-card", { timeout: 5000 });
    await page.waitForTimeout(400); // let the entry animation finish
    await shot("02-panel-open");

    // Start a report → screenshot is captured, annotator opens.
    await page.click(".dev-panel-card .dev-action-button-primary");
    await page.waitForSelector(".vk-annotate", { timeout: 30000 });
    await shot("03-annotating");

    // Draw one stroke, then Done.
    const canvas = await page.$(".vk-annotate-stage canvas");
    if (!canvas) throw new Error("annotation canvas not found");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("annotation canvas has no box");
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 140, box.y + 100, { steps: 10 });
    await page.mouse.up();
    await page.click(".vk-annotate-done");

    // Describe step: thumbnail + category + textarea.
    await page.waitForSelector(".dev-report-description", { timeout: 10000 });
    await page.waitForTimeout(300);
    await shot("04-describing");
    await page.click('.dev-report-category:has-text("Broken")');
    await page.fill(".dev-report-description", "E2E test report");

    // Submit → report ID card.
    await page.click(".dev-panel-card .dev-action-button-primary");
    await page.waitForSelector(".report-id-card", { timeout: 15000 });
    await shot("05-report-id");
  },
  assert: async (page) => {
    // Report ID card shows the mock short ID.
    const idText = await page.textContent(".report-id-card code");
    if (!idText || !idText.includes("rpt-demo01")) {
      throw new Error(`report ID card missing mock ID, got: ${idText}`);
    }
    // Analytics events flowed through the wiring.
    const names = await page.evaluate(() => window.__devPanelDemo.events.map((e) => e.name));
    for (const n of ["report_annotation_completed", "report_category_selected", "report_submitted"]) {
      if (!names.includes(n)) throw new Error(`missing wiring event: ${n}`);
    }
    const annotated = await page.evaluate(() =>
      window.__devPanelDemo.events.find((e) => e.name === "report_annotation_completed"));
    if (annotated.props.skipped !== false || !(annotated.props.strokes >= 1)) {
      throw new Error(`annotation event wrong: ${JSON.stringify(annotated.props)}`);
    }
    // The submitted debug bundle has the industry-standard shape.
    const bundle = await page.evaluate(() => JSON.parse(window.__devPanelDemo.lastPayload.debug_bundle));
    if (bundle.schema_version !== 1) throw new Error("bundle schema_version != 1");
    for (const k of ["captured_at", "app_version", "view", "url", "client", "device_label", "events", "diagnostics"]) {
      if (!(k in bundle)) throw new Error(`bundle missing key: ${k}`);
    }
    if (bundle.view !== "demo_home") throw new Error(`bundle view wrong: ${bundle.view}`);
    if (!bundle.client.browser || !bundle.client.os) throw new Error("bundle client missing browser/os");
  },
  showcase: [
    { file: "02-panel-open.png", caption: "DEV panel with Report issue + Screenshot" },
    { file: "04-describing.png", caption: "Describe step — annotated thumbnail, category, description" },
    { file: "05-report-id.png", caption: "Report ID card after submit" },
  ],
};
