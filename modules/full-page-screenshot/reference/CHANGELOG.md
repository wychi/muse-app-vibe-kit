# Changelog

## 1.2.0 (2026-10-03)

- New `region` option: crop the capture to a document-relative rectangle (CSS pixels) before encoding. Intersected with the captured area; empty intersection throws. This is the supported way to capture part of a page — nested scrollable DIVs remain unsupported. The module translates the region into capture-root content coordinates, including the root's own `scrollLeft`/`scrollTop` (fixed 2026-10-03: region was offset when the capture root was scrolled). The crop trace is in `measurement.crop`.

## 1.1.0 (2026-10-03)

- Wait for `document.fonts.ready` (bounded 1500ms) before measuring and rendering, so webfonts are laid out with real metrics and foreignObject rendering doesn't miss text. Inspired by `@prongbang/screenshot`'s hard-won constraint.

## 1.0.0 (2026-10-02)

Initial public release, extracted from production use in two apps' bug-report flows.

- `captureFullPageScreenshot(renderer, options)`: full-page PNG + measurement record.
- `copyFullPageScreenshot(renderer, options)`: clipboard flow preserving iOS tap-gesture grant.
- `supportsImageClipboard()`.
- Root priority: explicit root → `[data-generated-space-root]` → `[data-full-page-capture]` → `document.body`.
- WKWebView image-drop fallback via `overlaySelectors` + data-URL pre-decode.
- Sticky-to-relative handling in the render clone; live DOM restored in `finally`.
- Canvas caps: 12 MP default `maxPixelArea`, dimension caps, scale ≤ 2.
