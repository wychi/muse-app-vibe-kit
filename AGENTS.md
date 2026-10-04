# AGENTS.md — muse-app-vibe-kit

Open-source library of small, agent-friendly web modules.
**A module = a recipe + a reference implementation.**

## Module anatomy

Every module lives in `modules/<name>/` and is self-contained:

```
modules/<name>/
  module.yaml      # machine-readable metadata (see below)
  RECIPE.md        # Problem → Decisions → Failure modes → Platform quirks → Spec → Verification → Anti-goals
  SPEC.md          # exact API contract the reference implements
  reference/       # the shippable npm package (what gets published)
  example/         # integration guide for developers (snippets, README)
  demo/            # runnable demo source (HTML + assets) — never build output
```

- `reference/` is the source of truth for behavior. Drop it in and it works (out-of-box).
- `example/` teaches wiring ("how do I integrate this?"). Keep it light — snippets, not a second demo site.
- `demo/` is the try-it-now experience ("what does it feel like?"). It consumes
  `reference/` the way a third party would.

## module.yaml

```yaml
name: annotate-image
display_name: Annotate Image
spec_version: "1.0.0"
npm: "@muse-app-vibe-kit/annotate-image"
version: 1.0.0
maturity: stable        # planned | staging | stable
provides: [image-annotation]
depends_on: []
recipe: RECIPE.md
reference: reference/
example: example/
demo:
  path: annotate       # deployed at /<path>/
  bundle:
    file: annotate-image.js
    global: AnnotateImage
license: MIT
```

## Site / GitHub Pages

There is **no `site/` directory**. The Pages site is assembled at deploy time by
`.github/workflows/build-site.mjs`, which for every module with a `demo:` block:

1. bundles `reference/index.ts` → `_site/<demo.path>/<bundle.file>` (esbuild IIFE),
2. copies `reference/styles.css` alongside (if present),
3. copies `demo/*` (never build output — `README.md` is excluded),
4. generates `_site/index.html`, the collection landing page, from `module.yaml` metadata.

Never check in build output. If the demo needs something the bundle doesn't
expose, that's a signal to improve the module — not to reach into internals.

## README screenshots

Each module's `reference/README.md` (the npm package page) embeds one screenshot:

```
modules/<name>/demo/screenshots/readme.png
```

referenced via an absolute `raw.githubusercontent.com` URL so it renders on
npmjs.com. `demo/screenshots/` is excluded from the Pages site build.

After each release, refresh the screenshot by hand: re-run the demo E2E
(`node .github/workflows/run-demo-e2e.mjs`), pick a representative shot from
`e2e-shots/<name>/`, overwrite `readme.png`, and ship it in a PR. Never
auto-sync — documentation screenshots are curated, not generated.

## Repo workflow

- **Never push to `main`.** Every change: feature branch → push → pull request → user reviews and merges.
- `main` is branch-protected (PR required, no bypass, no force push).
- Squash-merge PRs. Write good PR titles — they become the commit message (`Default message` = title + PR number).

## Naming

- npm scope: `@muse-app-vibe-kit/<module>`.
- Annotation family groups by prefix: `annotate-image`, `annotate-video`, `annotate-pdf` (verb + media).
