# Changelog

## 1.0.0 (2026-10-03)

- Initial release. Implements shared developer-panel spec 1.2.0.
- `<DeveloperPanel>`: floating DEV trigger, report flow (screenshot → annotate → describe → submit), one-tap full-page screenshot to clipboard.
- Framework-free core: `DevPanelWiring` seam, device identity, diagnostics buffer, opt-in console/network/error capture, industry-standard report bundle (stack traces, network log, parsed client info).
- Annotation step reuses `@muse-app-vibe-kit/annotate-image`; capture reuses `@muse-app-vibe-kit/full-page-screenshot`.
