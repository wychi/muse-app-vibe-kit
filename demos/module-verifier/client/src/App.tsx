import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import html2canvas from "html2canvas";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { api, type ApiResponse } from "./api";
import sampleImage from "./assets/fitness-save-overlap.png";
import { openAnnotator, type AnnotateResult } from "./vendor/annotate-image";
import {
captureFullPageScreenshot,
copyFullPageScreenshot,
supportsImageClipboard,
type FullPageScreenshotMeasurement,
type FullPageScreenshotOptions,
} from "./vendor/full-page-screenshot";
import { selectRegion, type RegionSelection } from "./vendor/select-region";
import "./vendor/annotate-image/styles.css";
import "./vendor/select-region/styles.css";

type PageId = "annotate-image" | "full-page-screenshot" | "select-region" | "region-screenshot" | "ai-identification";
type IdentifiedObject = ApiResponse<typeof api, "identifyScreenshotObjects">["objects"][number];
type CaptureState = "idle" | "capturing" | "done" | "failed";

type PageInfo = {
  id: PageId;
  name: string;
  packageName: string;
  version?: string;
  purpose: string;
  modules?: string;
};

const modulePages: readonly PageInfo[] = [
  {
    id: "annotate-image",
    name: "Annotate Image",
    packageName: "@muse-app-vibe-kit/annotate-image",
    version: "1.1.0",
    purpose: "Choose a real image, draw in the touch-first overlay, and inspect the returned PNG and bounding-box JSON.",
  },
  {
    id: "full-page-screenshot",
    name: "Full-Page Screenshot",
    packageName: "@muse-app-vibe-kit/screenshot",
    version: "1.2.0",
    purpose: "Capture a realistic long page, then preview, download, or copy the PNG returned by the reference implementation.",
  },
  {
    id: "select-region",
    name: "Select Region",
    packageName: "@muse-app-vibe-kit/select-region",
    version: "1.0.0",
    purpose: "Open the full-screen selection overlay and inspect its document-relative rectangle.",
  },
];

const integrationPages: readonly PageInfo[] = [
  {
    id: "region-screenshot",
    name: "Region Screenshot",
    packageName: "select-region → screenshot",
    modules: "2 modules",
    purpose: "Draw a region, pass the returned coordinates into the screenshot module, and inspect the cropped PNG.",
  },
  {
    id: "ai-identification",
    name: "AI Identification",
    packageName: "screenshot → Muse AI",
    modules: "App integration",
    purpose: "Capture the realistic storefront and ask Muse AI to identify only the objects and UI elements visible in the PNG.",
  },
];

function PageHeader({ info, onBack, eyebrow = "REFERENCE VERIFICATION" }: { info: PageInfo; onBack: () => void; eyebrow?: string }) {
  return (
    <header className="module-page-header" data-capture-exclude>
      <button className="back-button" type="button" onClick={onBack} aria-label="Back to home">←</button>
      <div>
        <span className="module-version">{info.version ? `v${info.version}` : eyebrow}</span>
        <h1>{info.name}</h1>
        <code>{info.packageName}</code>
      </div>
    </header>
  );
}

function ContextBlock({ info, label, title }: { info: PageInfo; label: string; title: string }) {
  return (
    <section className="module-context">
      <p className="section-label">{label}</p>
      <h2>{title}</h2>
      <p>{info.purpose}</p>
      <div className="source-line">
        <span aria-hidden="true" />
        {info.version ? <>Loaded from <code>client/src/vendor/{info.id}/</code></> : <>Composition stays in the app layer.</>}
      </div>
    </section>
  );
}

