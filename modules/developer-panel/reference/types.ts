/** Shared types for @muse-app-vibe-kit/developer-panel. Framework-free. */

export type DiagnosticLevel = "info" | "warning" | "error";

export interface DiagnosticLine {
  level: DiagnosticLevel;
  /** ISO timestamp of when the line was recorded. */
  at: string;
  /** Human-readable message. Errors include the stack trace (see diagnostics.ts). */
  message: string;
}

/** One captured network request. Bodies are never recorded. */
export interface NetworkRequestLine {
  method: string;
  url: string;
  /** HTTP status, or null when the request failed before a response. */
  status: number | null;
  ok: boolean;
  durationMs: number;
  at: string;
  /** Machine-readable failure kind when ok === false. */
  errorKind?: string;
}

export interface AnalyticsEvent {
  name: string;
  at: string;
  props?: Record<string, unknown>;
}

/**
 * The three seams the host app wires up (shared spec 1.2.0), plus `getEvents`.
 *
 * `getEvents` is a kit addition beyond the shared spec: the panel assembles the
 * report bundle itself, so it needs read access to the app's analytics events.
 * The interface owns no data — every method delegates to the app's existing
 * analytics / logger / report backend.
 */
export interface DevPanelWiring {
  trackEvent(name: string, props?: Record<string, unknown>): void;
  recordDiagnostic(level: DiagnosticLevel, message: unknown[]): void;
  /** Return the app's recorded analytics events (for the report bundle). */
  getEvents(): AnalyticsEvent[];
  submitReport(payload: ChangeRequestPayload): Promise<ChangeRequestResult>;
}

export interface ChangeRequestPayload {
  description: string;
  /** Optional category value (see `categories` prop). Omitted when unselected. */
  category?: string;
  route: string;
  app_version: string;
  /** Annotated PNG as base64 (no `data:` prefix). */
  data_base64: string;
  /** JSON string produced by assembleReportBundle(). */
  debug_bundle: string;
}

export interface ChangeRequestResult {
  short_id?: string | null;
}

export interface CategoryOption {
  value: string;
  label: string;
}

/**
 * Opt-in capture of the app's own logging. The integrator decides what to log;
 * the module only provides the plumbing. Everything defaults to off.
 */
export interface InstrumentationOptions {
  /** Patch console.log/info/warn/error/debug into the diagnostics buffer. */
  console?: boolean;
  /** Patch window.fetch into the network-request buffer (no bodies, ever). */
  network?: boolean;
  /** Capture window error / unhandledrejection events (with stack traces). */
  errors?: boolean;
}

export interface DeveloperPanelProps {
  wiring: DevPanelWiring;
  /** Stable per-screen name, e.g. "workout_session". Shown in the report bundle as route. */
  viewLabel: string;
  /** Real build number of the host app. Never hard-code. */
  appVersion: string;
  /** Opt-in capture of the app's console/network/error output. Default: all off. */
  instrumentation?: InstrumentationOptions;
  /** Category radio options. Default: English set; override for other languages. */
  categories?: CategoryOption[];
  /** Toast speaker. Default: a minimal inline toast. */
  say?: (message: string) => void;
  /** Extra class name on the panel anchor. */
  className?: string;
}

/** Which version of the shared developer-panel spec this implements. */
export const DEV_PANEL_SPEC_VERSION = "1.2.0";
