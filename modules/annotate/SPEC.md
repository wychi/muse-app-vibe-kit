# SPEC: annotate v1.0.0

Versioned rules for the module. Additive-only: new options must be optional, existing
behavior must not change without a major version bump.

## API

```ts
openAnnotator(options: AnnotateOptions): AnnotatorHandle
```

## Options

| Option | Type | Default | Rule |
|---|---|---|---|
| `image` | `string \| Blob \| HTMLImageElement` | required | Data URL string, Blob/File, or a **loaded** element (unloaded element rejects) |
| `colors` | `string[]` | `["#ff453a", "#ffd60a", "#ffffff"]` | First color is selected initially; empty array falls back to default |
| `title` | `string` | `"Mark the image"` | Toolbar title |
| `hint` | `string` | `"Draw what should change"` | Shown until the first stroke, then replaced by the stroke count |
| `maxDimension` | `number` | `4096` | Images larger than this on either side are downscaled before annotating |
| `zIndex` | `number` | `1000` | Overlay z-index |
| `onComplete` | `(result) => void` | required | Called **exactly once** |
| `onClose` | `() => void` | — | Called after the overlay leaves the DOM |

## Result

```ts
type AnnotateResult = {
  dataBase64: string;  // annotated PNG, no `data:` prefix; original bytes on skip
  strokes: number;
  skipped: boolean;
  width: number;       // working/exported pixel width (post-downscale)
  height: number;
};
```

## Source-kind rules

- Data URL / Blob: always safe, never taint.
- Remote `http(s)` URL: loaded with `crossOrigin="anonymous"`; if the canvas taints,
  export falls back to the original bytes with `skipped: true` — never throws to the caller.
- Unloaded `HTMLImageElement`, or any load failure: `onComplete` fires immediately with
  `{ dataBase64: "", strokes: 0, skipped: true, width: 0, height: 0 }` — never hangs.

## Guarantees

- `onComplete` fires exactly once per `openAnnotator` call (double-tap safe).
- The overlay is removed from the DOM and object URLs revoked after Done/Skip/`close()`.
- Pen width = `max(3, canvas.width / 300)`; round caps and joins.
- No network calls, no telemetry, no external state. Styles are self-contained
  (`styles.css`, `vk-annotate` prefix).

## Handle

```ts
type AnnotatorHandle = {
  element: HTMLElement;              // overlay root (in document.body after image loads)
  close: (result?: AnnotateResult) => void;  // default: skip with original image
};
```

## Changelog

- `1.0.0` (2026-10-02): initial spec. Freehand pen, 3 default colors, undo/clear,
  skip-as-first-class-result, downscale cap, taint fallback.
