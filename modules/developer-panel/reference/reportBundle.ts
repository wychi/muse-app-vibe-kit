// Assembles the report debug bundle. Framework-free.
//
// The module proactively provides: schema version, timestamps, client
// snapshot, device label, its own flow diagnostics, and captured network
// requests. The integrator provides: description-adjacent metadata (view,
// app version), the annotated screenshot, and analytics events via wiring.

import { collectClientInfo, getDiagnostics, getNetworkRequests } from "./diagnostics";
import { getDeviceLabel } from "./deviceIdentity";
import type { AnalyticsEvent, DiagnosticLine, NetworkRequestLine } from "./types";
import type { ClientInfo } from "./diagnostics";

/** Version of the bundle schema. Bump when fields change incompatibly. */
export const REPORT_BUNDLE_SCHEMA_VERSION = 1;

export interface ScreenshotMeasurementSummary {
  outputWidth: number | null;
  outputHeight: number | null;
  scale: number | null;
}

export interface ReportBundleInput {
  view: string;
  appVersion: string;
  events: AnalyticsEvent[];
  screenshot?: ScreenshotMeasurementSummary;
}

export interface ReportBundle {
  schema_version: number;
  captured_at: string;
  app_version: string;
  view: string;
  url: string;
  client: ClientInfo;
  device_label: string;
  events: AnalyticsEvent[];
  diagnostics: DiagnosticLine[];
  network_requests: NetworkRequestLine[];
  screenshot: ScreenshotMeasurementSummary | null;
}

export function assembleReportBundle(input: ReportBundleInput): ReportBundle {
  const client = collectClientInfo();
  return {
    schema_version: REPORT_BUNDLE_SCHEMA_VERSION,
    captured_at: new Date().toISOString(),
    app_version: input.appVersion,
    view: input.view,
    url: client.url,
    client,
    device_label: getDeviceLabel(),
    events: input.events,
    diagnostics: getDiagnostics(),
    network_requests: getNetworkRequests(),
    screenshot: input.screenshot ?? null,
  };
}
