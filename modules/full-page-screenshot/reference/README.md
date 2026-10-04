# @muse-app-vibe-kit/screenshot

Faithful full-page PNG screenshots of web pages — hardened for mobile webviews
(iOS WKWebView) where naive captures silently return only the viewport.

Part of [muse-app-vibe-kit](../../README.md): every module ships a **recipe**
(`RECIPE.md`) explaining the decisions, failure modes, and platform quirks — so you can
drop in the reference implementation *or* rebuild it yourself.

![Full-page capture output (1280×2244)](https://raw.githubusercontent.com/wychi/muse-app-vibe-kit/main/modules/full-page-screenshot/demo/screenshots/readme.png)

[Live demo](https://wychi.github.io/muse-app-vibe-kit/screenshot/)

## Install

```bash
npm install @muse-app-vibe-kit/screenshot html2canvas
```

> Publishing requires the `@muse-app-vibe-kit` npm org (one-time setup).
> Until then, install from this repo's `reference/` directory.

## Quickstart

```ts
import html2canvas from "html2canvas";
import { captureFullPageScreenshot } from "@muse-app-vibe-kit/screenshot";

const { blob, measurement } = await captureFullPageScreenshot(html2canvas, {
  // root: document.querySelector("[data-app-root]"),  // optional; auto-detected otherwise
  hideSelectors: [".my-toolbar", ".floating-button"],
  onMeasurement: (m) =>
    console.log(`captured ${m.outputWidth}x${m.outputHeight} from ${m.scrollContainer}`),
});

// blob is a PNG of the full page — upload it, attach it to a bug report, etc.
```

Copy to clipboard (call **directly** from the tap handler — iOS requires the gesture):

```ts
import { copyFullPageScreenshot, supportsImageClipboard } from "@muse-app-vibe-kit/screenshot";

async function onTap(event) {
  if (!supportsImageClipboard()) return;
  await copyFullPageScreenshot(html2canvas); // starts the clipboard write synchronously
}
```

## Why this exists

Capturing `document.body` with html2canvas sounds trivial until a mobile webview hands you
a viewport-sized image with no error. This module encodes the fixes: outer-root selection,
sticky-element handling, WKWebView image-drop fallback, canvas memory caps, DOM restore,
and a measurement record that proves what you got. Read `RECIPE.md` for the full story.

## Security

Pure client-side function. No network calls, no telemetry, no external state. Your page's
pixels never leave the browser except through the `Blob` returned to **your** code.

## License

MIT
