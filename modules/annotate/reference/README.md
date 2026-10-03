# @muse-app-vibe-kit/annotate

Freehand annotation overlay for images — framework-free, hardened for mobile touch.
Hand it an image, the user draws, you get back an annotated PNG.

Part of [muse-app-vibe-kit](../../README.md): every module ships a **recipe**
(`RECIPE.md`) explaining the decisions, failure modes, and platform quirks — so you can
drop in the reference implementation *or* rebuild it yourself.

## Install

```bash
npm install @muse-app-vibe-kit/annotate
```

Import `styles.css` once (self-contained, `vk-annotate` prefix, no theming contract):

```ts
import "@muse-app-vibe-kit/annotate/styles.css";
```

> Publishing requires the `@muse-app-vibe-kit` npm org (one-time setup).
> Until then, install from this repo's `reference/` directory.

## Quickstart

```ts
import { openAnnotator } from "@muse-app-vibe-kit/annotate";
import "@muse-app-vibe-kit/annotate/styles.css";

document.getElementById("markup").addEventListener("click", async () => {
  const { dataBase64, strokes, skipped } = await new Promise((resolve) => {
    openAnnotator({
      image: photoBlob,          // data URL | Blob | HTMLImageElement
      onComplete: resolve,
    });
  });
  if (!skipped) {
    await fetch("/api/photos", {
      method: "POST",
      body: JSON.stringify({ image: dataBase64, strokes }),
    });
  }
});
```

React wrapper (ten lines):

```tsx
import { useEffect, useRef } from "react";
import { openAnnotator, type AnnotateResult } from "@muse-app-vibe-kit/annotate";

export function AnnotateButton({ image, onDone }: { image: Blob; onDone: (r: AnnotateResult) => void }) {
  const resolveRef = useRef(onDone);
  resolveRef.current = onDone;
  return (
    <button onClick={() => openAnnotator({ image, onComplete: (r) => resolveRef.current(r) })}>
      Mark up
    </button>
  );
}
```

Annotating a video frame (no module change needed):

```ts
video.currentTime = 12.5;
await new Promise((r) => (video.onseeked = r));
const frame = document.createElement("canvas");
frame.width = video.videoWidth; frame.height = video.videoHeight;
frame.getContext("2d")!.drawImage(video, 0, 0);
const blob = await new Promise<Blob>((r) => frame.toBlob((b) => r(b!), "image/png"));
openAnnotator({ image: blob, onComplete: ({ dataBase64 }) => uploadFrame(dataBase64) });
```

## Why this exists

Screenshot and photo markup keeps getting rebuilt per app — and rebuilt wrong: strokes
offset on scaled displays, pages scrolling mid-stroke on touch, canvas OOM on 12 MP phone
photos, cross-origin images exploding export. This module encodes the fixes: canvas-pixel
pointer math, pointer capture, proportional pen width, downscale caps, taint fallback, and
skip as a first-class result. Read `RECIPE.md` for the full story.

## Security

Pure client-side. No network calls, no telemetry, no external state. Pixels go in through
your code and come back to your code.

## License

MIT
