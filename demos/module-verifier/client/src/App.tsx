import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import html2canvas from "html2canvas";
import { useRef, useState } from "react";
import sampleImage from "./assets/fitness-save-overlap.png";
import { openAnnotator, type AnnotateResult } from "./vendor/annotate-image";
import {
captureFullPageScreenshot,
copyFullPageScreenshot,
supportsImageClipboard,
type FullPageScreenshotMeasurement,
type FullPageScreenshotOptions,
} from "./vendor/full-page-screenshot";
import "./vendor/annotate-image/styles.css";

type ModuleId = "annotate-image" | "full-page-screenshot";

type ModuleInfo = {
  id: ModuleId;
  name: string;
  packageName: string;
  version: string;
  purpose: string;
};

const modules: readonly [ModuleInfo, ModuleInfo] = [
  {
    id: "annotate-image",
    name: "Annotate Image",
    packageName: "@muse-app-vibe-kit/annotate-image",
    version: "1.1.0",
    purpose: "Open the touch-first overlay, draw on a real image, and inspect the returned PNG and stroke geometry.",
  },
  {
    id: "full-page-screenshot",
    name: "Full-Page Screenshot",
    packageName: "@muse-app-vibe-kit/screenshot",
    version: "1.0.0",
    purpose: "Capture a natural long page, then inspect or copy the actual PNG returned by the reference implementation.",
  },
];

function ModuleHeader({ module, onBack }: { module: ModuleInfo; onBack: () => void }) {
  return (
    <header className="module-page-header" data-capture-exclude>
      <button className="back-button" type="button" onClick={onBack} aria-label="Back to module list">←</button>
      <div>
        <span className="module-version">v{module.version}</span>
        <h1>{module.name}</h1>
        <code>{module.packageName}</code>
      </div>
    </header>
  );
}

function AnnotateImagePage({ module, onBack }: { module: ModuleInfo; onBack: () => void }) {
  const [result, setResult] = useState<AnnotateResult | null>(null);

  const open = () => {
    openAnnotator({
      image: sampleImage,
      title: "Mark the image",
      hint: "Circle the Save button covering the list",
      maxDimension: 2048,
      onComplete: (nextResult) => setResult(nextResult),
    });
  };

  return (
    <main className="module-page">
      <ModuleHeader module={module} onBack={onBack} />
      <section className="module-context">
        <p className="section-label">REAL REFERENCE FLOW</p>
        <h2>Draw, finish, inspect</h2>
        <p>{module.purpose}</p>
        <div className="source-line"><span aria-hidden="true" />Loaded from <code>client/src/vendor/{module.id}/</code></div>
      </section>

      <section className="test-section" aria-labelledby="annotate-test-title">
        <div className="test-heading">
          <h2 id="annotate-test-title">Image fixture</h2>
          <span className="run-state">{result ? "Result ready" : "Not run"}</span>
        </div>
        <div className="annotate-layout">
          <div>
            <div className="sample-frame">
              <img
                src={result?.dataBase64 ? `data:image/png;base64,${result.dataBase64}` : sampleImage}
                alt={result?.strokes ? "Fitness app screenshot with test annotations" : "Fitness app screenshot with a Save button covering a workout list"}
              />
              <span>Test fixture</span>
            </div>
            <button className="run-button" type="button" onClick={open}>
              <span className="button-icon pen" aria-hidden="true" />
              {result ? "Open annotator again" : "Open annotation UI"}
            </button>
          </div>

          <div className="result-panel" aria-live="polite">
            <h3>Reference output</h3>
            {!result ? (
              <div className="empty-result">
                <span className="output-glyph" aria-hidden="true" />
                <p>Complete or skip the overlay to see the exact result returned by <code>openAnnotator()</code>.</p>
              </div>
            ) : (
              <>
                <dl className="metrics">
                  <div><dt>Outcome</dt><dd>{result.skipped ? "Skipped" : "Completed"}</dd></div>
                  <div><dt>Canvas</dt><dd>{result.width} × {result.height}</dd></div>
                  <div><dt>Strokes</dt><dd>{result.strokes}</dd></div>
                  <div><dt>Regions</dt><dd>{result.annotations.length}</dd></div>
                </dl>
                <details>
                  <summary>Inspect annotation JSON</summary>
                  <pre>{JSON.stringify(result.annotations, null, 2)}</pre>
                </details>
                <button className="text-button" type="button" onClick={() => setResult(null)}>Clear result</button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function blobToPreviewDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("The captured PNG could not be read."));
    reader.onerror = () => reject(reader.error ?? new Error("The captured PNG could not be read."));
    reader.readAsDataURL(blob);
  });
}

