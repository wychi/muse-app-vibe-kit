# RECIPE: annotate-image

> Freehand annotation overlay for images: mount it on any image source, the user draws,
> you get back an annotated PNG. Framework-free. Feed it video frames and it annotates
> video too — one frame at a time.
> Battle-tested in production bug-report flows (screenshot → annotate → describe).

## 1. Problem

After capturing a screenshot (or any photo), the user needs to **point at the problem**:
circle the broken button, arrow at the wrong number. A plain image attachment forces the
developer to guess what the reporter meant. Annotation closes that gap — but building it
well means getting pointer math, canvas export, and mobile touch behavior right.

**Done means:** one call mounts a full-screen overlay on the image; the user draws with a
pen, or skips; you get back `{ dataBase64, strokes, skipped, width, height }` and the DOM
is clean.

## 2. Decisions (with why)

### Framework-free vanilla TS, not a React component

**Why:** The proven implementation was a React component, but annotation is needed
everywhere — bug-report flows, photo markup, video frame review. A vanilla module with a
`mount → onComplete` API drops into React (via ref), Vue, or a plain page with no adapter.
The React wrapper is ten lines; the reverse (un-React-ing a component) is a rewrite.

### Accept three image source kinds

`string` (data URL) | `Blob`/`File` | `HTMLImageElement`. Data URLs and Blobs are the
safe paths — they never taint the canvas. Remote `http(s)` URLs are accepted best-effort
with `crossOrigin="anonymous"`, but if the server lacks CORS headers the canvas taints and
export throws: **on export failure we fall back to the original bytes** (marked
`skipped: true`) rather than crashing the flow. A missing annotation must never lose the
report.

### Pointer Events + pointer capture, not touch/mouse split handlers

**Why:** One code path for mouse, touch, and pen. `setPointerCapture` keeps the stroke
alive when the finger slides off the canvas edge; `touch-action: none` on the canvas stops
the page scrolling mid-stroke on mobile. Split touch/mouse handlers drift apart and the
touch path is the one nobody tests.

### Coordinates in canvas pixels, mapped from client rect

`x = (clientX - rect.left) * (canvas.width / rect.width)`. The displayed canvas is CSS-
scaled (`max-width: 100%`); drawing in client pixels would make strokes blurry or offset
on export. Canvas-pixel math keeps strokes exactly where the finger was, at full export
resolution.

### Pen width scales with the image

`lineWidth = max(3, canvas.width / 300)`. A fixed 3px pen disappears on a 3000px-wide
screenshot; a fixed 12px pen is a marker on a thumbnail. Proportional width looks right at
every size.

### Skip is a first-class result

`skipped: true` returns the **original** image bytes with the stroke count so far. Forcing
users to draw when there's nothing to mark creates noise annotations; the analytics event
(`report_annotation_completed` with `skipped`) tells you how often annotation is actually
used.

### Downscale huge sources before annotating

`maxDimension` (default 4096px): larger images are drawn down to fit. A 12 MP phone photo
as a canvas is 48 MB of pixels before a single stroke — mobile webviews OOM. The exported
PNG matches the (possibly downscaled) working size; `width`/`height` in the result say what
you got.

### Self-contained styles, prefixed classes

All CSS ships in `styles.css` under the `vk-annotate` prefix with hardcoded colors — no
CSS-variable theming contract, no dependency on the host app's theme. A shared component
that inherits host styles breaks in every new host.

## 3. Failure modes (enumerate before coding)

| # | Failure | Detection | Mitigation |
|---|---|---|---|
| 1 | Stroke offset/blurry on scaled display | Visual: stroke not under finger | Canvas-pixel coordinate mapping |
| 2 | Page scrolls mid-stroke on touch | Stroke breaks / page moves | `touch-action: none` + pointer capture |
| 3 | Canvas OOM on huge images | Crash / blank | `maxDimension` downscale |
| 4 | Tainted canvas export throws | `toBlob`/`toDataURL` throws | Fall back to original bytes, `skipped: true` |
| 5 | Image never loads, overlay hangs | — | Load failure → immediate skip result, never hang |
| 6 | Object URLs leak | Memory growth | `revoke()` on close, in `finally`-equivalent paths |
| 7 | Double-complete (Done tapped twice) | Duplicate reports | `completed` guard; callback fires exactly once |
| 8 | Pen invisible on large/small images | Visual | Proportional line width |

## 4. Platform quirks (field notes)

- **iOS Safari:** canvas area limits (~16 MP); the 4096px default cap stays well under.
  `PointerEvent` requires iOS 13+ — acceptable baseline.
- **Muse iOS webview:** portrait-locked; the overlay uses `env(safe-area-inset-*)` so the
  toolbar clears the notch/home indicator.
- **Cross-origin images:** without CORS headers the canvas taints silently at draw time and
  only fails at export — hence the export-time fallback, not load-time rejection.

## 5. Spec

See `SPEC.md` (v1.0.0): option shapes, result shape, source-kind rules, completion guarantees.

## 6. Verification (E2E checklist)

- [ ] Draw a stroke → it appears exactly under the pointer, at export resolution.
- [ ] Undo removes last stroke; Clear empties all; count label updates.
- [ ] Color switch changes subsequent strokes only.
- [ ] Skip returns the original bytes with `skipped: true`.
- [ ] Done with zero strokes returns the image, `strokes: 0`, `skipped: false`.
- [ ] Oversize image (e.g. 8000px wide) is downscaled; result `width`/`height` reflect it.
- [ ] Cross-origin image without CORS → Done falls back to original, no crash.
- [ ] Overlay removed from DOM after Done/Skip; object URLs revoked.
- [ ] `onComplete` fires exactly once even under double-tap.
- [ ] Touch: page does not scroll while drawing (real device).

## 7. Anti-goals

- No shapes/arrows/text tools in v1 — freehand pen only. Shapes are the obvious v2.
- No video timeline UI — the module annotates **one image**; video is "extract frame →
  annotate → composite" in the caller.
- No server, no storage, no telemetry — pixels go in, pixels come out.

## 8. Video (future direction)

The API already accepts any image source, so video annotation needs no module change:
seek → `drawImage(video)` to a canvas → `canvas.toBlob()` → `openAnnotator({ image: blob })`
→ composite the annotated frame back. A `annotateVideoFrame(video, timeMs)` helper is the
natural v1.1 addition.
