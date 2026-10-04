# RECIPE: full-page-screenshot

> How to capture a faithful full-page PNG screenshot of a web page — especially inside
> mobile webviews (iOS WKWebView) where naive approaches silently capture only the viewport.
> Battle-tested in production bug-report flows.

## 1. Problem

You need a PNG of the **entire scrollable page**, not just the visible viewport — e.g. for a
"report a bug" flow where the user annotates what went wrong. `html2canvas(element)` on the
wrong element gives you a viewport-sized image and nobody tells you it's truncated.

**Done means:** one function call returns a PNG `Blob` of the full scrollable content, plus a
measurement record proving what was captured (root, dimensions, scale, output size).

## 2. Decisions (with why)

### Capture the outer scroll root, never an inner `<main>`

**Why:** In iOS webviews (including locked-viewport app webviews), an inner content element can
report only viewport height via `clientHeight`/`scrollHeight`. The outer scroll root
(e.g. `[data-generated-space-root]`, falling back to `document.body`) is the element whose
scroll extent is real. We learned this the hard way: screenshots came back truncated
below the fold with zero errors — the measurement record is what exposed it.

**Rule:** root priority = explicit `options.root` → `[data-generated-space-root]` →
`[data-full-page-capture]` → `document.body`.

**Exception — a fixed full-screen overlay is open:** if the visible page is a
`position: fixed` overlay with its own scroll container (full-screen detail view, modal
dialog), capturing the page root is *wrong*. The fixed overlay is out of document flow,
so the root's `scrollHeight` measures the **behind** page's height — and the output
composites overlay content on top with behind-page content below. Pass the overlay element
itself as `options.root`: its `scrollHeight` is the real content height. Mark the overlay
with an attribute (e.g. `data-capture-root`) so the capture call can find it.

### Use html2canvas with `foreignObjectRendering: true`

**Why:** html2canvas's manual layout engine is less faithful for complex pages; foreignObject
rendering (SVG `<foreignObject>` snapshot) preserves modern CSS far better.
**Rejected:** manual `windowWidth`/`windowHeight` spoofing tricks — fragile across iOS versions.

### Expand the clone, reset scroll, de-stick sticky elements

In `onclone`, before rendering:
- Set the cloned root to the **full measured width/height** (`scrollWidth`/`scrollHeight`),
  `overflow: visible`, `scrollTop/scrollLeft = 0`.
- Convert `position: sticky` elements to `relative` at their natural position. Sticky controls
  are useful while scrolling, but a full-page image has no viewport — left sticky, they stamp
  themselves over the final rows or repeat.

### Pre-decode images to data URLs; keep an overlay fallback

**Why:** WKWebView's foreignObject rasterizer can **silently drop decoded images** from the
snapshot. So before cloning, every in-scope `<img>` is decoded to a data URL and swapped into
the clone (`srcset`/`sizes` removed). For critical images, `overlaySelectors` nominates
elements whose bytes are painted **directly onto the finished canvas** at their measured
document rect (with clip) — this path doesn't depend on clone-time CSS at all.
**Rejected:** `useCORS: true` — flaky across CDNs; data-URL prep is deterministic.

### Measure everything, restore everything

- `onMeasurement` fires **twice**: with the requested geometry before render, and with
  `outputWidth/outputHeight` after. If output is viewport-sized, you know immediately.
- `onWarning` / `onOverlayDiagnostic` report recoverable failures (image prep failed, overlay
  paint failed) with stage-by-stage detail — never silent.
- A `finally` block restores the live DOM: removes the marker attribute, restores every
  image's original `src`/`srcset`/`sizes`. The page must look untouched after capture.

### Cap the canvas

Scale = `min(devicePixelRatio capped at 2, 16384/width, 16384/height, sqrt(maxPixelArea/area))`,
default `maxPixelArea` 12 MP. Mobile pages can be 3–4× taller than the viewport; uncapped
canvases OOM the webview.

### Clipboard: start the write synchronously in the tap handler

iOS grants clipboard access on the user gesture. `copyFullPageScreenshot` must be called
**directly from the click/tap handler**: it creates the `ClipboardItem` with a *promised*
blob synchronously, then the capture runs async. If you `await` the capture first, the
gesture grant is gone and the write fails.

### Wait for `document.fonts.ready` before measuring

Text laid out with fallback font metrics can shift when the webfont arrives, and
foreignObject rendering can miss text entirely if fonts aren't ready at serialize time.
So capture awaits `document.fonts.ready` first, bounded at 1500ms so a hung font load
never blocks the screenshot. Learned from `@prongbang/screenshot`'s hard-won constraints
(they independently confirmed the foreignObject blank-canvas failure).

## 3. Failure modes (enumerate before coding)

| # | Failure | Detection | Mitigation |
|---|---|---|---|
| 1 | Root measures viewport height only | `measurement.containerHeight ≈ viewportHeight` on a long page | Root priority list above; assert in E2E |
| 2 | Truncated below the fold, no error | Compare `outputHeight` vs `containerHeight × scale` | Measurement record; E2E on a tall page |
| 3 | Sticky header stamped over content | Visual inspection | De-stick in `onclone` |
| 4 | Images missing in output (WKWebView) | `onOverlayDiagnostic` / visual | Data-URL prep + `overlaySelectors` fallback |
| 5 | Canvas OOM on very tall pages | Browser crash / blank output | `maxPixelArea` cap + scale caps |
| 6 | Clipboard write rejected on iOS | `NotAllowedError` | Synchronous `ClipboardItem` in tap handler |
| 7 | Live DOM left mutated | Subsequent renders broken | `finally` restore; E2E asserts DOM clean |
| 8 | CORS-tainted images blank | Visual | Data-URL prep instead of `useCORS` |
| 9 | Fixed full-screen overlay open, page root captured | Output composites overlay content on top + behind-page content below (wrong `scrollHeight`) | Pass the overlay element as `options.root`; mark it (e.g. `data-capture-root`) |

## 4. Platform quirks (field notes)

- **iOS webview / WKWebView:** inner scroll containers lie about `scrollHeight`; foreignObject
  rasterizer drops decoded images; clipboard needs a synchronous gesture grant.
- **Muse iOS webview specifically:** portrait-locked — never rely on orientation media queries
  around capture; screenshots always capture the physical portrait screen.
- **html2canvas 1.4.1:** pinned; newer versions change foreignObject behavior — upgrade only
  with the full E2E matrix below.

## 5. Spec

See `SPEC.md` (v1.0.0): option shapes, measurement record fields, diagnostic event stages.

## 6. Verification (E2E checklist)

- [ ] Tall page (≥3× viewport): `outputHeight ≈ containerHeight × scale`, content visible below
  the original fold.
- [ ] Page with sticky header: header appears exactly once, not stamped over rows.
- [ ] Page with images (incl. `srcset`): all images present in output; overlay fallback exercised
  for at least one nominated selector.
- [ ] `hideSelectors`: nominated elements absent from output, present in live DOM.
- [ ] DOM restore: after capture, live DOM has no marker attributes and original image `src`s.
- [ ] Copy flow: tap → image lands on clipboard (real device; sandbox can't do this).
- [ ] Zero console errors.
- [ ] Fixed full-screen overlay open (own scroll container): capture with the overlay as
  `root`; output contains only overlay content — no behind-page chrome.

## 7. Anti-goals

- Not a general DOM-to-image library: opinionated for the report-screenshot use case
  (PNG output, measurement-first, webview-hardened).
- No server component, no network calls, no telemetry — pure client function.
- No PDF / multi-format export (out of scope; open an issue if you need it).
