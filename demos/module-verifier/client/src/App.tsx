import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import html2canvas from "html2canvas";
import { useEffect, useRef, useState } from "react";
import sampleImage from "./assets/fitness-save-overlap.png";
import { openAnnotator, type AnnotateResult } from "./vendor/annotate-image";
import { captureFullPageScreenshot, type FullPageScreenshotMeasurement } from "./vendor/full-page-screenshot";
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
    purpose: "Capture a fixture taller than its visible frame and inspect the actual PNG dimensions and measurements.",
  },
];

function AnnotateImageHarness() {
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
    <section className="test-section" aria-labelledby="annotate-test-title">
      <div className="test-heading">
        <div>
          <p className="section-label">INTERACTIVE TEST</p>
          <h2 id="annotate-test-title">Draw, finish, inspect</h2>
        </div>
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
  );
}

function FullPageScreenshotHarness() {
  const fixtureRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<"idle" | "capturing" | "done" | "failed">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState<FullPageScreenshotMeasurement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const capture = async () => {
    const root = fixtureRef.current;
    if (!root) return;
    setStatus("capturing");
    setError("");
    try {
      const captured = await captureFullPageScreenshot(html2canvas, {
        root,
        hideSelectors: ["[data-capture-exclude]"],
        maxPixelArea: 8_000_000,
      });
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(captured.blob);
      });
      setMeasurement(captured.measurement);
      setStatus("done");
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "The capture could not be created.");
      setStatus("failed");
    }
  };

  return (
    <section className="test-section" aria-labelledby="screenshot-test-title">
      <div className="test-heading">
        <div>
          <p className="section-label">INTERACTIVE TEST</p>
          <h2 id="screenshot-test-title">Capture beyond the viewport</h2>
        </div>
        <span className="run-state">{status === "done" ? "Result ready" : status === "capturing" ? "Running" : status === "failed" ? "Failed" : "Not run"}</span>
      </div>

      <div className="screenshot-layout">
        <div>
          <div className="fixture-window" aria-label="Scrollable screenshot test fixture">
            <article className="capture-fixture" ref={fixtureRef}>
              <header>
                <p>CAPTURE START</p>
                <h3>A deliberately tall test surface</h3>
                <span>The PNG must include all three checkpoints.</span>
              </header>
              <div className="fixture-checkpoints">
                <div><b>01</b><strong>Top marker</strong><span>Visible before scrolling</span></div>
                <div><b>02</b><strong>Middle marker</strong><span>Below the first frame</span></div>
                <div><b>03</b><strong>Bottom marker</strong><span>Proof of full-height capture</span></div>
              </div>
              <footer>
                <span>CAPTURE END</span>
                <strong>All content reached</strong>
              </footer>
            </article>
          </div>
          <button className="run-button" type="button" onClick={() => void capture()} disabled={status === "capturing"}>
            <span className="button-icon frame" aria-hidden="true" />
            {status === "capturing" ? "Capturing reference output…" : "Capture test fixture"}
          </button>
        </div>

        <div className="result-panel" aria-live="polite">
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
              <a className="download-link" href={previewUrl} download="module-verification.png">Download PNG</a>
            </>
          ) : (
            <div className="empty-result">
              <span className="output-glyph" aria-hidden="true" />
              <p>The fixture is taller than its frame. Run the real capture function to verify that the bottom marker appears in the PNG.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function App() {
  const [selectedId, setSelectedId] = useState<ModuleId>("annotate-image");
  const selected = modules.find((item) => item.id === selectedId) ?? modules[0];

  return (
    <div className="verifier-shell">
      <SafeAreaTopScrim backgroundColor="var(--ink)" />
      <header className="verifier-intro">
        <p className="eyebrow">REFERENCE IMPLEMENTATION HARNESS</p>
        <h1>Choose a module. Run its real code.</h1>
        <p className="intro-copy">Each test imports the module’s vendored <code>reference/</code> source. The harness only supplies inputs and displays outputs.</p>
      </header>

      <main className="verifier-main" data-full-page-capture>
        <section className="module-picker" aria-labelledby="module-picker-title">
          <label id="module-picker-title" htmlFor="module-select">Module under test</label>
          <div className="select-wrap">
            <select id="module-select" value={selectedId} onChange={(event) => setSelectedId(event.target.value as ModuleId)}>
              {modules.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <span aria-hidden="true" />
          </div>

          <div className="module-summary">
            <div>
              <span className="module-version">v{selected.version}</span>
              <h2>{selected.name}</h2>
              <code>{selected.packageName}</code>
            </div>
            <p>{selected.purpose}</p>
          </div>
          <div className="source-line"><span aria-hidden="true" />Loaded from <code>client/src/vendor/{selected.id}/</code></div>
        </section>

        {selectedId === "annotate-image" ? <AnnotateImageHarness /> : <FullPageScreenshotHarness />}
      </main>
    </div>
  );
}
