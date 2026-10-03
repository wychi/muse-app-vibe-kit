# select-region examples

## Basic: pick a region, log it

```ts
import { selectRegion } from "@muse-app-vibe-kit/select-region";
import "@muse-app-vibe-kit/select-region/styles.css";

document.getElementById("pick")!.addEventListener("click", async () => {
  const region = await selectRegion();
  console.log(region); // { x, y, width, height } or null
});
```

## Region screenshot: select-region + full-page-screenshot

```ts
import html2canvas from "html2canvas";
import { selectRegion } from "@muse-app-vibe-kit/select-region";
import "@muse-app-vibe-kit/select-region/styles.css";
import { captureFullPageScreenshot } from "@muse-app-vibe-kit/full-page-screenshot";

document.getElementById("shot-region")!.addEventListener("click", async () => {
  const region = await selectRegion({ confirmLabel: "Capture this area" });
  if (!region) return; // user cancelled
  const { blob } = await captureFullPageScreenshot(html2canvas, { region });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
});
```

## Custom styling

```ts
await selectRegion({
  dimColor: "rgba(20, 10, 40, 0.7)",
  borderColor: "#ff5a5a",
  hintText: "框選要截圖的區域",
  minSize: 20,
});
```
