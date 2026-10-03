// Per-device identity for diagnostic uploads.
//
// A stable device id lives in localStorage (existing key, so upgrades keep
// their identity — no churn). The device display name is also stored in
// localStorage: a name the user set earlier is kept verbatim; when no name
// was ever stored, a random 6-char code is generated once and persisted.
// There is no manual name input in the UI. The label rides along on every
// report bundle as device_label, so logs from multiple phones are
// distinguishable when debugging.
//
// All storage reads are guarded: these helpers never throw.

const DEVICE_ID_KEY = "vibe-kit-device-id";
const DEVICE_NAME_KEY = "vibe-kit-device-name";
const MAX_NAME_LENGTH = 24;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Stable per-device id. Keeps an existing id; otherwise generates a UUID. */
export function getDeviceId(): string {
  let id = readStorage(DEVICE_ID_KEY);
  if (!id) {
    try {
      id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    } catch {
      return "";
    }
  }
  return id;
}

/** Short display id: last 8 hex chars for UUIDs, as-is for legacy 6-char ids. */
export function getDeviceShortId(): string {
  const id = getDeviceId();
  if (!id) return "unknown";
  const compact = id.replace(/-/g, "");
  return compact.length > 8 ? compact.slice(-8) : compact;
}

/** Random 6-char code from an unambiguous alphabet (no 0/O, 1/I/l). */
export function generateDeviceCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  try {
    const bytes = new Uint32Array(6);
    crypto.getRandomValues(bytes);
    for (const value of bytes) code += alphabet[value % alphabet.length];
  } catch {
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/** Device display name. A previously stored name is kept verbatim; when no
 *  name was ever stored, a random 6-char code is generated once, persisted,
 *  and returned. Never throws. */
export function getDeviceName(): string {
  const named = (readStorage(DEVICE_NAME_KEY) ?? "").trim();
  if (named) return named.slice(0, MAX_NAME_LENGTH);
  const code = generateDeviceCode();
  try {
    localStorage.setItem(DEVICE_NAME_KEY, code);
  } catch {
    // Storage unavailable: session-only code, never throw.
  }
  return code;
}

export type ScreenDims = {
  /** Portrait CSS pixels, orientation-independent. */
  cssW: number;
  cssH: number;
  dpr: number;
  ua: string;
  /** Major iOS version parsed from the UA (null when not parseable). */
  iosMajor: number | null;
};

function getScreenDims(): ScreenDims {
  try {
    const w = typeof window !== "undefined" && window.screen ? window.screen.width : 0;
    const h = typeof window !== "undefined" && window.screen ? window.screen.height : 0;
    const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
    const ua: string = typeof navigator !== "undefined" ? (navigator.userAgent ?? "") : "";
    const iosMatch = /OS (\d+)_/.exec(ua);
    return {
      cssW: Math.min(w, h),
      cssH: Math.max(w, h),
      dpr,
      ua,
      iosMajor: iosMatch && iosMatch[1] ? parseInt(iosMatch[1], 10) : null,
    };
  } catch {
    return { cssW: 0, cssH: 0, dpr: 1, ua: "", iosMajor: null };
  }
}

/**
 * Lookup keyed by "<cssW>x<cssH>@<dpr>". A single-element array means the
 * combo is unambiguous; multiple entries mean ambiguous (never guess).
 */
const IPHONE_MODEL_TABLE: Record<string, string[]> = {
  "375x667@2": ["iPhone SE (2nd/3rd gen)"],
  "375x812@3": ["iPhone 12 mini", "iPhone 13 mini"],
  "390x844@3": ["iPhone 12", "iPhone 13", "iPhone 14", "iPhone 16e"],
  "393x852@3": ["iPhone 14 Pro", "iPhone 15", "iPhone 15 Pro", "iPhone 16"],
  "402x874@3": ["iPhone 16 Pro"],
  "428x926@3": ["iPhone 12 Pro Max", "iPhone 13 Pro Max", "iPhone 14 Plus"],
  "430x932@3": ["iPhone 15 Pro Max", "iPhone 16 Plus"],
  "440x956@3": ["iPhone 16 Pro Max"],
};

/** Test seam: pure function over explicit dims. */
export function inferDeviceModelFrom(dims: ScreenDims): string | null {
  if (!/iPhone/i.test(dims.ua)) return null;
  if (dims.cssW <= 0 || dims.cssH <= 0) return null;
  const key = `${dims.cssW}x${dims.cssH}@${Math.round(dims.dpr)}`;
  const models = IPHONE_MODEL_TABLE[key];
  if (!models || models.length !== 1) return null; // unknown or ambiguous: never guess
  return models[0] ?? null;
}

/** Inferred iPhone model, or null when not an iPhone / ambiguous / unknown. */
export function inferDeviceModel(): string | null {
  try {
    return inferDeviceModelFrom(getScreenDims());
  } catch {
    return null;
  }
}

/** Sensible platform label for non-iPhone devices. */
function cleanPlatformLabel(): string {
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const raw = typeof navigator !== "undefined" && navigator.platform ? navigator.platform : "";
    if (/iPad/i.test(ua) || /^iPad/.test(raw)) return "iPad";
    if (/Android/i.test(ua)) return "Android";
    if (/^Mac/i.test(raw)) return "Mac";
    if (/^Win/i.test(raw)) return "Windows";
    if (/^Linux/i.test(raw)) return "Linux";
    return raw || "device";
  } catch {
    return "device";
  }
}

/**
 * Effective label for reports: the device name (user-set, or the
 * auto-generated 6-char code), plus the inferred model/platform for context.
 */
export function getDeviceLabel(): string {
  try {
    const name = getDeviceName().trim();
    const model = inferDeviceModel();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const platform = model ?? (/iPhone/i.test(ua) ? "iPhone" : cleanPlatformLabel());
    return name ? `${name} · ${platform}` : `${platform} · ${getDeviceShortId()}`;
  } catch {
    return "device";
  }
}
