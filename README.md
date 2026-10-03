# muse-app-vibe-kit

An agent-friendly library of production-hardened web modules.
**A module = a recipe + a reference implementation.**

- **Drop in** the reference implementation and ship today, or
- **follow the recipe** (`RECIPE.md` in each module) to rebuild it in your own stack —
  decisions, failure modes, and platform quirks included, so neither you nor your agent
  has to re-learn them the hard way.

## Modules

| Module | npm | Status |
|---|---|---|
| [full-page-screenshot](modules/full-page-screenshot/) | `@muse-app-vibe-kit/screenshot` | ✅ ready — first public module |
| [image-annotate](modules/image-annotate/) | `@muse-app-vibe-kit/image-annotate` | ✅ ready — freehand image markup, framework-free |
| video-annotate | — | 📋 planned — video annotation UX, design TBD |
| change-request-reporter | — | staging (internal use) |
| dev-panel | — | design draft |

## Layout per module

```
modules/<name>/
  module.yaml   # machine-readable metadata (for agents)
  RECIPE.md     # problem → decisions → failure modes → platform quirks → verification
  SPEC.md       # versioned rules
  reference/    # the npm package source
  example/      # minimal drop-in example
```

## License

MIT
