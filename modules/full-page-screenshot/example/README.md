# Minimal drop-in example

```html
<button id="shot">Capture full page</button>
<script type="module">
  import html2canvas from "html2canvas";
  import { captureFullPageScreenshot } from "@muse-app-vibe-kit/screenshot";

  document.getElementById("shot").addEventListener("click", async () => {
    const { blob, measurement } = await captureFullPageScreenshot(html2canvas, {
      hideSelectors: ["#shot"],
    });
    console.log("captured", measurement.outputWidth, "x", measurement.outputHeight);

    // Show it:
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");

    // Or upload it:
    // await fetch("/api/screenshots", { method: "POST", body: blob });
  });
</script>
```

See `../RECIPE.md` for *why* each of these choices exists.
