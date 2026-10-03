# SPEC: full-page-screenshot v1.0.0

Versioned rules for the module. Additive-only: new options must be optional, existing
behavior must not change without a major version bump.

## API

```ts
captureFullPageScreenshot(
  renderer: Html2CanvasRenderer,   // e.g. html2canvas
  options?: FullPageScreenshotOptions
): Promise<{ blob: Blob; measurement: FullPageScreenshotMeasurement }>

copyFullPageScreenshot(
  renderer: Html2CanvasRenderer,
  options?: FullPageScreenshotOptions
): Promise<FullPageScreenshotMeasurement>   // must be called directly from a tap handler

supportsImageClipboard(): boolean
```

## Options (all optional)

| Option | Type | Default | Rule |
|---|---|---|---|
| `root` | `HTMLElement` | outer scroll root (see priority) | Explicit root wins over auto-detection |
| `hideSelectors` | `string[]` | `[]` | Removed from the **clone only**; live DOM untouched |
| `onWarning` | `(message, detail?) => void` | — | Recoverable failures only; never throws for these |
| `onMeasurement` | `(m) => void` | — | Called twice: pre-render geometry, post-render with output size |
| `overlaySelectors` | `string[]` | `[]` | Nominated images painted onto final canvas at measured rect |
| `onOverlayDiagnostic` | `(d) => void` | — | Stage machine: `received → prepared → decoded → draw-start → drawn \| failed` |
| `maxPixelArea` | `number` | `12_000_000` | Hard cap; scale is derived down to fit |

## Root priority (when `root` not given)

1. `[data-generated-space-root]`
2. `[data-full-page-capture]`
3. `document.body`

## Measurement record

`FullPageScreenshotMeasurement` must always include: `scrollContainer` (which root was used),
`containerWidth/Height`, `containerClientWidth/Height`, `viewportWidth/Height`,
`outputWidth/Height` (null until rendered), `scale`. Consumers use this to prove the capture
was full-page, not viewport-only.

## Guarantees

- The live DOM is restored after capture (`finally`), even on failure.
- No network calls, no telemetry, no external state.
- PNG output only in v1.x.

## Changelog

- `1.0.0` (2026-10-02): initial spec. Root priority, measurement record, overlay fallback,
  synchronous clipboard grant, canvas caps.
