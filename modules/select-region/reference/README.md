# @muse-app-vibe-kit/select-region

Full-screen drag-to-select a rectangular region. Framework-free, zero
dependencies, hardened for mobile touch.

## Usage

```ts
import { selectRegion } from "@muse-app-vibe-kit/select-region";
import "@muse-app-vibe-kit/select-region/styles.css";

const region = await selectRegion();
if (region) {
  // region = { x, y, width, height }, document-relative CSS pixels
}
```

Returns `null` when the user cancels (Cancel / × / ESC).

## With full-page-screenshot

The output feeds directly into the `region` option:

```ts
import html2canvas from "html2canvas";
import { captureFullPageScreenshot } from "@muse-app-vibe-kit/full-page-screenshot";

const region = await selectRegion();
if (region) {
  const { blob } = await captureFullPageScreenshot(html2canvas, { region });
}
```

## Options

| Option | Default | Notes |
|---|---|---|
| `dimColor` | `rgba(0, 0, 0, 0.55)` | Overlay dim |
| `borderColor` | `#0a84ff` | Selection border |
| `minSize` | `8` | Smaller drags are ignored |
| `confirmLabel` | `"Use region"` | |
| `cancelLabel` | `"Cancel"` | |
| `hintText` | `"Drag to select a region"` | |

See `../SPEC.md` for the exact contract and `../RECIPE.md` for why.
