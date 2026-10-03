# Module Verifier (demo Space app)

A thin [Muse](https://muse.ai) Space app that validates `muse-app-vibe-kit`
modules against their real `reference/` implementations.

It is **source code only** — the Space itself is not published. Use it to
verify that a module's reference implementation drops into a real app and
works end to end.

## Structure

- The home page is a **module list**. Each module has its own verification
  page that mirrors a realistic usage scenario — never an artificial fixture.
- Each module's `reference/` files are vendored verbatim under
  `client/src/vendor/<module>/` (byte-identical to
  `modules/<module>/reference/` — never reimplement, never edit).
- Each verification page calls the real API and shows the exact returned
  output.

Current modules:

| Module | Verification page |
|---|---|
| `annotate-image` | Pick the fixture image → `openAnnotator()` overlay → annotated image plus the programmatic result (`strokes`, per-stroke `bbox` + `points` JSON) |
| `full-page-screenshot` | A naturally scrolling long page (like a real app page) → `captureFullPageScreenshot()` on the page root → PNG preview, measurements, Download PNG, and Copy to clipboard (`copyFullPageScreenshot`, capability-gated via `supportsImageClipboard()`) |

## Adding a module

1. Copy `modules/<name>/reference/` into `client/src/vendor/<name>/`.
2. Add the module to the home-page list in `client/src/App.tsx`.
3. Add a verification page that reproduces the module's realistic usage
   (capture a real page root, annotate a real image, …) and displays its
   output.

## Running it

This is a standard Muse TypeScript Space (`space.json`). Import the
`demos/module-verifier/` directory as a Space to run it.
