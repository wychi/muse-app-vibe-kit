# @muse-app-vibe-kit/developer-panel

Floating DEV panel for web apps: one-tap bug reports with an industry-standard
debug bundle. Describe first, screenshot optional (capture → annotate on
demand), plus a one-tap full-page screenshot-to-clipboard button.

Implements the shared developer-panel spec v1.3.0. The React UI is a port of
the battle-tested panel from Workout Timer / GymQuest; the diagnostics core is
framework-free.

![Developer panel](https://raw.githubusercontent.com/wychi/muse-app-vibe-kit/main/modules/developer-panel/demo/screenshots/readme.png)

[Live demo](https://wychi.github.io/muse-app-vibe-kit/dev-panel/)

## Install

```bash
npm install @muse-app-vibe-kit/developer-panel
```

`react >= 18` and `react-dom >= 18` are peer dependencies. Import the
stylesheet once:

```ts
import "@muse-app-vibe-kit/developer-panel/styles.css";
```

## React usage

```tsx
import { DeveloperPanel } from "@muse-app-vibe-kit/developer-panel";

const wiring = {
  trackEvent: (name, props) => myAnalytics.track(name, props),
  recordDiagnostic: (level, message) => myLogger.log(level, ...message),
  getEvents: () => myAnalytics.getEvents(),
  submitReport: async (payload) => {
    const res = await api.submitChangeRequest(payload);
    return { short_id: res.short_id };
  },
};

<DeveloperPanel
  wiring={wiring}
  viewLabel="workout_session"   // stable per-screen name (recommended, optional)
  appVersion="1.4.2 (build 318)"
  instrumentation={{ console: true, network: true, errors: true }} // all opt-in, default off
/>;
```

## Non-React usage

```ts
import { mount } from "@muse-app-vibe-kit/developer-panel";

const unmount = mount(document.getElementById("dev-root"), { wiring, viewLabel, appVersion });
```

## Framework-free core

The diagnostics core has no React dependency — useful even without the panel:

```ts
import {
  installConsoleCapture, installNetworkCapture, installErrorCapture,
  collectClientInfo, assembleReportBundle, getDeviceLabel,
} from "@muse-app-vibe-kit/developer-panel";

const uninstallConsole = installConsoleCapture(); // explicit opt-in
const info = collectClientInfo();                 // snapshot, no side effects
```

## What the report bundle contains

`screenshot` (annotated PNG) plus a JSON debug bundle: schema version,
timestamps, app version, route, full URL, parsed client info (browser/OS,
viewport, DPR, screen, memory, cores, connection, timezone, locale,
navigation timing), device label, analytics events, diagnostics (with stack
traces), and captured network requests (method/URL/status/duration — bodies
are never recorded).

## Privacy

The module never records request/response bodies. Whether a URL or event
payload is sensitive is the integrator's decision — the module provides the
plumbing, the app decides what flows through it.

## License

MIT
