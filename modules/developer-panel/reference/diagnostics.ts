// Framework-free diagnostics core for @muse-app-vibe-kit/developer-panel.
//
// Two halves:
//   1. What the module proactively provides: a diagnostics ring buffer, the
//      module's own flow logs, and collectClientInfo() — a snapshot of parsed
//      browser/OS, viewport, hardware, connection, locale, URL and navigation
//      timing, taken at report time. No integrator decision needed.
//   2. Opt-in plumbing: installConsoleCapture(), installNetworkCapture(),
//      installErrorCapture(). WHAT to log is the integrator's decision; the
//      module only provides the interface. All default to off.
//
// Privacy contract: request/response bodies are never recorded. Whether a URL
// is sensitive is the integrator's call — the module does not redact.

import type { DiagnosticLevel, DiagnosticLine, NetworkRequestLine } from "./types";

export const MAX_DIAGNOSTICS = 100;
export const MAX_NETWORK_REQUESTS = 20;
const MAX_MESSAGE_LENGTH = 1200;
const MAX_STACK_LINES = 12;

const diagnostics: DiagnosticLine[] = [];
const networkRequests: NetworkRequestLine[] = [];

function isChromiumSystemDiagnostic(message: string): boolean {
  return /gl_context|XNNPACK|TensorFlow Lite/i.test(message)
    || /^[IW]\d{4}\s+\d{2}:\d{2}:/.test(message);
}

/** Error → "name: message" plus the stack trace (capped). Everything else → JSON/string. */
export function readableValue(value: unknown): string {
  if (value instanceof Error) {
    const head = `${value.name}: ${value.message}`;
    if (typeof value.stack === "string" && value.stack) {
      const lines = value.stack.split("\n").slice(0, MAX_STACK_LINES).join("\n");
      return `${head}\n${lines}`.slice(0, MAX_MESSAGE_LENGTH);
    }
    return head;
  }
  if (typeof value === "string") return value.slice(0, MAX_MESSAGE_LENGTH);
  try {
    return JSON.stringify(value).slice(0, MAX_MESSAGE_LENGTH);
  } catch {
    return String(value).slice(0, MAX_MESSAGE_LENGTH);
  }
}

/** Record a line into the module's diagnostics buffer. Never throws. */
export function recordDiagnostic(level: DiagnosticLevel, values: unknown[]): void {
  try {
    const message = values.map(readableValue).join(" ");
    if (isChromiumSystemDiagnostic(message)) return;
    diagnostics.push({ level, at: new Date().toISOString(), message });
    if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.splice(0, diagnostics.length - MAX_DIAGNOSTICS);
  } catch {
    // Diagnostics must never break the app.
  }
}

/** Snapshot of the current diagnostics buffer (copy). */
export function getDiagnostics(): DiagnosticLine[] {
  return diagnostics.slice();
}

/** Snapshot of the captured network requests (copy). */
export function getNetworkRequests(): NetworkRequestLine[] {
  return networkRequests.slice();
}

function recordNetworkRequest(entry: NetworkRequestLine): void {
  networkRequests.push(entry);
  if (networkRequests.length > MAX_NETWORK_REQUESTS) {
    networkRequests.splice(0, networkRequests.length - MAX_NETWORK_REQUESTS);
  }
}

type Uninstall = () => void;

declare global {
  interface Window {
    __vibeKitDiagnosticsInstalled?: { console?: boolean; network?: boolean; errors?: boolean };
  }
}

function installState(): { console?: boolean; network?: boolean; errors?: boolean } {
  if (typeof window === "undefined") return {};
  window.__vibeKitDiagnosticsInstalled = window.__vibeKitDiagnosticsInstalled ?? {};
  return window.__vibeKitDiagnosticsInstalled;
}

/**
 * Patch console.log/info/warn/error/debug so calls are mirrored into the
 * diagnostics buffer. Original behavior is fully preserved.
 */
export function installConsoleCapture(levels: DiagnosticLevel[] = ["info", "warning", "error"]): Uninstall {
  if (typeof window === "undefined") return () => {};
  const state = installState();
  if (state.console) return () => {};
  state.console = true;

  const levelOf: Record<string, DiagnosticLevel> = {
    log: "info", info: "info", debug: "info",
    warn: "warning", error: "error",
  };
  const originals = new Map<string, (...args: unknown[]) => void>();
  for (const method of ["log", "info", "debug", "warn", "error"] as const) {
    const level = levelOf[method];
    if (!levels.includes(level)) continue;
    const original = console[method].bind(console);
    originals.set(method, original);
    console[method] = (...args: unknown[]) => {
      recordDiagnostic(level, args);
      original(...args);
    };
  }
  return () => {
    for (const [method, original] of originals) {
      (console as unknown as Record<string, unknown>)[method] = original;
    }
    state.console = false;
  };
}

/**
 * Patch window.fetch so requests are recorded as
 * { method, url, status, ok, durationMs }. Bodies are never read or stored.
 * The wrapper never changes fetch semantics: errors propagate identically.
 */
