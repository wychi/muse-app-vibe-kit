// E2E for the developer-panel demo: spec 1.3.0 flow against a mock wiring.
// Screenshot is optional now — the test does two passes: one report without
// a screenshot, one with (Add screenshot -> annotate -> thumbnail -> submit).
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

    // ---- Pass 1: report WITHOUT a screenshot ----
    // Report issue -> describe step appears immediately (no auto screenshot).
    await page.click(".dev-panel-card .dev-action-button-primary");
    await page.waitForSelector(".dev-report-description", { timeout: 10000 });
    const viewId = await page.textContent(".dev-report-view code");
    if (!viewId || !viewId.includes("demo_home")) {
      throw new Error(`page/view ID not shown, got: ${viewId}`);
    }
    await page.waitForTimeout(300);
    await shot("03-describing-no-screenshot");

    await page.click('.dev-report-category:has-text("Broken")');
    await page.fill(".dev-report-description", "E2E test report without screenshot");

    // Submit with no screenshot -> report ID card.
    await page.click(".dev-report-actions .dev-action-button-primary");
    await page.waitForSelector(".report-id-card", { timeout: 15000 });
    await shot("04-report-id-no-screenshot");

    // ---- Pass 2: report WITH a screenshot ----
    await page.click(".report-id-close");
    await page.click(".dev-panel-card .dev-action-button-primary");
    await page.waitForSelector(".dev-report-description", { timeout: 10000 });

    // Add screenshot -> annotator opens.
    await page.click(".dev-report-actions .dev-action-button-secondary");
    await page.waitForSelector(".vk-annotate", { timeout: 30000 });
    await shot("05-annotating");

    // Draw one stroke, then Done -> thumbnail lands back in the describe step.
    const canvas = await page.$(".vk-annotate-stage canvas");
    if (!canvas) throw new Error("annotation canvas not found");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("annotation canvas has no box");
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 140, box.y + 100, { steps: 10 });
    await page.mouse.up();
    await page.click(".vk-annotate-done");

    await page.waitForSelector(".dev-report-thumb", { timeout: 10000 });
    await page.waitForTimeout(300);
    await shot("06-describing-with-screenshot");
    await page.fill(".dev-report-description", "E2E test report with screenshot");

    await page.click(".dev-report-actions .dev-action-button-primary");
    await page.waitForSelector(".report-id-card", { timeout: 15000 });
    await shot("07-report-id-with-screenshot");
  },
  assert: async (page) => {
    // Report ID card shows the mock short ID.
    const idText = await page.textContent(".report-id-card code");
    if (!idText || !idText.includes("rpt-demo01")) {
      throw new Error(`report ID card missing mock ID, got: ${idText}`);
    }
    // Two reports were submitted.
    const payloads = await page.evaluate(() => window.__devPanelDemo.payloads);
    if (payloads.length !== 2) throw new Error(`expected 2 payloads, got ${payloads.length}`);

    // Pass 1: no screenshot -> no data_base64, bundle screenshot is null.
    if ("data_base64" in payloads[0]) throw new Error("pass 1 payload should not carry data_base64");
    const bundle1 = JSON.parse(payloads[0].debug_bundle);
    if (bundle1.screenshot !== null) throw new Error("pass 1 bundle.screenshot should be null");
    if (bundle1.view !== "demo_home") throw new Error(`bundle view wrong: ${bundle1.view}`);

    // Pass 2: annotated PNG attached, bundle carries the measurement.
    if (!payloads[1].data_base64 || payloads[1].data_base64.length < 1000) {
      throw new Error("pass 2 payload missing annotated PNG");
    }
    const bundle2 = JSON.parse(payloads[1].debug_bundle);
    if (!bundle2.screenshot || typeof bundle2.screenshot.outputWidth !== "number") {
      throw new Error("pass 2 bundle.screenshot missing measurement");
    }

    // Analytics events flowed through the wiring.
    const names = await page.evaluate(() => window.__devPanelDemo.events.map((e) => e.name));
    for (const n of ["report_category_selected", "report_submitted"]) {
      if (!names.includes(n)) throw new Error(`missing wiring event: ${n}`);
    }
    // Annotation event fired exactly once (pass 2 only).
    const annotations = await page.evaluate(() =>
      window.__devPanelDemo.events.filter((e) => e.name === "report_annotation_completed"));
    if (annotations.length !== 1) throw new Error(`expected 1 annotation event, got ${annotations.length}`);
    if (annotations[0].props.skipped !== false || !(annotations[0].props.strokes >= 1)) {
      throw new Error(`annotation event wrong: ${JSON.stringify(annotations[0].props)}`);
    }
    const submitted = await page.evaluate(() =>
      window.__devPanelDemo.events.filter((e) => e.name === "report_submitted"));
    if (submitted.length !== 2) throw new Error(`expected 2 submitted events, got ${submitted.length}`);

    // The submitted debug bundle has the industry-standard shape.
    const bundle = bundle2;
    if (bundle.schema_version !== 1) throw new Error("bundle schema_version != 1");
    for (const k of ["captured_at", "app_version", "view", "url", "client", "device_label", "events", "diagnostics"]) {
      if (!(k in bundle)) throw new Error(`bundle missing key: ${k}`);
    }
    if (!bundle.client.browser || !bundle.client.os) throw new Error("bundle client missing browser/os");
  },
  showcase: [
    { file: "02-panel-open.png", caption: "DEV panel with Report issue + Screenshot" },
    { file: "03-describing-no-screenshot.png", caption: "Describe step first — page ID, category, description, optional screenshot" },
    { file: "06-describing-with-screenshot.png", caption: "Annotated thumbnail back in the describe step" },
    { file: "07-report-id-with-screenshot.png", caption: "Report ID card after submit" },
  ],
};
