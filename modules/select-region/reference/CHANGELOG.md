# Changelog

## 1.0.0 (2026-10-03)

Initial release.

- `selectRegion(options?)`: full-screen overlay, drag a rectangle, returns document-relative `{ x, y, width, height }` CSS pixels or `null` on cancel.
- Touch-hardened (Pointer Events + `touch-action: none`), page scroll locked during selection, ESC cancels.
- Output shape matches `full-page-screenshot`'s `region` option and `annotate-image`'s bbox.
