import { captureFullPageScreenshot, copyFullPageScreenshot, supportsImageClipboard, type FullPageScreenshotMeasurement } from "@muse-app-vibe-kit/full-page-screenshot";
import { openAnnotator, type AnnotateResult } from "@muse-app-vibe-kit/annotate-image";
import html2canvas from "html2canvas";
import { useEffect, useRef, useState } from "react";
import { installConsoleCapture, installErrorCapture, installNetworkCapture, recordDiagnostic } from "./diagnostics";
import { assembleReportBundle } from "./reportBundle";
import { DEV_PANEL_SPEC_VERSION, type CategoryOption, type DeveloperPanelProps } from "./types";

export { DEV_PANEL_SPEC_VERSION };

const DEFAULT_CATEGORIES: CategoryOption[] = [
  { value: "broken", label: "Broken" },
  { value: "hard-to-use", label: "Hard to use" },
  { value: "suggestion", label: "Suggestion" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
];

/** Reordered report flow: capture -> annotate -> describe -> submit. */
type ReportStage = "idle" | "capturing" | "describing" | "submitting";
type BusyAction = "capture" | "report" | null;

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] as number);
  return btoa(s);
}

function describeElement(element: HTMLElement): string {
  if (element.id) return `#${element.id}`;
  if (element === document.documentElement) return "html";
  if (element === document.body) return "body";
  const classes = Array.from(element.classList).slice(0, 2).join(".");
  return classes ? `${element.tagName.toLowerCase()}.${classes}` : element.tagName.toLowerCase();
}

function screenshotMeasurementText(m: FullPageScreenshotMeasurement): string {
  const png = m.outputWidth !== null && m.outputHeight !== null ? `${m.outputWidth} × ${m.outputHeight}px` : "not produced";
  return `scroll root: ${m.scrollContainer}; container: ${m.containerWidth} × ${m.containerHeight}px; viewport: ${m.viewportWidth} × ${m.viewportHeight}px; PNG: ${png}; scale: ${m.scale.toFixed(3)}`;
}

function DefaultToast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="dev-panel-toast" role="status">{message}</div>;
}

