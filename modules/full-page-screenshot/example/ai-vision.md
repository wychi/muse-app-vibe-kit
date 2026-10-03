# Example: feed a screenshot to Muse AI

The module captures; your Muse app decides what to do with the pixels. This
pattern shows the screenshot → AI vision loop: capture on the client, send to
a server action, let `ctx.inference.complete` see the image.

## Client: capture and send

```ts
import html2canvas from "html2canvas";
import { captureFullPageScreenshot } from "@muse-app-vibe-kit/full-page-screenshot";
// `callAction` is your Space's action caller (e.g. generated hooks)

async function identifyOnScreen() {
  const { blob } = await captureFullPageScreenshot(html2canvas, {
    hideSelectors: ["#identify-btn"],
  });
  const imageBase64 = await blobToBase64(blob);
  // Server does the AI call; the client never touches inference directly.
  return await callAction("identifyScreenshotObjects", { imageBase64 });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

## Server: AI sees the screenshot

```ts
import { z } from "zod";

const identifiedObject = z.object({
  name: z.string(),        // e.g. "Save button"
  description: z.string(), // e.g. "Blue rounded button overlapping the last list row"
});

defineAction({
  name: "identifyScreenshotObjects",
  request: z.object({ imageBase64: z.string().min(1) }),
  response: z.object({ objects: z.array(identifiedObject) }),
  handler: async (ctx, { imageBase64 }) => {
    return await ctx.inference.complete(
      "List every distinct UI element or object visible in this screenshot. " +
      "For each, give a short name and a one-line description of what it is " +
      "and where it sits.",
      {
        schema: z.object({ objects: z.array(identifiedObject) }),
        images: [{ dataBase64: imageBase64, mimeType: "image/png" }],
        timeout_secs: 60,
      }
    );
  },
});
```

## Notes

- Downscale before sending if the PNG is large (the module caps at 12 MP by
  default; inference is happier around ≤2048 px on the long edge).
- The AI result is a draft: let the user confirm or edit it, never auto-submit.
- On failure (timeout, offline), fall back to manual input — the screenshot
  itself is still useful.
- This pattern also powers AI-assisted bug reports: annotate first with
  `@muse-app-vibe-kit/annotate-image`, then send the annotated PNG plus the
  stroke bounding boxes as context.
