# muse-app-vibe-kit

An agent-friendly library of production-hardened web modules.
**A module = a recipe + a reference implementation.**

- **Drop in** the reference implementation and ship today, or
- **follow the recipe** (`RECIPE.md` in each module) to rebuild it in your own stack —
  decisions, failure modes, and platform quirks included, so neither you nor your agent
  has to re-learn them the hard way.

## Why

Every AI agent rebuilding the same utilities burns thousands of tokens rediscovering
the same quirks — the iOS webview that silently breaks screenshot capture, the touch
handler that drops strokes, the edge case that only shows up on a real phone.

This kit exists so that discovery cost is paid **once**, not by everyone. Every
module is extracted from a real production Muse app and battle-tested on real
devices — then distilled into a **recipe** plus a **reference implementation**,
so you save tokens, skip the debugging, and ship faster.

A code dump alone doesn't save tokens; documented failure modes and platform quirks
do. That's the whole idea — many hands make light work: pool everyone's hard-won
lessons, so nobody pays for them twice.

And with AI, building an app is like cooking: everyone follows recipes, but everyone
has different tastes, so everyone tweaks the recipe. That's why this kit ships
recipes, not a framework — the recipe gets you past the hard parts someone already
figured out, and leaves room for your own flavor.

Think of your app as a banquet: some dishes you cook yourself, others you bring in
ready-made — so the whole feast comes together faster and more complete.
Vibe-coding is cooking from scratch; dropping in a library is serving a quality
prepared dish. Both are great, it just depends on the situation — so every module
ships both: the recipe for when you want to cook, and a reference implementation
for when you want it ready-made.

## Modules

| Module | npm | Status |
|---|---|---|
| [full-page-screenshot](modules/full-page-screenshot/) | `@muse-app-vibe-kit/screenshot` | ✅ ready — first public module |
| [annotate-image](modules/annotate-image/) | `@muse-app-vibe-kit/annotate-image` | ✅ ready — freehand image markup, framework-free |
| annotate-video | — | 📋 planned — video annotation UX, design TBD |
| annotate-pdf | — | 📋 planned — PDF review markup |
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
