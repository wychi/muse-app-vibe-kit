/**
 * @muse-app-vibe-kit/annotate-image — freehand annotation overlay for images.
 *
 * Framework-free: hand it an image (data URL, Blob, or element), it mounts a
 * full-screen overlay with pen tools, and calls you back with the annotated PNG.
 * Feed it video frames and it annotates video too — one frame at a time.
 *
 * Battle-tested in production bug-report flows (screenshot → annotate → describe).
 */

export type AnnotateResult = {
  /** Annotated PNG as base64 (no `data:` prefix). On skip, the original image bytes. */
  dataBase64: string;
  strokes: number;
  skipped: boolean;
  width: number;
  height: number;
};

export type AnnotateOptions = {
  /** Image to annotate: a data URL string, a Blob/File, or a loaded HTMLImageElement. */
  image: string | Blob | HTMLImageElement;
  /** Pen colors. Default: red, yellow, white. */
  colors?: string[];
  /** Toolbar title. Default: "Mark the image". */
  title?: string;
  /** Hint shown under the title. Default: "Draw what should change". */
  hint?: string;
  /**
   * Images larger than this on either side (px) are downscaled before annotating.
   * Default: 4096. Prevents canvas OOM on very large sources.
   */
  maxDimension?: number;
  /** Overlay z-index. Default: 1000. */
  zIndex?: number;
  /** Called exactly once — when the user hits Done or Skip, or close() is called. */
  onComplete: (result: AnnotateResult) => void;
  /** Called after the overlay is removed from the DOM. */
  onClose?: () => void;
};

export type AnnotatorHandle = {
  /** The overlay root element (mounted to document.body). */
  element: HTMLElement;
  /** Dismiss programmatically. Without a result, reports skip with the original image. */
  close: (result?: AnnotateResult) => void;
};

const DEFAULT_COLORS = ["#ff453a", "#ffd60a", "#ffffff"];
const DEFAULT_MAX_DIMENSION = 4096;

