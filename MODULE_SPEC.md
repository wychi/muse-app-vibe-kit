# Module Spec

Every module lives in `modules/<name>/` and MUST follow this structure.
CI validates it on every PR (`check-module-structure.mjs`).

```
modules/<name>/
  module.yaml       # REQUIRED: machine-readable metadata
  RECIPE.md         # REQUIRED: Problem → Decisions → Failure modes →
                    #           Platform quirks → Spec → Verification → Anti-goals
  SPEC.md           # REQUIRED: versioned API contract
  reference/        # REQUIRED: the shippable npm package
    package.json    # REQUIRED: name MUST be @muse-app-vibe-kit/<name>
    index.ts        # REQUIRED: main entry point
    styles.css      # OPTIONAL: if present, demo/index.html MUST <link> it
    README.md       # REQUIRED: package documentation
    LICENSE         # REQUIRED: MIT
    CHANGELOG.md    # REQUIRED: version history
  example/          # REQUIRED: integration guide
    README.md       # REQUIRED: minimal drop-in example
  demo/             # REQUIRED: live demo page source (deployed to GitHub Pages)
    index.html      # REQUIRED: MUST use <script src> for the IIFE bundle,
                    #           never ES `import` (build outputs IIFE, not ESM)
    e2e.mjs         # REQUIRED: E2E test — exports { path, steps, assert }
```

## `module.yaml` required fields

`name`, `display_name`, `npm`, `version`, `demo.path`, `demo.bundle.file`, `demo.bundle.global`

## `reference/package.json` rules

- `name`: `@muse-app-vibe-kit/<name>` — MUST match the directory name
- `exports["."]`: `./index.ts` — source is at `reference/` root, there is no `src/`
- `files`: MUST list only files that exist
- `repository.url`: `https://github.com/wychi/muse-app-vibe-kit.git`

## `demo/e2e.mjs` contract

```js
export default {
  path: "/<demo-path>/",       // must match module.yaml demo.path
  steps: async (page, shot) => {
    // Playwright actions...
    // await shot("name") captures a screenshot
  },
  assert: async (page) => {
    // Throw on failure. No return value needed.
  },
};
```

## Naming

- npm scope: `@muse-app-vibe-kit/<module>`
- Annotation family groups by prefix: `annotate-image`, `annotate-video`, `annotate-pdf`
