# SPEC — @muse-app-vibe-kit/developer-panel v1.1.0

Implements shared developer-panel spec **1.3.0** (`DEV_PANEL_SPEC_VERSION`).
Kit addition: `DevPanelWiring.getEvents()` (the panel assembles the report
bundle itself and needs read access to the app's analytics events).

## Exports

```ts
// React UI
export function DeveloperPanel(props: DeveloperPanelProps): JSX.Element;
export function mount(container: HTMLElement, props: DeveloperPanelProps): () => void;
// Framework-free core
export interface DevPanelWiring { trackEvent; recordDiagnostic; getEvents; submitReport; }
export function installConsoleCapture(levels?): () => void;
export function installNetworkCapture(): () => void;
export function installErrorCapture(): () => void;
export function collectClientInfo(): ClientInfo;
export function assembleReportBundle(input: ReportBundleInput): ReportBundle;
export function recordDiagnostic(level, values: unknown[]): void;
export function getDiagnostics(): DiagnosticLine[];
export function getNetworkRequests(): NetworkRequestLine[];
export function getDeviceLabel(): string; // + getDeviceName/getDeviceId/getDeviceShortId
export const DEV_PANEL_SPEC_VERSION = "1.3.0";
export const REPORT_BUNDLE_SCHEMA_VERSION = 1;
```

## `<DeveloperPanel>` props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `wiring` | `DevPanelWiring` | yes | The app's analytics/logger/report backend |
| `viewLabel` | `string` | recommended | Stable per-screen name, e.g. `"workout_session"`. Empty → dev-mode `console.warn`, bundle submits with blank route |
| `appVersion` | `string` | yes | Real build number; never hard-code |
| `instrumentation` | `{ console?; network?; errors? }` | no | Opt-in capture of the app's own output. Default: all off |
| `categories` | `CategoryOption[]` | no | Default English set (`broken`, `hard-to-use`, `suggestion`, `question`, `other`); override value+label |
| `say` | `(msg: string) => void` | no | Toast speaker; default is a minimal inline toast |
| `className` | `string` | no | Extra class on the panel anchor |

## Report flow (order is part of the spec)

1. Tap `Report issue` → panel collapses → the current page/view ID is
   recorded first and **shown** in the flow (never typed by hand).
2. Describe step appears immediately: page/view ID line + optional
   single-select category (re-tap deselects; unselected submittable) +
   textarea (placeholder "What should change? Describe it…") + an
   **"Add screenshot"** secondary button + `Submit` (disabled while the
   description is blank).
3. Tap "Add screenshot" (only when needed) → full-page screenshot →
   annotation overlay (skip allowed) → annotated thumbnail lands back in
   the describe step (button becomes "Retake screenshot").
4. Submit → report-ID card with the returned short ID. Submitting works
   with or without a screenshot.

The standalone `Screenshot` button (panel home) copies the full-page
screenshot to the clipboard; when the clipboard can't take images, shows
an explanatory message instead. It is separate from the in-flow optional
screenshot above.

## Events emitted (via `wiring.trackEvent`)

- `report_annotation_completed` — `{ strokes: number, skipped: boolean }`
  (fires only when a screenshot is taken)
- `report_category_selected` — `{ category: string }`
- `report_submitted` — `{ report_id: string | null, view: string }`

Diagnostics (module's own flow, always recorded; failures carry `error_kind`):
report started (with page/view ID); screenshot started / succeeded / failed;
change-request failed (description preserved for retry).

## Report bundle schema (v1)

```jsonc
{
  "schema_version": 1,
  "captured_at": "ISO",
  "app_version": "string",
  "view": "string",
  "url": "full location.href",
  "client": {
    "userAgent": "raw",
    "browser": { "name": "Chrome", "version": "131.0" },
    "os": { "name": "iOS", "version": "18.1" },
    "viewport": { "width": 390, "height": 844 },
    "devicePixelRatio": 3,
    "screen": { "width": 390, "height": 844 },
    "deviceMemoryGB": 4,            // null when unavailable
    "hardwareConcurrency": 6,       // null when unavailable
    "connection": "4g",             // null when unavailable
    "timezone": "America/Los_Angeles",
    "locale": "en-US",
    "timeSinceNavigationMs": 12345, // null when unavailable
    "navigationTimingMs": { "domContentLoaded": 800, "load": 1200 }
  },
  "device_label": "AB12CD · iPhone 16",
  "events": [ { "name": "...", "at": "ISO", "props": {} } ],
  "diagnostics": [ { "level": "info|warning|error", "at": "ISO", "message": "..." } ],
  "network_requests": [ { "method": "POST", "url": "...", "status": 200, "ok": true, "durationMs": 231, "at": "ISO" } ],
  "screenshot": { "outputWidth": 780, "outputHeight": 1688, "scale": 2 }  // null when no screenshot was taken
}
```

Errors in `diagnostics[].message` include the stack trace (capped at 12
lines). Network entries never contain bodies. Nulls are recorded honestly
when an API is unavailable.

## CSS

Import `@muse-app-vibe-kit/developer-panel/styles.css` once. Theme variables
(`--border`, `--text`, `--surface`, `--surface-2`, `--dim`, `--accent`,
`--lime`) are scoped to `.dev-panel-anchor` with defaults; override on any
ancestor to re-theme. Includes the annotation overlay styles (vendored from
`@muse-app-vibe-kit/annotate-image@1.1.0`).

## Integration checklist (all optional — the module runs without them)

Providing these makes the debug bundle dramatically clearer; the module never
blocks on them:

1. Pass a stable `viewLabel` per screen (English snake_case).
2. `trackEvent` on key interactions (buttons, navigation) — English
   snake_case, minimal props.
3. Emit a `xxx_displayed` event per screen so the event trail reconstructs
   the user's path.
4. `recordDiagnostic` on key lifecycle moments (started/succeeded/failed
   with `error_kind`).
5. Pass the real build number as `appVersion`.