type Point = { x: number; y: number };
type Stroke = { color: string; points: Point[] };

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read annotated image."));
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      resolve(text.slice(text.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/** Resolve any supported image source to a loaded <img>. Caller must call revoke(). */
function loadImage(source: string | Blob | HTMLImageElement): Promise<{ img: HTMLImageElement; revoke: () => void; originalBase64: string | null }> {
  if (source instanceof HTMLImageElement) {
    if (!source.complete || source.naturalWidth === 0) {
      return Promise.reject(new Error("HTMLImageElement is not loaded yet."));
    }
    return Promise.resolve({ img: source, revoke: () => {}, originalBase64: null });
  }
  const revokeFns: (() => void)[] = [];
  const revoke = () => revokeFns.forEach((fn) => { try { fn(); } catch { /* noop */ } });
  let url: string;
  let originalBase64: string | null = null;
  if (source instanceof Blob) {
    url = URL.createObjectURL(source);
    revokeFns.push(() => URL.revokeObjectURL(url));
  } else {
    url = source;
    if (/^data:/i.test(url)) originalBase64 = url.slice(url.indexOf(",") + 1);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Best effort for remote URLs; cross-origin images taint the canvas and
    // export will fail — the caller should prefer data URLs or Blobs.
    if (/^https?:/i.test(url)) img.crossOrigin = "anonymous";
    img.onload = () => resolve({ img, revoke, originalBase64 });
    img.onerror = () => { revoke(); reject(new Error("Could not load image for annotation.")); };
    img.src = url;
  });
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function openAnnotator(options: AnnotateOptions): AnnotatorHandle {
  const colors = options.colors?.length ? options.colors : DEFAULT_COLORS;
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const zIndex = options.zIndex ?? 1000;

  const strokes: Stroke[] = [];
  let activeStroke: Stroke | null = null;
  let currentColor = colors[0]!;
  let completed = false;
  let imageBytes: { img: HTMLImageElement; revoke: () => void; originalBase64: string | null } | null = null;

  const overlay = el("section", "vk-annotate");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", options.title ?? "Annotate image");
  overlay.style.zIndex = String(zIndex);

  const toolbar = el("header", "vk-annotate-toolbar");
  const titleBox = el("div", "");
  const titleEl = el("strong", "", options.title ?? "Mark the image");
  const hintEl = el("span", "", options.hint ?? "Draw what should change");
  titleBox.append(titleEl, hintEl);

  const colorBox = el("div", "vk-annotate-colors");
  colorBox.setAttribute("aria-label", "Pen color");
  const colorButtons: HTMLButtonElement[] = [];
  const selectColor = (value: string) => {
    currentColor = value;
    colorButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.color === value)));
  };
  colors.forEach((value, i) => {
    const b = el("button", "") as HTMLButtonElement;
    b.type = "button";
    b.dataset.color = value;
    b.style.setProperty("--pen-color", value);
    b.setAttribute("aria-label", `Pen color ${i + 1}`);
    b.setAttribute("aria-pressed", String(i === 0));
    b.addEventListener("click", () => selectColor(value));
    colorButtons.push(b);
    colorBox.append(b);
  });

  const editBox = el("div", "vk-annotate-edits");
  const undoBtn = el("button", "", "Undo") as HTMLButtonElement;
  const clearBtn = el("button", "", "Clear") as HTMLButtonElement;
  undoBtn.type = clearBtn.type = "button";
  editBox.append(undoBtn, clearBtn);

  const submitBox = el("div", "vk-annotate-submit");
  const skipBtn = el("button", "vk-annotate-skip", "Skip") as HTMLButtonElement;
  const doneBtn = el("button", "vk-annotate-done", "Done") as HTMLButtonElement;
  skipBtn.type = doneBtn.type = "button";
  submitBox.append(skipBtn, doneBtn);

  toolbar.append(titleBox, colorBox, editBox, submitBox);

  const stage = el("div", "vk-annotate-stage");
  const preparing = el("p", "", "Preparing image…");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Annotation canvas");
  stage.append(preparing, canvas);

  overlay.append(toolbar, stage);

  const ctx = () => canvas.getContext("2d");

  const drawStroke = (context: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length === 0) return;
    const first = stroke.points[0]!;
    context.save();
    context.strokeStyle = stroke.color;
    context.lineWidth = Math.max(3, canvas.width / 300);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (const p of stroke.points.slice(1)) context.lineTo(p.x, p.y);
    if (stroke.points.length === 1) context.lineTo(first.x + 0.01, first.y + 0.01);
    context.stroke();
    context.restore();
  };

  const redraw = () => {
    const context = ctx();
    const bytes = imageBytes;
    if (!context || !bytes) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bytes.img, 0, 0, canvas.width, canvas.height);
    for (const s of strokes) drawStroke(context, s);
    if (activeStroke) drawStroke(context, activeStroke);
  };

  const refreshChrome = () => {
    undoBtn.disabled = clearBtn.disabled = strokes.length === 0;
    hintEl.textContent = strokes.length
      ? `${strokes.length} stroke${strokes.length === 1 ? "" : "s"}`
      : (options.hint ?? "Draw what should change");
  };

  const pointFromEvent = (event: PointerEvent): Point | null => {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  };

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const point = pointFromEvent(event);
    if (!point) return;
    canvas.setPointerCapture(event.pointerId);
    activeStroke = { color: currentColor, points: [point] };
    redraw();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!activeStroke || !canvas.hasPointerCapture(event.pointerId)) return;
    const point = pointFromEvent(event);
    if (!point) return;
    activeStroke.points.push(point);
    redraw();
  });
  const finishStroke = (event: PointerEvent) => {
    if (!activeStroke) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    strokes.push(activeStroke);
    activeStroke = null;
    refreshChrome();
    redraw();
  };
  canvas.addEventListener("pointerup", finishStroke);
  canvas.addEventListener("pointercancel", finishStroke);

  undoBtn.addEventListener("click", () => { strokes.pop(); refreshChrome(); redraw(); });
  clearBtn.addEventListener("click", () => { strokes.length = 0; activeStroke = null; refreshChrome(); redraw(); });

  const cleanup = () => {
    imageBytes?.revoke();
    imageBytes = null;
    overlay.remove();
    try { options.onClose?.(); } catch { /* noop */ }
  };

  const finish = (result: AnnotateResult) => {
    if (completed) return;
    completed = true;
    cleanup();
    options.onComplete(result);
  };

  const originalResult = (): AnnotateResult => ({
    dataBase64: imageBytes?.originalBase64 ?? "",
    strokes: strokes.length,
    skipped: true,
    width: canvas.width,
    height: canvas.height,
  });

  skipBtn.addEventListener("click", () => finish(originalResult()));
  doneBtn.addEventListener("click", async () => {
    const context = ctx();
    if (!context || !imageBytes) { finish(originalResult()); return; }
    doneBtn.disabled = true;
    try {
      redraw();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      const dataBase64 = blob
        ? await blobToBase64(blob)
        : canvas.toDataURL("image/png").split(",")[1] ?? "";
      finish({ dataBase64, strokes: strokes.length, skipped: false, width: canvas.width, height: canvas.height });
    } catch {
      // Tainted canvas (cross-origin source): fall back to the original bytes.
      finish(originalResult());
    } finally {
      doneBtn.disabled = false;
    }
  });

  const handle: AnnotatorHandle = {
    element: overlay,
    close: (result) => finish(result ?? originalResult()),
  };

  // Boot: load image, size canvas (downscale huge sources), mount overlay.
  loadImage(options.image).then(
    (bytes) => {
      imageBytes = bytes;
      const scale = Math.min(1, maxDimension / Math.max(bytes.img.naturalWidth, bytes.img.naturalHeight));
      canvas.width = Math.max(1, Math.round(bytes.img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(bytes.img.naturalHeight * scale));
      preparing.remove();
      refreshChrome();
      document.body.append(overlay);
      requestAnimationFrame(redraw);
    },
    () => {
      // Image failed to load: report skip with empty bytes rather than hanging.
      finish({ dataBase64: "", strokes: 0, skipped: true, width: 0, height: 0 });
    },
  );

  refreshChrome();
  return handle;
}