function AnnotateImagePage({ info, onBack }: { info: PageInfo; onBack: () => void }) {
  const [imageSource, setImageSource] = useState(sampleImage);
  const [imageName, setImageName] = useState("fitness-save-overlap.png");
  const [result, setResult] = useState<AnnotateResult | null>(null);

  const chooseImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setImageSource(reader.result);
      setImageName(file.name);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const open = () => {
    openAnnotator({
      image: imageSource,
      title: "Mark the image",
      hint: "Draw around the area you want to call out",
      maxDimension: 2048,
      onComplete: setResult,
    });
  };

  return (
    <main className="module-page">
      <PageHeader info={info} onBack={onBack} />
      <ContextBlock info={info} label="SINGLE MODULE" title="Draw, finish, inspect" />
      <section className="test-section" aria-labelledby="annotate-test-title">
        <div className="test-heading">
          <h2 id="annotate-test-title">Image fixture</h2>
          <span className="run-state">{result ? "Result ready" : "Not run"}</span>
        </div>
        <div className="annotate-layout">
          <div>
            <label className="image-picker">
              <span>Choose image</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} />
              <b>{imageName}</b>
            </label>
            <div className="sample-frame">
              <img
                src={result?.dataBase64 ? `data:image/png;base64,${result.dataBase64}` : imageSource}
                alt={result?.strokes ? "Selected image with test annotations" : "Selected image ready for annotation"}
              />
              <span>{imageSource === sampleImage ? "Test fixture" : "Selected image"}</span>
            </div>
            <button className="run-button" type="button" onClick={open}>
              <span className="button-icon pen" aria-hidden="true" />
              {result ? "Open annotator again" : "Open annotation UI"}
            </button>
          </div>
          <div className="result-panel" aria-live="polite">
            <h3>Reference output</h3>
            {!result ? (
              <EmptyResult>Complete or skip the overlay to see the exact result returned by <code>openAnnotator()</code>.</EmptyResult>
            ) : (
              <>
                <dl className="metrics">
                  <div><dt>Outcome</dt><dd>{result.skipped ? "Skipped" : "Completed"}</dd></div>
                  <div><dt>Canvas</dt><dd>{result.width} × {result.height}</dd></div>
                  <div><dt>Strokes</dt><dd>{result.strokes}</dd></div>
                  <div><dt>Regions</dt><dd>{result.annotations.length}</dd></div>
                </dl>
                <details open>
                  <summary>Annotation bbox JSON</summary>
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

function EmptyResult({ children, icon = "output" }: { children: ReactNode; icon?: "output" | "region" | "ai" }) {
  return (
    <div className="empty-result">
      <span className={icon === "output" ? "output-glyph" : icon === "region" ? "region-glyph" : "ai-scan-icon"} aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

function blobToPreviewDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The captured PNG could not be read."));
    reader.onerror = () => reject(reader.error ?? new Error("The captured PNG could not be read."));
    reader.readAsDataURL(blob);
  });
}

function ScreenshotOutput({ previewUrl, measurement, filename, emptyCopy }: {
  previewUrl: string | null;
  measurement: FullPageScreenshotMeasurement | null;
  filename: string;
  emptyCopy: string;
}) {
  if (!previewUrl || !measurement) return <EmptyResult>{emptyCopy}</EmptyResult>;
  return (
    <>
      <div className="capture-preview"><img src={previewUrl} alt="PNG generated by the screenshot module" /></div>
      <dl className="metrics">
        <div><dt>Source</dt><dd>{measurement.containerWidth} × {measurement.containerHeight}</dd></div>
        <div><dt>PNG</dt><dd>{measurement.outputWidth} × {measurement.outputHeight}</dd></div>
        <div><dt>Scale</dt><dd>{measurement.scale.toFixed(2)}×</dd></div>
        <div><dt>Format</dt><dd>PNG</dd></div>
      </dl>
      <a className="download-link single-action" href={previewUrl} download={filename}>Download PNG</a>
    </>
  );
}

type Category = "All" | "Carry" | "Camp" | "Drink";
const products = [
  { id: "trail-pack", name: "Trail daypack", detail: "18 L · recycled ripstop", price: "$68", category: "Carry" as const, art: "pack" },
  { id: "camp-lamp", name: "Pocket lantern", detail: "Warm light · USB-C", price: "$34", category: "Camp" as const, art: "lamp" },
  { id: "water-bottle", name: "Insulated bottle", detail: "750 ml · steel", price: "$29", category: "Drink" as const, art: "bottle" },
  { id: "field-blanket", name: "Field blanket", detail: "Water-resistant backing", price: "$54", category: "Camp" as const, art: "blanket" },
  { id: "sling-bag", name: "Transit sling", detail: "4 L · quick-access pocket", price: "$42", category: "Carry" as const, art: "sling" },
];

function StorefrontScene({ pageRef, captureRoot = false }: { pageRef: React.RefObject<HTMLElement | null>; captureRoot?: boolean }) {
  const productListRef = useRef<HTMLElement>(null);
  const [category, setCategory] = useState<Category>("All");
  const [query, setQuery] = useState("");
  const [savedProducts, setSavedProducts] = useState<Set<string>>(() => new Set());
  const visibleProducts = products.filter((product) => (
    (category === "All" || product.category === category)
    && product.name.toLowerCase().includes(query.trim().toLowerCase())
  ));
  const toggleSaved = (id: string) => setSavedProducts((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <main className="storefront-scene" ref={pageRef} {...(captureRoot ? { "data-full-page-capture": true } : {})} aria-label="Northline sample shopping app">
      <header className="storefront-header">
        <div className="storefront-status"><span>9:41</span><span>Sample storefront</span></div>
        <div className="storefront-brand-row">
          <div><p>Northline Supply</p><h2>Pack light.<br />Stay longer.</h2></div>
          <div className="storefront-mark" aria-hidden="true"><span /><span /></div>
        </div>
        <p className="storefront-intro">Practical gear for quiet weekends outside, selected for small bags and simple plans.</p>
        <button className="scene-primary-button" type="button" onClick={() => productListRef.current?.scrollIntoView({ behavior: "smooth" })}>Browse essentials <span aria-hidden="true">↓</span></button>
      </header>
      <section className="storefront-tools" aria-label="Catalog controls">
        <label className="scene-search"><span className="search-glyph" aria-hidden="true" /><span className="sr-only">Search products</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search weekend gear" /></label>
        <div className="category-row" aria-label="Product categories">
          {(["All", "Carry", "Camp", "Drink"] as const).map((item) => <button className={category === item ? "active" : ""} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
      </section>
      <section className="storefront-feature" aria-label="Featured collection">
        <div className="feature-art" role="img" aria-label="Illustrated forest-green travel bag with a rolled blanket"><span className="feature-sun" /><span className="feature-bag" /><span className="feature-roll" /></div>
        <div className="feature-copy"><p>FIELD NOTE 07</p><h3>One bag for a slow Saturday</h3><span>A compact kit for the trail, the ferry, and wherever lunch happens.</span></div>
      </section>
      <section className="storefront-products" ref={productListRef} aria-labelledby="essentials-title">
        <div className="scene-section-heading"><div><p>CURATED FOR OCTOBER</p><h3 id="essentials-title">Weekend essentials</h3></div><span>{visibleProducts.length} items</span></div>
        <div className="product-list">
          {visibleProducts.length ? visibleProducts.map((product) => {
            const saved = savedProducts.has(product.id);
            return (
              <article className="product-row" key={product.id}>
                <div className={`product-art product-art-${product.art}`} role="img" aria-label={`${product.name} product illustration`}><span /></div>
                <div className="product-copy"><p>{product.category}</p><h4>{product.name}</h4><span>{product.detail}</span><strong>{product.price}</strong></div>
                <button className={saved ? "product-save saved" : "product-save"} type="button" onClick={() => toggleSaved(product.id)} aria-label={`${saved ? "Remove" : "Save"} ${product.name}`} aria-pressed={saved}><span aria-hidden="true" /></button>
              </article>
            );
          }) : <div className="catalog-empty"><strong>No gear found</strong><span>Try another search or category.</span></div>}
        </div>
      </section>
      <section className="storefront-service" aria-label="Store services">
        <div className="service-icon" aria-hidden="true"><span /></div>
        <div><p>Borrow before you buy</p><h3>Try the weekend kit</h3><span>Pick up Friday. Return Monday. Keep only what earns a place in your pack.</span></div>
        <button type="button" onClick={() => setCategory("All")}>View kit</button>
      </section>
      <footer className="storefront-footer"><strong>NORTHLINE</strong><span>Made for the route you actually take.</span></footer>
    </main>
  );
}

function FullPageScreenshotPage({ info, onBack }: { info: PageInfo; onBack: () => void }) {
  const pageRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<CaptureState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState<FullPageScreenshotMeasurement | null>(null);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const clipboardSupported = supportsImageClipboard();

  const options = (root: HTMLElement): FullPageScreenshotOptions => ({ root, maxPixelArea: 8_000_000 });
  const capture = async () => {
    const root = pageRef.current;
    if (!root) return;
    setStatus("capturing"); setError(""); setCopyStatus("idle");
    try {
      const result = await captureFullPageScreenshot(html2canvas, options(root));
      setPreviewUrl(await blobToPreviewDataUrl(result.blob));
      setMeasurement(result.measurement);
      setStatus("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The capture could not be created.");
      setStatus("failed");
    }
  };
  const copy = async () => {
    const root = pageRef.current;
    if (!root || !clipboardSupported) return;
    setCopyStatus("copying"); setError("");
    try {
      setMeasurement(await copyFullPageScreenshot(html2canvas, options(root)));
      setCopyStatus("copied");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The PNG could not be copied.");
      setCopyStatus("failed");
    }
  };

  return (
    <>
      <div className="module-page screenshot-module-header"><PageHeader info={info} onBack={onBack} /></div>
      <StorefrontScene pageRef={pageRef} captureRoot />
      <section className="module-page capture-controls" aria-labelledby="capture-title">
        <div className="test-heading"><div><p className="section-label">SINGLE MODULE</p><h2 id="capture-title">Capture and inspect</h2></div><span className="run-state">{status === "done" ? "PNG ready" : status === "capturing" ? "Capturing" : status === "failed" ? "Failed" : "Ready"}</span></div>
        <button className="run-button" type="button" onClick={() => void capture()} disabled={status === "capturing"}><span className="button-icon frame" aria-hidden="true" />{status === "capturing" ? "Capturing…" : "Capture full page"}</button>
        {error && <div className="error-result" role="status"><strong>The test did not finish</strong><p>{error}</p></div>}
        <div className="result-panel page-result" aria-live="polite">
          <h3>Screenshot output</h3>
          {previewUrl && measurement ? (
            <>
              <div className="capture-preview"><img src={previewUrl} alt="Full-page PNG of the Northline sample shopping app" /></div>
              <dl className="metrics">
                <div><dt>Page</dt><dd>{measurement.containerWidth} × {measurement.containerHeight}</dd></div><div><dt>PNG</dt><dd>{measurement.outputWidth} × {measurement.outputHeight}</dd></div><div><dt>Scale</dt><dd>{measurement.scale.toFixed(2)}×</dd></div><div><dt>Format</dt><dd>PNG</dd></div>
              </dl>
              <div className="output-actions"><a className="download-link" href={previewUrl} download="northline-full-page.png">Download PNG</a><button className="copy-button" type="button" onClick={() => void copy()} disabled={!clipboardSupported || copyStatus === "copying"}>{copyStatus === "copying" ? "Copying…" : copyStatus === "copied" ? "Copied" : "Copy PNG"}</button></div>
              {!clipboardSupported && <p className="support-note">Image clipboard is not available in this browser.</p>}
            </>
          ) : <EmptyResult>Capture the natural long page to inspect the exact PNG returned by <code>captureFullPageScreenshot()</code>.</EmptyResult>}
        </div>
      </section>
    </>
  );
}

function SelectRegionPage({ info, onBack }: { info: PageInfo; onBack: () => void }) {
  const [region, setRegion] = useState<RegionSelection | null>(null);
  const [ran, setRan] = useState(false);
  const choose = async () => {
    const selected = await selectRegion({ confirmLabel: "Use region", hintText: "Drag to select any part of this page" });
    setRan(true);
    setRegion(selected);
  };
  return (
    <main className="module-page region-demo-page">
      <PageHeader info={info} onBack={onBack} />
      <ContextBlock info={info} label="SINGLE MODULE" title="Drag, confirm, inspect" />
      <section className="region-fixture" aria-label="Region selection test surface">
        <div className="region-fixture-copy"><p>SELECTION SURFACE</p><h3>Pick any useful rectangle.</h3><span>Try the schedule, the notes, or just one row. The module returns document coordinates; it does not decide what they mean.</span></div>
        <div className="region-board">
          <div><span>08:30</span><strong>Review field notes</strong></div>
          <div><span>11:00</span><strong>Pack the trail bag</strong></div>
          <div><span>15:15</span><strong>Meet at the north dock</strong></div>
        </div>
      </section>
      <button className="run-button" type="button" onClick={() => void choose()}><span className="button-icon corners" aria-hidden="true" />Select region</button>
      <section className="result-panel region-result" aria-live="polite">
        <h3>Reference output</h3>
        {region ? <><dl className="metrics"><div><dt>x</dt><dd>{Math.round(region.x)}</dd></div><div><dt>y</dt><dd>{Math.round(region.y)}</dd></div><div><dt>width</dt><dd>{Math.round(region.width)}</dd></div><div><dt>height</dt><dd>{Math.round(region.height)}</dd></div></dl><pre>{JSON.stringify(region, null, 2)}</pre></> : <EmptyResult icon="region">{ran ? "Selection cancelled. Select a region to generate coordinate JSON." : "Tap Select region, drag a rectangle, then confirm it."}</EmptyResult>}
      </section>
    </main>
  );
}

function RegionScreenshotPage({ info, onBack }: { info: PageInfo; onBack: () => void }) {
  const [region, setRegion] = useState<RegionSelection | null>(null);
  const [status, setStatus] = useState<CaptureState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState<FullPageScreenshotMeasurement | null>(null);
  const [error, setError] = useState("");

  const selectAndCapture = async () => {
    setError("");
    const selected = await selectRegion({ confirmLabel: "Capture region", hintText: "Drag over the part you want to capture" });
    if (!selected) return;
    setRegion(selected); setStatus("capturing");
    try {
      const result = await captureFullPageScreenshot(html2canvas, { region: selected, maxPixelArea: 8_000_000 });
      setPreviewUrl(await blobToPreviewDataUrl(result.blob));
      setMeasurement(result.measurement);
      setStatus("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The region could not be captured.");
      setStatus("failed");
    }
  };

  return (
    <main className="module-page integration-page">
      <PageHeader info={info} onBack={onBack} eyebrow="INTEGRATION TEST" />
      <ContextBlock info={info} label="TWO-MODULE PIPELINE" title="Select first. Crop second." />
      <section className="integration-fixture" aria-label="Trip planning selection surface">
        <div className="integration-fixture-header"><p>WEEKEND PLAN</p><h3>Three stops, one light bag.</h3></div>
        <div className="integration-stops">
          <article><span>01</span><div><strong>Harbor coffee</strong><p>08:00 · Window table</p></div><b>35 min</b></article>
          <article><span>02</span><div><strong>Cedar loop</strong><p>09:15 · North trailhead</p></div><b>2.4 mi</b></article>
          <article><span>03</span><div><strong>Ferry home</strong><p>15:40 · Pier 2</p></div><b>Booked</b></article>
        </div>
      </section>
      <button className="run-button" type="button" onClick={() => void selectAndCapture()} disabled={status === "capturing"}><span className="button-icon corners" aria-hidden="true" />{status === "capturing" ? "Cropping selection…" : "Select and capture region"}</button>
      {error && <div className="error-result" role="status"><strong>The test did not finish</strong><p>{error}</p></div>}
      <div className="integration-output-grid">
        <section className="result-panel"><h3>Selected region</h3>{region ? <pre>{JSON.stringify(region, null, 2)}</pre> : <EmptyResult icon="region">The rectangle from <code>selectRegion()</code> will appear here.</EmptyResult>}</section>
        <section className="result-panel"><h3>Cropped screenshot</h3><ScreenshotOutput previewUrl={previewUrl} measurement={measurement} filename="selected-region.png" emptyCopy="The cropped PNG will appear after you confirm a selection." /></section>
      </div>
    </main>
  );
}

function AiIdentificationPage({ info, onBack }: { info: PageInfo; onBack: () => void }) {
  const pageRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<"idle" | "capturing" | "analyzing" | "done" | "failed">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState<FullPageScreenshotMeasurement | null>(null);
  const [objects, setObjects] = useState<IdentifiedObject[]>([]);
  const [error, setError] = useState("");
  const identify = async () => {
    const root = pageRef.current;
    if (!root || status === "capturing" || status === "analyzing") return;
    setStatus("capturing"); setObjects([]); setError("");
    try {
      const captured = await captureFullPageScreenshot(html2canvas, { root, maxPixelArea: 8_000_000 });
      const dataUrl = await blobToPreviewDataUrl(captured.blob);
      setPreviewUrl(dataUrl); setMeasurement(captured.measurement); setStatus("analyzing");
      const commaIndex = dataUrl.indexOf(",");
      if (commaIndex < 0) throw new Error("The captured PNG could not be encoded.");
      const result = await api.identifyScreenshotObjects({ data_base64: dataUrl.slice(commaIndex + 1) });
      setObjects(result.objects); setStatus("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI identification did not finish.");
      setStatus("failed");
    }
  };
  return (
    <>
      <div className="module-page screenshot-module-header"><PageHeader info={info} onBack={onBack} eyebrow="INTEGRATION TEST" /></div>
      <StorefrontScene pageRef={pageRef} captureRoot />
      <section className="module-page capture-controls" aria-labelledby="ai-title">
        <div className="test-heading"><div><p className="section-label">SCREENSHOT → AI</p><h2 id="ai-title">Identify what is visible</h2></div><span className="run-state">{status === "done" ? `${objects.length} items` : status === "capturing" ? "Capturing" : status === "analyzing" ? "Analyzing" : status === "failed" ? "Failed" : "Ready"}</span></div>
        <button className="ai-identify-button" type="button" onClick={() => void identify()} disabled={status === "capturing" || status === "analyzing"}><span className="ai-scan-icon" aria-hidden="true" />{status === "capturing" ? "Capturing…" : status === "analyzing" ? "AI is looking…" : "Identify screenshot objects"}</button>
        {error && <div className="error-result" role="status"><strong>The test did not finish</strong><p>{error}</p></div>}
        <div className="result-grid ai-integration-results">
          <section className="result-panel page-result" aria-live="polite"><h3>Screenshot sent to AI</h3><ScreenshotOutput previewUrl={previewUrl} measurement={measurement} filename="northline-ai-input.png" emptyCopy="Run the integration to create the exact PNG that will be sent to Muse AI." /></section>
          <section className="result-panel ai-result-panel" aria-live="polite"><div className="result-panel-title"><h3>AI-identified elements</h3>{status === "done" && <span>{objects.length}</span>}</div>{status === "capturing" || status === "analyzing" ? <div className="ai-loading"><span aria-hidden="true" /><strong>{status === "capturing" ? "Creating the screenshot" : "Reading the screenshot"}</strong><p>The same PNG shown at left is sent to Muse AI.</p></div> : objects.length ? <ol className="identified-list">{objects.map((object, index) => <li key={`${object.name}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{object.name}</strong><p>{object.description}</p></div></li>)}</ol> : <EmptyResult icon="ai">Capture the page, then identify visible objects and UI elements from the PNG.</EmptyResult>}</section>
        </div>
      </section>
    </>
  );
}

function PageCard({ info, index, onOpen }: { info: PageInfo; index: number; onOpen: (id: PageId) => void }) {
  return (
    <button className="module-card" type="button" onClick={() => onOpen(info.id)}>
      <span className="module-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="module-version">{info.version ? `v${info.version}` : info.modules}</span>
      <strong>{info.name}</strong>
      <code>{info.packageName}</code>
      <span className="module-purpose">{info.purpose}</span>
      <span className="module-open">Open verification page <b aria-hidden="true">→</b></span>
    </button>
  );
}

function HomePage({ onOpen }: { onOpen: (id: PageId) => void }) {
  return (
    <>
      <header className="verifier-intro"><p className="eyebrow">REFERENCE IMPLEMENTATION HARNESS</p><h1>Test one contract—or the seams between them.</h1><p className="intro-copy">Each route runs the real vendored reference. Integration routes keep orchestration in the app layer.</p></header>
      <main className="module-list">
        <section className="home-section" aria-labelledby="modules-title"><div className="list-intro"><div><p className="section-label">IN ISOLATION</p><h2 id="modules-title">Modules</h2></div><p>One reference at a time.</p></div><div className="module-grid module-grid-three">{modulePages.map((info, index) => <PageCard key={info.id} info={info} index={index} onOpen={onOpen} />)}</div></section>
        <section className="home-section integration-home-section" aria-labelledby="integration-title"><div className="list-intro"><div><p className="section-label">COMPOSED IN THE APP</p><h2 id="integration-title">Integration tests</h2></div><p>Cross-module pipelines.</p></div><div className="module-grid">{integrationPages.map((info, index) => <PageCard key={info.id} info={info} index={index} onOpen={onOpen} />)}</div></section>
      </main>
    </>
  );
}

export function App() {
  const [pageId, setPageId] = useState<PageId | null>(null);
  const info = [...modulePages, ...integrationPages].find((item) => item.id === pageId);
  const goHome = () => { setPageId(null); window.scrollTo({ top: 0, behavior: "instant" }); };
  let page: ReactNode = <HomePage onOpen={(id) => { setPageId(id); window.scrollTo({ top: 0, behavior: "instant" }); }} />;
  if (info?.id === "annotate-image") page = <AnnotateImagePage info={info} onBack={goHome} />;
  else if (info?.id === "full-page-screenshot") page = <FullPageScreenshotPage info={info} onBack={goHome} />;
  else if (info?.id === "select-region") page = <SelectRegionPage info={info} onBack={goHome} />;
  else if (info?.id === "region-screenshot") page = <RegionScreenshotPage info={info} onBack={goHome} />;
  else if (info?.id === "ai-identification") page = <AiIdentificationPage info={info} onBack={goHome} />;
  return <div className="verifier-shell"><SafeAreaTopScrim backgroundColor="var(--ink)" />{page}</div>;
}
