/**
 * select-region — full-screen drag-to-select a rectangular region.
 * Framework-free, zero dependencies, hardened for mobile touch.
 *
 * Returns document-relative CSS pixels, ready to feed into
 * `@muse-app-vibe-kit/full-page-screenshot`'s `region` option
 * (or `@muse-app-vibe-kit/annotate-image`'s bbox).
 */

export type RegionSelection = {
  /** Document-relative left edge, CSS pixels. */
  x: number;
  /** Document-relative top edge, CSS pixels. */
  y: number;
  /** Width, CSS pixels. */
  width: number;
  /** Height, CSS pixels. */
  height: number;
};

export type SelectRegionOptions = {
  /** Overlay dim color. Defaults to `rgba(0, 0, 0, 0.55)`. */
  dimColor?: string;
  /** Selection rectangle border color. Defaults to `#0a84ff`. */
  borderColor?: string;
  /** Minimum selection width/height in CSS px. Smaller drags are ignored. Defaults to `8`. */
  minSize?: number;
  /** Confirm button label. Defaults to `"Use region"`. */
  confirmLabel?: string;
  /** Cancel button label. Defaults to `"Cancel"`. */
  cancelLabel?: string;
  /** Hint text shown before the first drag. Defaults to `"Drag to select a region"`. */
  hintText?: string;
};

const DEFAULTS = {
  dimColor: "rgba(0, 0, 0, 0.55)",
  borderColor: "#0a84ff",
  minSize: 8,
  confirmLabel: "Use region",
  cancelLabel: "Cancel",
  hintText: "Drag to select a region",
} as const;

/**
 * Opens a full-screen overlay. The user drags a rectangle; on confirm resolves
 * with document-relative CSS pixels, on cancel/ESC resolves `null`.
 * The overlay is removed in all cases.
 */
export function selectRegion(options: SelectRegionOptions = {}): Promise<RegionSelection | null> {
  const config = { ...DEFAULTS, ...options };

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: RegionSelection | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    // Lock page scroll while selecting so viewport coords stay stable.
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = (document.body.style as CSSStyleDeclaration).overscrollBehavior;
    document.body.style.overflow = "hidden";
    (document.body.style as CSSStyleDeclaration).overscrollBehavior = "none";

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const overlay = document.createElement("div");
    overlay.className = "select-region-overlay";
    overlay.style.setProperty("--sr-dim", config.dimColor);
    overlay.style.setProperty("--sr-border", config.borderColor);
    overlay.style.touchAction = "none";

    overlay.innerHTML = `
      <div class="sr-hint">${escapeHtml(config.hintText)}</div>
      <div class="sr-rect" hidden>
        <div class="sr-label"></div>
      </div>
      <div class="sr-actions" hidden>
        <button type="button" class="sr-redraw">Redraw</button>
        <button type="button" class="sr-cancel">${escapeHtml(config.cancelLabel)}</button>
        <button type="button" class="sr-confirm">${escapeHtml(config.confirmLabel)}</button>
      </div>
      <button type="button" class="sr-close" aria-label="Cancel">×</button>
    `;

    const hint = overlay.querySelector<HTMLElement>(".sr-hint")!;
    const rectEl = overlay.querySelector<HTMLElement>(".sr-rect")!;
    const labelEl = overlay.querySelector<HTMLElement>(".sr-label")!;
    const actionsEl = overlay.querySelector<HTMLElement>(".sr-actions")!;

    let drawing = false;
    let startX = 0;
    let startY = 0;
    let current: RegionSelection | null = null;

    const showRect = (x: number, y: number, w: number, h: number) => {
      rectEl.hidden = false;
      rectEl.style.left = `${x}px`;
      rectEl.style.top = `${y}px`;
      rectEl.style.width = `${w}px`;
      rectEl.style.height = `${h}px`;
      labelEl.textContent = `${Math.round(w)} × ${Math.round(h)}`;
    };

    const hideActions = () => {
      actionsEl.hidden = true;
      hint.hidden = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      // Ignore presses on buttons.
      if ((event.target as HTMLElement).closest("button")) return;
      drawing = true;
      startX = event.clientX;
      startY = event.clientY;
      current = null;
      rectEl.hidden = true;
      actionsEl.hidden = true;
      hint.hidden = true;
      overlay.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drawing) return;
      const x = Math.min(startX, event.clientX);
      const y = Math.min(startY, event.clientY);
      const w = Math.abs(event.clientX - startX);
      const h = Math.abs(event.clientY - startY);
      if (w < 1 || h < 1) return;
      showRect(x, y, w, h);
      current = { x: x + scrollX, y: y + scrollY, width: w, height: h };
    };

    const onPointerUp = () => {
      if (!drawing) return;
      drawing = false;
      if (current && current.width >= config.minSize && current.height >= config.minSize) {
        actionsEl.hidden = false;
      } else {
        current = null;
        rectEl.hidden = true;
        hint.hidden = false;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") settle(null);
    };

    const onRedraw = () => {
      current = null;
      rectEl.hidden = true;
      hideActions();
    };

    const cleanup = () => {
      document.body.style.overflow = originalOverflow;
      (document.body.style as CSSStyleDeclaration).overscrollBehavior = originalOverscroll;
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown, true);
    };

    overlay.querySelector(".sr-confirm")!.addEventListener("click", () => settle(current));
    overlay.querySelector(".sr-cancel")!.addEventListener("click", () => settle(null));
    overlay.querySelector(".sr-close")!.addEventListener("click", () => settle(null));
    overlay.querySelector(".sr-redraw")!.addEventListener("click", onRedraw);
    overlay.addEventListener("pointerdown", onPointerDown);
    overlay.addEventListener("pointermove", onPointerMove);
    overlay.addEventListener("pointerup", onPointerUp);
    overlay.addEventListener("pointercancel", onPointerUp);
    document.addEventListener("keydown", onKeyDown, true);

    document.body.appendChild(overlay);
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
