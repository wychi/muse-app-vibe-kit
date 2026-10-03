/** @muse-app-vibe-kit/developer-panel — floating DEV panel with bug-report flow. */

export { DeveloperPanel, DEV_PANEL_SPEC_VERSION } from "./DeveloperPanel";
export type {
  AnalyticsEvent,
  CategoryOption,
  ChangeRequestPayload,
  ChangeRequestResult,
  DeveloperPanelProps,
  DiagnosticLevel,
  DevPanelWiring,
  InstrumentationOptions,
} from "./types";
export {
  assembleReportBundle,
  REPORT_BUNDLE_SCHEMA_VERSION,
  type ReportBundle,
  type ReportBundleInput,
  type ScreenshotMeasurementSummary,
} from "./reportBundle";
export {
  collectClientInfo,
  getDiagnostics,
  getNetworkRequests,
  installConsoleCapture,
  installErrorCapture,
  installNetworkCapture,
  readableValue,
  recordDiagnostic,
  type ClientInfo,
} from "./diagnostics";
export {
  generateDeviceCode,
  getDeviceId,
  getDeviceLabel,
  getDeviceName,
  getDeviceShortId,
  inferDeviceModel,
  inferDeviceModelFrom,
  type ScreenDims,
} from "./deviceIdentity";
export type { DiagnosticLine, NetworkRequestLine } from "./types";

import type { DeveloperPanelProps } from "./types";
import type { Root } from "react-dom/client";

/**
 * Mount the panel into a plain DOM container — no React needed at the call
 * site. ReactDOM is loaded lazily so importing this package's core utilities
 * never requires react-dom.
 */
export function mount(container: HTMLElement, props: DeveloperPanelProps): () => void {
  let root: Root | null = null;
  let cancelled = false;
  (async () => {
    const [{ createRoot }, { DeveloperPanel }] = await Promise.all([
      import("react-dom/client"),
      import("./DeveloperPanel"),
    ]);
    if (cancelled) return;
    const { createElement } = await import("react");
    root = createRoot(container);
    root.render(createElement(DeveloperPanel, props));
  })().catch((error) => {
    console.error("[developer-panel] mount failed:", error);
  });
  return () => {
    cancelled = true;
    root?.unmount();
  };
}
