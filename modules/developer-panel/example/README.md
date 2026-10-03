# Example: integrating @muse-app-vibe-kit/developer-panel

Minimal drop-in for a React app. The panel is thin wiring — your app keeps
its own analytics, logger, and report backend.

```tsx
import { DeveloperPanel } from "@muse-app-vibe-kit/developer-panel";
import "@muse-app-vibe-kit/developer-panel/styles.css";

// 1. Implement the three seams (+ getEvents) against your existing systems.
const wiring = {
  trackEvent: (name, props) => analytics.track(name, { ...props, view: currentView }),
  recordDiagnostic: (level, message) => logger.log(level, ...message),
  getEvents: () => analytics.getEvents(), // recorded via your trackEvent
  submitReport: async (payload) => {
    // payload: { description, category?, route, app_version, data_base64, debug_bundle }
    const res = await api.reports.create(payload);
    return { short_id: res.short_id };
  },
};

// 2. Mount once, near the app root. viewLabel changes per screen.
function App() {
  return (
    <>
      <Router />
      <DeveloperPanel
        wiring={wiring}
        viewLabel={currentView}          // e.g. "workout_session"
        appVersion={BUILD_VERSION}       // real build number
        instrumentation={{ console: true, network: true, errors: true }}
      />
    </>
  );
}
```

## What to log is your decision

The `instrumentation` prop only provides the plumbing. Recommended starting
point: turn all three on in internal/beta builds; in production, keep `errors`
on and decide about `console`/`network` based on volume. Bodies are never
recorded; if your URLs carry tokens, proxy or scrub them in your own
`trackEvent` before they reach the bundle.

## Making the bundle clearer (optional)

- Stable `viewLabel` per screen (English snake_case, never blank).
- `trackEvent` on key taps and navigation; a `xxx_displayed` event per
  screen so the trail reconstructs the user's path.
- `recordDiagnostic("info"/"error", …)` on key lifecycle moments; failures
  carry an `error_kind`.

See `../SPEC.md` for the full bundle schema.
