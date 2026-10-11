import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { createExternalPreviewRuntime, ExternalPreviewError } from "@takazudo/zudo-sg/preview/runtime";
import type { SerializableProps, ExternalRuntimeError } from "@takazudo/zudo-sg/preview/external-runtime";
import { loaders } from "./loaders";
import { editorProbe, resources, setReporter } from "./probe";
// @ts-expect-error Monaco internal sanitizer is intentionally checked by this integration fixture.
import { sanitizeHtml } from "monaco-editor/base/browser/domSanitize.js";
import "./styles.css";

class Boundary extends Component<{ children: ReactNode; report: (error: ExternalRuntimeError) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, _info: ErrorInfo) { this.props.report({ code: "render", message: error.message, recoverable: true }); }
  render() { return this.state.failed ? null : this.props.children; }
}
const runtime = createExternalPreviewRuntime({
  fullReset: true,
  onTheme(theme) { document.documentElement.dataset.theme = theme; },
  async mount(context) {
    const key = JSON.stringify([context.identity.slug, context.identity.variant]);
    const load = loaders[key];
    if (!load) throw new ExternalPreviewError("unknown-fixture", `Unknown fixture: ${key}`);
    await new Promise(resolve => setTimeout(resolve, Number(new URLSearchParams(location.search).get("delay") ?? 150)));
    if (context.signal.aborted) return { update() {}, dispose() {} };
    if (context.props.failure === "import") {
      const missing = new URL("./deliberately-missing.js", import.meta.url).href;
      try { await import(/* @vite-ignore */ missing); } catch { throw new ExternalPreviewError("import", "Deliberate fixture import failure"); }
    }
    const Fixture = await load();
    resources.importsResolved++;
    if (context.signal.aborted) return { update() {}, dispose() {} };
    setReporter(context.reportError);
    const root = createRoot(document.getElementById("root")!, {
      onCaughtError() { /* Boundary reports expected render failures to the public runtime. */ },
    });
    let revision = 0;
    let previousFailure: unknown;
    function render(props: SerializableProps) {
      if (previousFailure === "render" && props.failure !== "render") revision++;
      previousFailure = props.failure;
      flushSync(() => root.render(<Boundary key={revision} report={context.reportError}><Fixture {...props} variant={context.identity.variant} /></Boundary>));
    }
    render(context.props);
    return { update(props) { render(props); editorProbe.assertHealthy(); }, dispose() { flushSync(() => root.unmount()); }, async whenStable() { await editorProbe.stable(); await document.fonts.ready; } };
  },
});
Object.assign(window, { fixture: { runtime, resources, editor: editorProbe, sanitize: (html: string) => String(sanitizeHtml(html)) } });
