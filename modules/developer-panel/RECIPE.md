# Recipe: developer-panel

## Problem

Every app needs a way for testers and users to report bugs with enough
context to act on. Without a shared module, each app hand-rolls its own
"feedback" button: screenshots taken manually, descriptions without logs, no
device identification, and every implementation drifts. Debugging becomes a
chat thread of "can you send a screenshot?" followed by "which version? which
phone? what did you tap before it broke?".

Who/when/what breaks: a tester hits a bug on their phone, taps the report
button (if one exists), and the developer receives a one-line description
with no reproduction context.

## Decisions

**D1 — Port the battle-tested panel, don't rewrite it.** The reference is the
DEV panel from Workout Timer / GymQuest (three apps, real users). Rewriting
the four-step flow in vanilla DOM would discard that verification. The kit's
first React module is the honest shape of this reference.

**D2 — UI is React; the diagnostics core is framework-free.** Inventory:
UI = trigger button, panel card, four-step flow (annotate canvas, describe
page, report-ID card). Non-UI = DevPanelWiring seam, device identity,
diagnostics buffer, bundle assembly, flow state machine. The core is exported
for use without the panel.

**D3 — Compose, don't fork.** Screenshot capture reuses
`@muse-app-vibe-kit/full-page-screenshot`; the annotation step reuses
`@muse-app-vibe-kit/annotate-image` (`openAnnotator`). The panel is thin
wiring. The annotator's CSS is vendored into this module's `styles.css`
(with source + version noted) because CSS doesn't travel with a bundled JS
dependency.

**D4 — html2canvas is a bundled dependency, not injected.** The sibling
screenshot module injects the renderer; the panel declares it as a
dependency so "drop in and it works" — and so the demo/E2E never depend on
CDN availability.

**D5 — The module provides plumbing; the integrator decides what to log.**
Console / network / error capture are explicit opt-in
(`installConsoleCapture()` etc., each returning `uninstall()`), all default
off. The panel's own flow diagnostics (screenshot/report lifecycle) are
always recorded — that's the module speaking about itself. Privacy: bodies
are never recorded; whether a URL is sensitive is the integrator's call.

**D6 — Proactive bundle contents.** At submit time the module always
collects: parsed browser/OS, viewport, DPR, screen, deviceMemory,
hardwareConcurrency, connection type, timezone, locale, full URL, navigation
timing, screenshot measurement, bundle schema version. No integrator input
needed.

**D7 — Categories default to English, overridable.** The shared spec lists
Chinese labels; the kit is English-first, so the default set is English and
the `categories` prop overrides both value and label.

**D8 — `DevPanelWiring` gains `getEvents()`.** The shared spec (1.2.0)
defines three seams; the panel assembles the bundle itself, so it needs read
access to the app's analytics events. Documented as a kit addition.

## Failure modes

1. Screenshot capture fails (html2canvas throws, tainted canvas, oversized
   page) → return to panel + toast + diagnostic with `error_kind`; never
   stuck in `capturing`.
2. Double-tap "Report issue" → synchronous single-flight guard; one flow at
   a time.
3. Annotation skipped → flow continues; event records `skipped: true`.
4. Submit fails (network) → description preserved, stage returns to
   `describing` for retry; diagnostic with `error_kind`.
5. Clipboard API unavailable → explicit message, diagnostic; no silent
   failure.
6. Diagnostics buffer unbounded → 100-line ring buffer; network 20.
7. Instrumentation installed twice → module-level guard flags; `uninstall()`
   restores originals.
8. Network patch must never change fetch semantics → try/finally, errors
   re-thrown identically, bodies never touched.
9. `viewLabel` missing → dev-mode `console.warn` nudge (optional ask, not a
   hard requirement); bundle still submits with a blank route.
10. React version mismatch → `react >= 18` peer range.

## Platform quirks

- Host CSS leaks: element selectors in the host app (e.g. `header { color }`)
  beat inherited styles inside the panel. Every text element in the panel's
  stylesheet therefore carries an explicit color — never rely on inheritance
  for text color in embeddable UI.
- iOS Safari: `navigator.clipboard` image write may be unavailable → the
  Screenshot button degrades to an explanatory message (same as reference).
- iPhone model cannot be read from the web; `inferDeviceModel` only names a
  model on unambiguous screen+DPR combos, else falls back (never guesses).
- `deviceMemory` / `connection.effectiveType` are Chromium-only → `null`
  elsewhere; the bundle records nulls honestly.
- html2canvas vs. cross-origin images: tainted canvases fail at export;
  the failure path (mode 1) covers it.

## Spec

See `SPEC.md`. Implements shared developer-panel spec 1.2.0
(`DEV_PANEL_SPEC_VERSION`), plus the kit's `getEvents()` wiring addition.

## Verification

`demo/e2e.mjs` drives the full flow against the live demo with a mock
wiring: open panel → Report issue → screenshot captured → draw annotation
stroke → pick category → type description → submit → report-ID card shown.
Assertions: stage transitions, recorded analytics events
(`report_annotation_completed`, `report_category_selected`,
`report_submitted`), and the submitted bundle's schema fields. Showcase
screenshots retained per module.

## Anti-goals

- Not a crash reporter (no background upload, no native crashes).
- No user identity: device code only, never accounts or PII.
- No session replay, no request/response bodies.
- The module never decides what the app logs; it only provides the capture
  plumbing.
- Shared code gains features; the `DevPanelWiring` shape never breaks
  without a major version.