export function installNetworkCapture(): Uninstall {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return () => {};
  const state = installState();
  if (state.network) return () => {};
  state.network = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (typeof input !== "string" && !(input instanceof URL) ? input.method : undefined) ?? "GET").toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const started = Date.now();
    const at = new Date().toISOString();
    try {
      const response = await originalFetch(input, init);
      recordNetworkRequest({
        method, url, status: response.status, ok: response.ok,
        durationMs: Date.now() - started, at,
      });
      return response;
    } catch (error) {
      recordNetworkRequest({
        method, url, status: null, ok: false,
        durationMs: Date.now() - started, at,
        errorKind: error instanceof Error ? error.name : "fetch_failed",
      });
      throw error;
    }
  }) as typeof window.fetch;

  return () => {
    window.fetch = originalFetch;
    state.network = false;
  };
}

/** Capture window "error" and "unhandledrejection" events with stack traces. */
export function installErrorCapture(): Uninstall {
  if (typeof window === "undefined") return () => {};
  const state = installState();
  if (state.errors) return () => {};
  state.errors = true;

  const onError = (event: ErrorEvent) => {
    recordDiagnostic("error", [
      event.message,
      event.filename ? `(${event.filename}:${event.lineno}:${event.colno})` : "",
      event.error instanceof Error ? event.error : "",
    ]);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    recordDiagnostic("error", ["Unhandled promise rejection", event.reason]);
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    state.errors = false;
  };
}

// --- Client snapshot (proactively provided at bundle time) ---

export interface ClientInfo {
  url: string;
  userAgent: string;
  browser: { name: string; version: string | null };
  os: { name: string; version: string | null };
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  screen: { width: number; height: number };
  deviceMemoryGB: number | null;
  hardwareConcurrency: number | null;
  connection: string | null;
  timezone: string | null;
  locale: string | null;
  timeSinceNavigationMs: number | null;
  navigationTimingMs: { domContentLoaded: number | null; load: number | null };
}

function parseBrowser(ua: string): { name: string; version: string | null } {
  const m = (re: RegExp) => { const x = re.exec(ua); return x?.[1] ?? null; };
  if (/Edg\//.test(ua)) return { name: "Edge", version: m(/Edg\/([\d.]+)/) };
  if (/OPR\//.test(ua)) return { name: "Opera", version: m(/OPR\/([\d.]+)/) };
  if (/CriOS\//.test(ua)) return { name: "Chrome iOS", version: m(/CriOS\/([\d.]+)/) };
  if (/FxiOS\//.test(ua)) return { name: "Firefox iOS", version: m(/FxiOS\/([\d.]+)/) };
  if (/Chrome\//.test(ua)) return { name: "Chrome", version: m(/Chrome\/([\d.]+)/) };
  if (/Firefox\//.test(ua)) return { name: "Firefox", version: m(/Firefox\/([\d.]+)/) };
  if (/Version\/([\d.]+).*Safari\//.test(ua)) return { name: "Safari", version: m(/Version\/([\d.]+)/) };
  return { name: "unknown", version: null };
}

function parseOS(ua: string): { name: string; version: string | null } {
  const m = (re: RegExp) => { const x = re.exec(ua); return x?.[1] ?? null; };
  if (/iPhone|iPad|iPod/.test(ua)) {
    const v = m(/OS ([\d_]+)/)?.replace(/_/g, ".") ?? null;
    return { name: /iPad/.test(ua) ? "iPadOS" : "iOS", version: v };
  }
  if (/Android/.test(ua)) return { name: "Android", version: m(/Android ([\d.]+)/) };
  if (/Windows NT/.test(ua)) return { name: "Windows", version: m(/Windows NT ([\d.]+)/) };
  if (/Mac OS X/.test(ua)) {
    return { name: "macOS", version: m(/Mac OS X ([\d_]+)/)?.replace(/_/g, ".") ?? null };
  }
  if (/Linux/.test(ua)) return { name: "Linux", version: null };
  return { name: "unknown", version: null };
}

/**
 * Snapshot of the client environment. Pure function of window/navigator —
 * no side effects, safe to call at report time.
 */
export function collectClientInfo(): ClientInfo {
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  const ua = nav.userAgent ?? "";
  let timeSinceNavigationMs: number | null = null;
  let domContentLoaded: number | null = null;
  let load: number | null = null;
  try {
    const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    const timing = entries[0];
    if (timing) {
      timeSinceNavigationMs = Math.round(performance.now());
      domContentLoaded = Math.round(timing.domContentLoadedEventEnd);
      load = Math.round(timing.loadEventEnd);
    }
  } catch {
    // performance API unavailable — leave nulls.
  }
  const conn = (nav as Navigator & { connection?: { effectiveType?: string } }).connection;
  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    // Intl unavailable.
  }
  return {
    url: typeof location !== "undefined" ? location.href : "",
    userAgent: ua,
    browser: parseBrowser(ua),
    os: parseOS(ua),
    viewport: {
      width: typeof window !== "undefined" ? window.innerWidth : 0,
      height: typeof window !== "undefined" ? window.innerHeight : 0,
    },
    devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    screen: {
      width: typeof window !== "undefined" && window.screen ? window.screen.width : 0,
      height: typeof window !== "undefined" && window.screen ? window.screen.height : 0,
    },
    deviceMemoryGB: typeof (nav as unknown as { deviceMemory?: number }).deviceMemory === "number"
      ? (nav as unknown as { deviceMemory: number }).deviceMemory : null,
    hardwareConcurrency: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
    connection: conn?.effectiveType ?? null,
    timezone,
    locale: nav.language ?? null,
    timeSinceNavigationMs,
    navigationTimingMs: { domContentLoaded, load },
  };
}
