# RECIPE: select-region

## 1. Problem

Region screenshots need a region, but every app reimplements the drag-a-rectangle
picker. A shared, touch-hardened picker means the `region` option of
`full-page-screenshot` (and bbox inputs elsewhere) is actually usable.

## 2. Decisions (with why)

### Full-screen fixed overlay, page scroll locked

**Why:** the rectangle must map to document coordinates. If the page scrolls
mid-drag, viewport coords drift. Locking `body` overflow for the duration keeps
`clientX + scrollX` stable. Original overflow is restored in `finally`-style
cleanup on every exit path.

### Pointer Events, not mouse/touch separately

**Why:** one code path for mouse and touch. `touch-action: none` on the overlay
prevents the browser from hijacking the drag as a scroll gesture on mobile.

### Confirm step after drag (not instant-resolve on release)

**Why:** fat-finger drags are common on phones. Showing the rect with its
dimensions plus Confirm / Redraw / Cancel costs one tap and prevents garbage
regions. ESC always cancels.

### `minSize` guard (default 8px)

**Why:** accidental taps produce 1–2px rects. Below the threshold the drag is
silently discarded and the hint returns — no error, no empty resolve.

### Document-relative output coordinates

**Why:** the primary consumer is `full-page-screenshot`'s `region` option,
which takes document-relative CSS px. Returning viewport coords would force
every caller to add scroll offsets (and get it wrong).

## 3. Failure modes (enumerate before coding)

- User taps without dragging → below `minSize` → hint returns, no resolve yet.
- User presses ESC / × / Cancel → resolve `null`.
- Page has `body { overflow: hidden !important }` → our inline lock is a no-op;
  coords still correct because scroll can't change anyway.
- Overlay opened inside an iframe → `position: fixed` covers the iframe
  viewport only; coordinates are iframe-document-relative. Documented, not fixed.
- `pointercancel` (OS gesture steals the pointer) → treated as pointerup;
  partial drag is evaluated normally.

## 4. Platform quirks (field notes)

- **iOS Safari:** `touch-action: none` is required; without it the drag becomes
  a scroll. `setPointerCapture` keeps move events flowing when the finger
  drifts over buttons.
- **Safe areas:** action bar uses `env(safe-area-inset-bottom)` so buttons
  don't sit under the home indicator.
- **`z-index: 2147483647`:** sits above app overlays; the annotate overlay uses
  the same value — don't open both at once.

## 5. Spec

See `SPEC.md` (v1.0.0).

## 6. Verification (E2E checklist)

- [ ] Drag produces a rect with live `W × H` label
- [ ] Release below `minSize` discards, hint returns
- [ ] Confirm returns document-relative coords (scroll the page first, verify offset)
- [ ] Cancel / × / ESC returns `null`, overlay removed, scroll restored
- [ ] Touch drag works on a real phone (no scroll hijack)
- [ ] Returned rect fed to `full-page-screenshot` `region` crops correctly

## 7. Anti-goals

- No freehand drawing (that's `annotate-image`).
- No multi-region selection; one rect per call.
- No magnetic snapping to elements (a different module's job).
