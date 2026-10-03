# Changelog

## 1.0.0 (2026-10-02)

Initial public release, extracted from production use in two apps' bug-report flows.

- `captureFullPageScreenshot(renderer, options)`: full-page PNG + measurement record.
- `copyFullPageScreenshot(renderer, options)`: clipboard flow preserving iOS tap-gesture grant.
- `supportsImageClipboard()`.
- Root priority: explicit root → `[data-generated-space-root]` → `[data-full-page-capture]` → `document.body`.
- WKWebView image-drop fallback via `overlaySelectors` + data-URL pre-decode.
- Sticky-to-relative handling in the render clone; live DOM restored in `finally`.
- Canvas caps: 12 MP default `maxPixelArea`, dimension caps, scale ≤ 2.
