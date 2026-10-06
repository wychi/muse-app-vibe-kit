# Changelog

## 1.1.0 (2026-10-06)

- Implements shared developer-panel spec 1.3.0 (`DEV_PANEL_SPEC_VERSION`).
- Report flow reworked: screenshot is now optional. Tapping Report issue
  records the current page/view ID first and opens the describe step
  immediately; a secondary "Add screenshot" button captures on demand
  (capture → annotate → thumbnail back in the describe step). Submitting
  works with or without a screenshot.
- `ChangeRequestPayload.data_base64` is now optional; the debug bundle's
  `screenshot` measurement is `null` when no screenshot was taken.
- `DevPanelWiring` shape unchanged.

- Initial release. Implements shared developer-panel spec 1.2.0.
- `<DeveloperPanel>`: floating DEV trigger, report flow (screenshot → annotate → describe → submit), one-tap full-page screenshot to clipboard.
- Framework-free core: `DevPanelWiring` seam, device identity, diagnostics buffer, opt-in console/network/error capture, industry-standard report bundle (stack traces, network log, parsed client info).
- Annotation step reuses `@muse-app-vibe-kit/annotate-image`; capture reuses `@muse-app-vibe-kit/full-page-screenshot`.
