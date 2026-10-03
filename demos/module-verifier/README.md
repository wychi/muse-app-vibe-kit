# Module Verifier (demo Space app)

A thin [Muse](https://muse.ai) Space app that validates `muse-app-vibe-kit`
modules against their real `reference/` implementations.

It is **source code only** — the Space itself is not published. Use it to
verify that a module's reference implementation drops into a real app and
works end to end.

## How it works

- The top dropdown selects which module to validate.
- Each module's `reference/` files are vendored verbatim under
  `client/src/vendor/<module>/` (byte-identical to
  `modules/<module>/reference/` — never reimplement, never edit).
- Each module gets one validation panel in `client/src/App.tsx` that runs the
  real API against a focused test fixture and shows the exact returned output.

Current modules:

| Module | Validation |
|---|---|
| `annotate-image` | `openAnnotator()` on a fixture screenshot → shows the annotated image plus the programmatic result (`strokes`, per-stroke `bbox` + `points` JSON) |
| `full-page-screenshot` | `captureFullPageScreenshot()` → shows the captured image and measurements |

## Adding a module

1. Copy `modules/<name>/reference/` into `client/src/vendor/<name>/`.
2. Add the module to the dropdown registry in `client/src/App.tsx`.
3. Add a validation panel that calls the real API and displays its output.

## Running it

This is a standard Muse TypeScript Space (`space.json`). Import the
`demos/module-verifier/` directory as a Space to run it.