export function DeveloperPanel({ wiring, viewLabel, appVersion, instrumentation, categories, say, className }: DeveloperPanelProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [reportShortId, setReportShortId] = useState<string | null>(null);
  const [reportStage, setReportStage] = useState<ReportStage>("idle");
  const [reportShot, setReportShot] = useState<string | null>(null);
  const [reportDescription, setReportDescription] = useState("");
  const [reportCategory, setReportCategory] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Synchronous single-flight guard: rapid double-taps must not start two flows.
  const reportFlowRef = useRef(false);
  const warnedLabelRef = useRef(false);

  const speak = (message: string) => {
    if (say) { say(message); return; }
    setToast(message);
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 3200);
  };

  // Opt-in instrumentation. WHAT to log is the integrator's decision —
  // the module only provides the plumbing. Defaults: everything off.
  useEffect(() => {
    const uninstalls: Array<() => void> = [];
    if (instrumentation?.console) uninstalls.push(installConsoleCapture());
    if (instrumentation?.network) uninstalls.push(installNetworkCapture());
    if (instrumentation?.errors) uninstalls.push(installErrorCapture());
    return () => { for (const u of uninstalls) { try { u(); } catch { /* noop */ } } };
  }, [instrumentation?.console, instrumentation?.network, instrumentation?.errors]);

  useEffect(() => {
    if (!viewLabel && !warnedLabelRef.current) {
      warnedLabelRef.current = true;
      console.warn("[developer-panel] viewLabel is empty — the report bundle's route field will be blank. Pass a stable per-screen name.");
    }
  }, [viewLabel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  const categoryOptions = categories?.length ? categories : DEFAULT_CATEGORIES;

  const startReport = async () => {
    if (busy || reportFlowRef.current) return;
    reportFlowRef.current = true;
    setReportShortId(null);
    setBusy("report");
    setOpen(false);
    setReportStage("capturing");
    try {
      const captureRoot = document.body;
      recordDiagnostic("info", ["Report screenshot started"]);
      const captured = await captureFullPageScreenshot(html2canvas, {
        root: captureRoot,
        hideSelectors: [".dev-panel-anchor", ".dev-panel-dismiss"],
        maxPixelArea: 4_000_000,
        onWarning: (message, detail) => recordDiagnostic("warning", [message, detail]),
      });
      const dataBase64 = bytesToBase64(new Uint8Array(await captured.blob.arrayBuffer()));
      recordDiagnostic("info", ["Report screenshot succeeded —", screenshotMeasurementText(captured.measurement)]);

      const annotation = await new Promise<AnnotateResult>((resolve) => {
        openAnnotator({
          image: `data:image/png;base64,${dataBase64}`,
          title: "Mark the screenshot",
          hint: "Draw what should change (or Skip)",
          zIndex: 2147483640,
          onComplete: resolve,
        });
      });
      wiring.trackEvent("report_annotation_completed", { strokes: annotation.strokes, skipped: annotation.skipped });
      setReportShot(annotation.dataBase64);
      setReportDescription("");
      setReportCategory(null);
      setReportStage("describing");
      setOpen(true);
    } catch (error) {
      recordDiagnostic("error", ["Report screenshot failed —", error]);
      speak("Couldn’t capture the screenshot. Please try again.");
      setReportStage("idle");
      setOpen(true);
    } finally {
      setBusy(null);
      reportFlowRef.current = false;
    }
  };

  const submitReport = async () => {
    const description = reportDescription.trim();
    if (!description || !reportShot || reportStage !== "describing") return;
    setReportStage("submitting");
    try {
      const bundle = assembleReportBundle({
        view: viewLabel,
        appVersion,
        events: wiring.getEvents(),
      });
      const result = await wiring.submitReport({
        description,
        ...(reportCategory ? { category: reportCategory } : {}),
        route: viewLabel,
        app_version: appVersion,
        data_base64: reportShot,
        debug_bundle: JSON.stringify(bundle),
      });
      wiring.trackEvent("report_submitted", { report_id: result.short_id ?? null, view: viewLabel });
      recordDiagnostic("info", ["Change request submitted", viewLabel, result.short_id ?? "without short ID"]);
      setReportShortId(result.short_id ?? null);
      setReportShot(null);
      setReportDescription("");
      setReportCategory(null);
      setReportStage("idle");
      speak(result.short_id ? `Change request sent. ID ${result.short_id}.` : "Change request sent with a screenshot.");
    } catch (error) {
      recordDiagnostic("error", ["Change request failed —", error]);
      wiring.recordDiagnostic("error", ["Change request failed", error]);
      speak("Couldn’t send the change request. Your description is kept — try again.");
      setReportStage("describing");
    }
  };

  const capture = async () => {
    if (busy) return;
    if (!supportsImageClipboard()) {
      recordDiagnostic("error", ["Screenshot failed — image clipboard unsupported in this browser"]);
      speak("This browser can’t copy images to the clipboard.");
      return;
    }
    setBusy("capture");
    setOpen(false);
    try {
      const measurement = await copyFullPageScreenshot(html2canvas, {
        root: document.body,
        hideSelectors: [".dev-panel-anchor", ".dev-panel-dismiss"],
        onWarning: (message, detail) => recordDiagnostic("warning", [message, detail]),
      });
      recordDiagnostic("info", ["Screenshot succeeded —", screenshotMeasurementText(measurement)]);
      speak("Full-page screenshot copied. Paste it into chat.");
    } catch (error) {
      recordDiagnostic("error", ["Screenshot failed —", error]);
      speak("Couldn’t copy the screenshot. Open the DEV panel for details.");
    } finally {
      setBusy(null);
    }
  };

  const describing = reportStage === "describing" || reportStage === "submitting";

  return <>
    {!say && <DefaultToast message={toast} />}
    {open && <button type="button" className="dev-panel-dismiss" aria-label="Close developer tools" onClick={() => setOpen(false)} />}
    <div className={`dev-panel-anchor${className ? ` ${className}` : ""}`}>
      {open && <aside className="dev-panel-card" aria-label="Developer panel">
        <header><span>DEV</span><strong>Developer panel</strong><button type="button" aria-label="Close developer panel" onClick={() => setOpen(false)}>×</button></header>

        <section className="dev-panel-section dev-report-section" aria-label="Report and screenshot">
          {!describing && <>
            <button type="button" className="dev-action-button dev-action-button-primary" onClick={() => void startReport()} disabled={busy !== null} aria-label="Report a problem">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 9h8M8 12h5" /></svg>
              <span>{busy === "report" ? "Capturing…" : "Report issue"}</span>
            </button>
            <button type="button" className="dev-action-button dev-action-button-secondary" onClick={() => void capture()} disabled={busy !== null} aria-label="Copy full-page screenshot to clipboard">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2" /><path d="m8 6 1.5-2h5L16 6M8.5 13a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0Z" /></svg>
              <span>{busy === "capture" ? "Copying…" : "Screenshot"}</span>
            </button>
            <p className="dev-report-hint">Tap Report issue → auto screenshot, straight to annotation.</p>
          </>}
          {describing && <>
            {reportShot && <div className="dev-report-thumb">
              <img src={`data:image/png;base64,${reportShot}`} alt="Annotated report screenshot" />
            </div>}
            <div className="dev-report-categories" role="radiogroup" aria-label="Issue category (optional)">
              {categoryOptions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={reportCategory === c.value}
                  className={`dev-report-category${reportCategory === c.value ? " is-selected" : ""}`}
                  onClick={() => {
                    const next = reportCategory === c.value ? null : c.value;
                    setReportCategory(next);
                    if (next) wiring.trackEvent("report_category_selected", { category: next });
                  }}
                  disabled={reportStage === "submitting"}
                >{c.label}</button>
              ))}
            </div>
            <textarea
              className="dev-report-description"
              value={reportDescription}
              onChange={(event) => setReportDescription(event.target.value)}
              placeholder="What should change? Describe it…"
              aria-label="Issue description"
              rows={4}
              maxLength={2000}
              disabled={reportStage === "submitting"}
            />
            <button
              type="button"
              className="dev-action-button dev-action-button-primary"
              onClick={() => void submitReport()}
              disabled={!reportDescription.trim() || reportStage === "submitting"}
            >
              <span>{reportStage === "submitting" ? "Sending…" : "Submit"}</span>
            </button>
          </>}
          {reportShortId && <section className="report-id-card" aria-label="Submitted report ID">
            <button type="button" className="report-id-close" aria-label="Dismiss report ID" onClick={() => setReportShortId(null)}>×</button>
            <span>Report sent</span>
            <code>{reportShortId}</code>
            <p>Paste this ID back in the chat.</p>
          </section>}
        </section>

        <footer className="dev-panel-version"><span>Build</span><code>{appVersion}</code></footer>
      </aside>}
      <button type="button" className="dev-panel-trigger" onClick={() => setOpen((value) => !value)} aria-label="Developer tools" title="Developer tools" aria-haspopup="dialog" aria-expanded={open} disabled={busy === "capture"}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
      </button>
    </div>
  </>;
}
