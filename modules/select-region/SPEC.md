# SPEC: select-region v1.0.0

Versioned rules for the module. Additive-only: new options must be optional, existing
behavior must not change without a major version bump.

## API

```ts
selectRegion(options?: SelectRegionOptions): Promise<RegionSelection | null>

type RegionSelection = {
  x: number;      // document-relative left, CSS px
  y: number;      // document-relative top, CSS px
  width: number;  // CSS px
  height: number; // CSS px
};

type SelectRegionOptions = {
  dimColor?: string;     // default "rgba(0, 0, 0, 0.55)"
  borderColor?: string;  // default "#0a84ff"
  minSize?: number;      // default 8 (CSS px); smaller drags are ignored
  confirmLabel?: string; // default "Use region"
  cancelLabel?: string;  // default "Cancel"
  hintText?: string;     // default "Drag to select a region"
};
```

## Behavior

- Opens a full-screen fixed overlay (`z-index: 2147483647`), dims the page.
- Page scroll is locked while open and restored on close.
- Pointer drag draws the rectangle (mouse + touch via Pointer Events,
  `touch-action: none`). Live dimension label follows the rect.
- On release: if the rect meets `minSize`, shows Confirm / Redraw / Cancel.
  Below `minSize` the drag is discarded and the hint returns.
- Confirm resolves with document-relative CSS pixels
  (`clientX + window.scrollX` at open). Cancel, ×, or ESC resolves `null`.
- The overlay DOM is removed in all cases; body scroll is always restored.

## Coordinate contract

The returned rectangle is designed to feed directly into
`@muse-app-vibe-kit/full-page-screenshot`'s `region` option
(document-relative CSS px). It also matches
`@muse-app-vibe-kit/annotate-image`'s bbox shape.

## Guarantees

- Zero dependencies; no network calls, no telemetry.
- Resolves (never hangs): every exit path settles the promise.
- `ESC` always cancels.

## Changelog

- `1.0.0` (2026-10-03): initial spec.
