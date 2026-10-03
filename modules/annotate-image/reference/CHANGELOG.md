# Changelog

## 1.1.0 (2026-10-02)

- Programmatic output: `AnnotateResult.annotations` — one entry per stroke with
  `bbox` (tight bounding box), full `points` path, and `color`, all in
  annotated-image pixels (same space as the exported PNG). `strokes` count kept
  for compatibility.

## 1.0.0 (2026-10-02)

Initial public release, extracted from production bug-report flows.

- `openAnnotator(options)`: full-screen annotation overlay on any image source
  (data URL, Blob, loaded element).
- Freehand pen with configurable colors (default red/yellow/white), undo, clear.
- Skip as a first-class result (`skipped: true` returns the original bytes).
- Proportional pen width, canvas-pixel pointer math, pointer capture for touch.
- `maxDimension` downscale cap (default 4096px) against canvas OOM.
- Cross-origin taint fallback: export failure returns the original image, never throws.
- `onComplete` fires exactly once; overlay + object URLs cleaned up on close.
- Self-contained `styles.css` (`vk-annotate` prefix, no theming contract).
