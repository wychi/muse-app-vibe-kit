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

| Module | npm | Live demo | Status |
|---|---|---|---|
| [full-page-screenshot](modules/full-page-screenshot/) | `@muse-app-vibe-kit/full-page-screenshot` | [demo](https://wychi.github.io/muse-app-vibe-kit/screenshot/) | ✅ ready |
| [select-region](modules/select-region/) | `@muse-app-vibe-kit/select-region` | [demo](https://wychi.github.io/muse-app-vibe-kit/select-region/) | ✅ ready |
| [annotate-image](modules/annotate-image/) | `@muse-app-vibe-kit/annotate-image` | [demo](https://wychi.github.io/muse-app-vibe-kit/annotate/) | ✅ ready |
| annotate-video | — | — | 📋 planned — video annotation UX, design TBD |
| annotate-pdf | — | — | 📋 planned — PDF review markup |
| change-request-reporter | — | — | staging (internal use) |
| dev-panel | — | — | design draft |

## Roadmap

- **developer-panel → spec 1.3.0**（2026-10-06 記入）：回報流程截圖改可選（開回報先記當前頁面 ID，描述先出現、截圖按鈕按需）。`module.yaml` 的 `spec_version`、`SPEC.md`、`RECIPE.md`、reference 實作待跟進。
- **vanilla-JS 預建 bundle**（2026-10-06 記入）：讓非 React 的 app 也能直接引用 kit 模塊（預建 JS＋全域變數，demo 頁已是這種用法）。從 developer-panel 開始試點。待設計。

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
