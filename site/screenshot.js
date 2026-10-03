var VibeKitScreenshot = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // modules/full-page-screenshot/reference/index.ts
  var index_exports = {};
  __export(index_exports, {
    captureFullPageScreenshot: () => captureFullPageScreenshot,
    copyFullPageScreenshot: () => copyFullPageScreenshot,
    supportsImageClipboard: () => supportsImageClipboard
  });
  function supportsImageClipboard() {
    const clipboard = navigator.clipboard;
    return Boolean(clipboard && typeof clipboard.write === "function" && typeof ClipboardItem !== "undefined");
  }
  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image encoding failed"));
      reader.onerror = () => reject(reader.error ?? new Error("Image encoding failed"));
      reader.readAsDataURL(blob);
    });
  }
  function imageToPngDataUrl(source, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const naturalWidth = Math.max(1, image.naturalWidth);
        const naturalHeight = Math.max(1, image.naturalHeight);
        const ratio = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(naturalHeight * ratio));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Image canvas unavailable"));
          return;
        }
        try {
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Image PNG unavailable"));
              return;
            }
            void blobToDataUrl(blob).then(resolve, reject);
          }, "image/png");
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error("Image decode failed"));
      image.src = source;
    });
  }
  async function sourceToPngDataUrl(source, maxWidth, maxHeight) {
    if (source.startsWith("data:")) return imageToPngDataUrl(source, maxWidth, maxHeight);
    const response = await fetch(source, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Image fetch failed (${response.status})`);
    const objectUrl = URL.createObjectURL(await response.blob());
    try {
      return await imageToPngDataUrl(objectUrl, maxWidth, maxHeight);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Overlay image decode failed"));
      image.src = source;
    });
  }
  function errorReason(error) {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    if (typeof error === "string") return error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  function sourceKind(source) {
    if (!source) return "missing";
    return source.startsWith("data:") ? "data-url" : "url";
  }
  function defaultCaptureRoot() {
    return document.querySelector("[data-full-page-capture]") ?? document.querySelector("[data-generated-space-root]") ?? (document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.body);
  }
  function describeElement(element) {
    if (element.hasAttribute("data-full-page-capture")) return "[data-full-page-capture]";
    if (element.hasAttribute("data-generated-space-root")) return "[data-generated-space-root]";
    if (element.id) return `#${element.id}`;
    if (element === document.documentElement) return "html";
    if (element === document.body) return "body";
    const className = Array.from(element.classList).slice(0, 2).join(".");
    return className ? `${element.tagName.toLowerCase()}.${className}` : element.tagName.toLowerCase();
  }
  async function captureFullPageScreenshot(renderer, options = {}) {
    const captureRoot = options.root ?? defaultCaptureRoot();
    const width = Math.max(1, Math.ceil(captureRoot.getBoundingClientRect().width), captureRoot.clientWidth);
    const height = Math.max(1, Math.ceil(captureRoot.scrollHeight));
    const requestedScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const maxSide = 4096;
    const maxPixelArea = options.maxPixelArea ?? 8e6;
    const scale = Math.min(requestedScale, maxSide / width, maxSide / height, Math.sqrt(maxPixelArea / (width * height)));
    const measurement = {
      scrollContainer: describeElement(captureRoot),
      containerWidth: width,
      containerHeight: height,
      containerClientWidth: captureRoot.clientWidth,
      containerClientHeight: captureRoot.clientHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      outputWidth: null,
      outputHeight: null,
      scale
    };
    options.onMeasurement?.({ ...measurement });
    const rootMarker = `full-page-screenshot-root-${Date.now()}`;
    const originalRootMarker = captureRoot.getAttribute("data-full-page-screenshot-root");
    captureRoot.setAttribute("data-full-page-screenshot-root", rootMarker);
    const captureRect = captureRoot.getBoundingClientRect();
    const preparedOverlays = [];
    const seenOverlayImages = /* @__PURE__ */ new Set();
    for (const selector of options.overlaySelectors ?? []) {
      captureRoot.querySelectorAll(selector).forEach((image, index) => {
        if (seenOverlayImages.has(image)) return;
        seenOverlayImages.add(image);
        const target = image.closest("[data-screenshot-overlay-target]") ?? image;
        const rect = target.getBoundingClientRect();
        const source = image.currentSrc || image.src || "";
        const overlay = {
          image,
          overlay: `overlay-${preparedOverlays.length + 1}`,
          selector: `${selector}[${index}]`,
          source,
          dataUrl: null,
          left: rect.left - captureRect.left,
          top: rect.top - captureRect.top,
          width: rect.width,
          height: rect.height
        };
        preparedOverlays.push(overlay);
        options.onOverlayDiagnostic?.({
          stage: "received",
          overlay: overlay.overlay,
          selector: overlay.selector,
          sourceKind: sourceKind(source),
          sourceBytes: source.length,
          rect: { left: overlay.left, top: overlay.top, width: overlay.width, height: overlay.height }
        });
      });
    }
    for (let index = preparedOverlays.length - 1; index >= 0; index -= 1) {
      const overlay = preparedOverlays[index];
      if (!overlay || overlay.width > 0 && overlay.height > 0 && overlay.source) continue;
      options.onOverlayDiagnostic?.({
        stage: "failed",
        overlay: overlay?.overlay ?? `overlay-${index + 1}`,
        selector: overlay?.selector ?? "unknown",
        sourceKind: sourceKind(overlay?.source ?? ""),
        sourceBytes: overlay?.source.length ?? 0,
        rect: overlay ? { left: overlay.left, top: overlay.top, width: overlay.width, height: overlay.height } : void 0,
        reason: !overlay?.source ? "Overlay source is empty" : "Overlay target rect has zero area"
      });
      preparedOverlays.splice(index, 1);
    }
    const visibleImages = Array.from(captureRoot.querySelectorAll("img")).filter((image) => {
      const rect = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
    const preparedImages = visibleImages.map((image, index) => ({
      image,
      marker: `full-page-screenshot-image-${index}`,
      originalSrc: image.getAttribute("src"),
      originalSrcset: image.getAttribute("srcset"),
      originalSizes: image.getAttribute("sizes"),
      dataUrl: null
    }));
    for (const item of preparedImages) item.image.dataset.fullPageScreenshotImage = item.marker;
    try {
      await Promise.all([
        ...preparedImages.map(async (item) => {
          const source = item.image.currentSrc || item.image.src;
          const rect = item.image.getBoundingClientRect();
          if (!source) return;
          try {
            item.dataUrl = await sourceToPngDataUrl(
              source,
              Math.max(1, Math.ceil(rect.width * scale)),
              Math.max(1, Math.ceil(rect.height * scale))
            );
          } catch (error) {
            options.onWarning?.("Screenshot image preparation failed", { source, error });
          }
        }),
        ...preparedOverlays.map(async (overlay) => {
          try {
            overlay.dataUrl = await sourceToPngDataUrl(
              overlay.source,
              Math.max(1, Math.ceil(overlay.width * scale)),
              Math.max(1, Math.ceil(overlay.height * scale))
            );
            options.onOverlayDiagnostic?.({
              stage: "prepared",
              overlay: overlay.overlay,
              selector: overlay.selector,
              sourceKind: sourceKind(overlay.source),
              sourceBytes: overlay.source.length,
              normalizedBytes: overlay.dataUrl.length,
              rect: { left: overlay.left, top: overlay.top, width: overlay.width, height: overlay.height }
            });
          } catch (error) {
            const reason = errorReason(error);
            options.onOverlayDiagnostic?.({
              stage: "failed",
              overlay: overlay.overlay,
              selector: overlay.selector,
              sourceKind: sourceKind(overlay.source),
              sourceBytes: overlay.source.length,
              rect: { left: overlay.left, top: overlay.top, width: overlay.width, height: overlay.height },
              reason: `Preparation failed: ${reason}`
            });
            options.onWarning?.("Screenshot overlay preparation failed", { source: overlay.source, error });
          }
        })
      ]);
      for (const item of preparedImages) {
        if (!item.dataUrl) continue;
        item.image.removeAttribute("srcset");
        item.image.removeAttribute("sizes");
        item.image.src = item.dataUrl;
      }
      await Promise.all(preparedImages.map(async (item) => {
        if (!item.dataUrl) return;
        try {
          if (typeof item.image.decode === "function") await item.image.decode();
          else if (!item.image.complete) {
            await new Promise((resolve, reject) => {
              item.image.onload = () => resolve();
              item.image.onerror = () => reject(new Error("Prepared image decode failed"));
            });
          }
        } catch (error) {
          options.onWarning?.("Prepared screenshot image did not decode", error);
        }
      }));
      await nextPaint();
      const rootColor = getComputedStyle(captureRoot).backgroundColor;
      const bodyColor = getComputedStyle(document.body).backgroundColor;
      const backgroundColor = rootColor === "rgba(0, 0, 0, 0)" ? bodyColor : rootColor;
      const canvas = await renderer(captureRoot, {
        backgroundColor: backgroundColor === "rgba(0, 0, 0, 0)" ? "#ffffff" : backgroundColor,
        // Browser-native foreignObject layout preserves the page's CSS Grid,
        // pseudo-elements, typography, and object-fit sizing. The output itself
        // is capped to WKWebView-safe dimensions above, avoiding the historical
        // lower-page clipping without switching to html2canvas's less faithful
        // manual layout engine.
        foreignObjectRendering: true,
        logging: false,
        useCORS: false,
        imageTimeout: 15e3,
        scale,
        x: 0,
        y: 0,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDocument) => {
          const clonedRoot = clonedDocument.querySelector(`[data-full-page-screenshot-root="${rootMarker}"]`);
          const clonedDocumentRoot = clonedDocument.documentElement;
          const clonedBody = clonedDocument.body;
          clonedDocumentRoot.style.width = `${width}px`;
          clonedDocumentRoot.style.height = `${height}px`;
          clonedDocumentRoot.style.minHeight = `${height}px`;
          clonedDocumentRoot.style.overflow = "visible";
          clonedBody.style.width = `${width}px`;
          clonedBody.style.height = `${height}px`;
          clonedBody.style.minHeight = `${height}px`;
          clonedBody.style.overflow = "visible";
          if (clonedRoot) {
            clonedRoot.style.position = "absolute";
            clonedRoot.style.inset = "auto";
            clonedRoot.style.top = "0";
            clonedRoot.style.left = "0";
            clonedRoot.style.margin = "0";
            clonedRoot.style.width = `${width}px`;
            clonedRoot.style.height = `${height}px`;
            clonedRoot.style.minHeight = `${height}px`;
            clonedRoot.style.maxHeight = "none";
            clonedRoot.style.overflow = "visible";
            clonedRoot.scrollTop = 0;
            clonedRoot.scrollLeft = 0;
          }
          clonedDocument.querySelectorAll(".step-footer,.task-center,.mode-nav,.canvas").forEach((element) => {
            if (getComputedStyle(element).position === "sticky") element.style.position = "relative";
            element.style.top = "auto";
            element.style.bottom = "auto";
          });
          for (const item of preparedImages) {
            if (!item.dataUrl) continue;
            const image = clonedDocument.querySelector(`img[data-full-page-screenshot-image="${item.marker}"]`);
            if (!image) continue;
            image.src = item.dataUrl;
            image.removeAttribute("srcset");
            image.removeAttribute("sizes");
          }
          for (const selector of options.hideSelectors ?? []) {
            clonedDocument.querySelectorAll(selector).forEach((element) => element.remove());
          }
        }
      });
      if (preparedOverlays.some((overlay) => overlay.dataUrl)) {
        const context = canvas.getContext("2d");
        if (!context) {
          for (const overlay of preparedOverlays) {
            if (!overlay.dataUrl) continue;
            options.onOverlayDiagnostic?.({
              stage: "failed",
              overlay: overlay.overlay,
              selector: overlay.selector,
              reason: "Final canvas 2D context unavailable"
            });
          }
          options.onWarning?.("Screenshot overlay canvas unavailable");
        } else {
          const scaleX = canvas.width / width;
          const scaleY = canvas.height / height;
          for (const overlay of preparedOverlays) {
            if (!overlay.dataUrl) continue;
            try {
              const image = await loadImage(overlay.dataUrl);
              options.onOverlayDiagnostic?.({
                stage: "decoded",
                overlay: overlay.overlay,
                selector: overlay.selector,
                normalizedBytes: overlay.dataUrl.length,
                decodedSize: { width: image.naturalWidth, height: image.naturalHeight }
              });
              const draw = {
                x: overlay.left * scaleX,
                y: overlay.top * scaleY,
                width: overlay.width * scaleX,
                height: overlay.height * scaleY
              };
              options.onOverlayDiagnostic?.({
                stage: "draw-start",
                overlay: overlay.overlay,
                selector: overlay.selector,
                rect: { left: overlay.left, top: overlay.top, width: overlay.width, height: overlay.height },
                canvasSize: { width: canvas.width, height: canvas.height },
                scale: { x: scaleX, y: scaleY },
                draw
              });
              context.save();
              context.beginPath();
              context.rect(draw.x, draw.y, draw.width, draw.height);
              context.clip();
              context.drawImage(image, draw.x, draw.y, draw.width, draw.height);
              context.restore();
              options.onOverlayDiagnostic?.({
                stage: "drawn",
                overlay: overlay.overlay,
                selector: overlay.selector,
                decodedSize: { width: image.naturalWidth, height: image.naturalHeight },
                canvasSize: { width: canvas.width, height: canvas.height },
                scale: { x: scaleX, y: scaleY },
                draw
              });
            } catch (error) {
              const reason = errorReason(error);
              options.onOverlayDiagnostic?.({
                stage: "failed",
                overlay: overlay.overlay,
                selector: overlay.selector,
                reason: `Decode or paint failed: ${reason}`
              });
              options.onWarning?.("Screenshot overlay paint failed", error);
            }
          }
        }
      }
      measurement.outputWidth = canvas.width;
      measurement.outputHeight = canvas.height;
      options.onMeasurement?.({ ...measurement });
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG unavailable")), "image/png");
      });
      return { blob, measurement: { ...measurement } };
    } finally {
      if (originalRootMarker === null) captureRoot.removeAttribute("data-full-page-screenshot-root");
      else captureRoot.setAttribute("data-full-page-screenshot-root", originalRootMarker);
      for (const item of preparedImages) {
        if (item.originalSrc === null) item.image.removeAttribute("src");
        else item.image.setAttribute("src", item.originalSrc);
        if (item.originalSrcset === null) item.image.removeAttribute("srcset");
        else item.image.setAttribute("srcset", item.originalSrcset);
        if (item.originalSizes === null) item.image.removeAttribute("sizes");
        else item.image.setAttribute("sizes", item.originalSizes);
        delete item.image.dataset.fullPageScreenshotImage;
      }
    }
  }
  async function copyFullPageScreenshot(renderer, options = {}) {
    if (!supportsImageClipboard()) throw new Error("Image clipboard unavailable");
    const capturePromise = (async () => {
      await nextPaint();
      return captureFullPageScreenshot(renderer, options);
    })();
    const writePromise = navigator.clipboard.write([
      new ClipboardItem({ "image/png": capturePromise.then((result) => result.blob) })
    ]);
    const [captureResult, writeResult] = await Promise.allSettled([capturePromise, writePromise]);
    if (captureResult.status === "rejected") throw captureResult.reason;
    if (writeResult.status === "rejected") throw writeResult.reason;
    return captureResult.value.measurement;
  }
  return __toCommonJS(index_exports);
})();