function FullPageScreenshotPage({ module, onBack }: { module: ModuleInfo; onBack: () => void }) {
  const pageRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<"idle" | "capturing" | "done" | "failed">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState<FullPageScreenshotMeasurement | null>(null);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const imageClipboardSupported = supportsImageClipboard();

  const screenshotOptions = (root: HTMLElement): FullPageScreenshotOptions => ({
    root,
    hideSelectors: ["[data-capture-exclude]"],
    maxPixelArea: 8_000_000,
  });

  const capture = async () => {
    const root = pageRef.current;
    if (!root) return;
    setStatus("capturing");
    setCopyStatus("idle");
    setError("");
    try {
      const captured = await captureFullPageScreenshot(html2canvas, screenshotOptions(root));
      // The preview decodes the returned PNG blob itself. If text is absent
      // here, it is absent in the PNG and is not a preview URL problem.
      setPreviewUrl(await blobToPreviewDataUrl(captured.blob));
      setMeasurement(captured.measurement);
      setStatus("done");
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "The capture could not be created.");
      setStatus("failed");
    }
  };

  const copy = async () => {
    const root = pageRef.current;
    if (!root || !imageClipboardSupported || copyStatus === "copying") return;
    setCopyStatus("copying");
    setError("");
    try {
      const nextMeasurement = await copyFullPageScreenshot(html2canvas, screenshotOptions(root));
      setMeasurement(nextMeasurement);
      setCopyStatus("copied");
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "The PNG could not be copied.");
      setCopyStatus("failed");
    }
  };

  return (
    <main className="module-page screenshot-page" ref={pageRef} data-full-page-capture>
      <ModuleHeader module={module} onBack={onBack} />

      <section className="capture-hero">
        <p>CAPTURE START</p>
        <h2>A real long page, not a nested scroller.</h2>
        <span>This page uses the browser’s main scroll flow, matching how the module is used in Workout Timer.</span>
      </section>

      <section className="page-story" aria-label="Long-page screenshot checkpoints">
        <article>
          <b>01</b>
          <div><h3>Top marker</h3><p>Visible when the page opens. It proves the capture begins at the page root.</p></div>
        </article>
        <article>
          <b>02</b>
          <div><h3>Middle marker</h3><p>Below the first viewport. Scroll naturally to reach it; there is no overflow container around this content.</p></div>
        </article>
        <article>
          <b>03</b>
          <div><h3>Bottom marker</h3><p>The generated PNG must include this final checkpoint and all of its text.</p></div>
        </article>
      </section>

      <section className="capture-end">
        <span>CAPTURE END</span>
        <strong>All page content reached</strong>
      </section>

      <section className="capture-controls" data-capture-exclude aria-labelledby="capture-controls-title">
        <div className="test-heading">
          <div>
            <p className="section-label">INTERACTIVE TEST</p>
            <h2 id="capture-controls-title">Capture this page</h2>
          </div>
          <span className="run-state">{status === "done" ? "Result ready" : status === "capturing" ? "Running" : status === "failed" ? "Failed" : "Not run"}</span>
        </div>
        <button className="run-button" type="button" onClick={() => void capture()} disabled={status === "capturing"}>
          <span className="button-icon frame" aria-hidden="true" />
          {status === "capturing" ? "Capturing reference output…" : "Capture full page"}
        </button>

        <div className="result-panel page-result" aria-live="polite">
          <h3>Reference output</h3>
          {status === "failed" ? (
            <div className="error-result" role="status"><strong>Capture failed</strong><p>{error}</p></div>
          ) : previewUrl && measurement ? (
            <>
              <div className="capture-preview">
                <img src={previewUrl} alt="PNG generated by the full-page screenshot reference implementation" />
              </div>
              <dl className="metrics">
                <div><dt>Container</dt><dd>{measurement.containerWidth} × {measurement.containerHeight}</dd></div>
                <div><dt>Viewport</dt><dd>{measurement.viewportWidth} × {measurement.viewportHeight}</dd></div>
                <div><dt>PNG</dt><dd>{measurement.outputWidth} × {measurement.outputHeight}</dd></div>
                <div><dt>Scale</dt><dd>{measurement.scale.toFixed(2)}×</dd></div>
              </dl>
              <div className="output-actions">
                <a className="download-link" href={previewUrl} download="module-verification.png">Download PNG</a>
                <button
                  className="copy-button"
                  type="button"
                  onClick={() => void copy()}
                  disabled={!imageClipboardSupported || copyStatus === "copying"}
                  aria-describedby={!imageClipboardSupported ? "clipboard-support-note" : undefined}
                >
                  {copyStatus === "copying" ? "Copying…" : copyStatus === "copied" ? "Copied to clipboard" : "Copy to clipboard"}
                </button>
              </div>
              {!imageClipboardSupported && <p className="support-note" id="clipboard-support-note">Image clipboard is not available in this browser.</p>}
              {copyStatus === "failed" && <p className="support-note error-copy" role="status">{error || "The PNG could not be copied."}</p>}
            </>
          ) : (
            <div className="empty-result">
              <span className="output-glyph" aria-hidden="true" />
              <p>Run the reference capture. The preview is decoded from the returned PNG blob.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ModuleList({ onOpen }: { onOpen: (id: ModuleId) => void }) {
  return (
    <>
      <header className="verifier-intro">
        <p className="eyebrow">REFERENCE IMPLEMENTATION HARNESS</p>
        <h1>Choose a module. Run its real code.</h1>
        <p className="intro-copy">Each module opens in its own realistic verification page.</p>
      </header>
      <main className="module-list" aria-labelledby="module-list-title">
        <div className="list-intro">
          <h2 id="module-list-title">Modules</h2>
          <p>Vendored from each module’s <code>reference/</code> source.</p>
        </div>
        <div className="module-grid">
          {modules.map((module, index) => (
            <button className="module-card" type="button" key={module.id} onClick={() => onOpen(module.id)}>
              <span className="module-index">0{index + 1}</span>
              <span className="module-version">v{module.version}</span>
              <strong>{module.name}</strong>
              <code>{module.packageName}</code>
              <span className="module-purpose">{module.purpose}</span>
              <span className="module-open">Open verification page <b aria-hidden="true">→</b></span>
            </button>
          ))}
        </div>
      </main>
    </>
  );
}

export function App() {
  const [selectedId, setSelectedId] = useState<ModuleId | null>(null);
  const selected = modules.find((item) => item.id === selectedId);

  return (
    <div className="verifier-shell">
      <SafeAreaTopScrim backgroundColor="var(--ink)" />
      {!selected ? (
        <ModuleList onOpen={setSelectedId} />
      ) : selected.id === "annotate-image" ? (
        <AnnotateImagePage module={selected} onBack={() => setSelectedId(null)} />
      ) : (
        <FullPageScreenshotPage module={selected} onBack={() => setSelectedId(null)} />
      )}
    </div>
  );
}
