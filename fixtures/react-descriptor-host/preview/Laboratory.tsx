import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as monaco from "monaco-editor/editor/editor.api.js";
import type { SerializableProps } from "@takazudo/zudo-sg/preview/external-runtime";

import { resources, editor, setEditor, setValidation, reportFailure } from "./probe";

interface JsonProxy { doValidation(uri: string): Promise<monaco.editor.IMarkerData[]> }
export function Laboratory(props: SerializableProps) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [portal] = useState(() => {
    const node = document.createElement("section");
    node.dataset.fixturePortal = "";
    return node;
  });
  useLayoutEffect(() => {
    document.body.append(portal); resources.portals++;
    return () => { portal.remove(); resources.portals--; };
  }, [portal]);
  useLayoutEffect(() => { if (open) close.current?.focus(); }, [open]);
  useEffect(() => {
    resources.mounts++;
    let disposed = false;
    const report = reportFailure;
    const workerUrl = new URL("./json.worker.js", import.meta.url);
    const worker = new Worker(workerUrl, { type: "module", name: "fixture-json" });
    resources.workers++;
    let rejectWorker!: (error: Error) => void;
    const workerFailure = new Promise<never>((_, reject) => { rejectWorker = reject; });
    worker.onerror = event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (disposed) return;
      const failure = new Error("JSON worker asset failed to load");
      report({ code: "asset", message: failure.message, recoverable: true });
      rejectWorker(failure);
    };
    // Monaco 0.57's public createWebWorker takes an owned native Worker.
    // These two startup messages are the JSON worker's documented source handshake.
    worker.postMessage("ignore");
    worker.postMessage({ languageSettings: { validate: true, enableSchemaRequest: false }, languageId: "json", enableSchemaRequest: false });
    const client = monaco.editor.createWebWorker<JsonProxy>({ worker });
    const model = monaco.editor.createModel('{"hello": true}', "json", monaco.Uri.parse(`inmemory://fixture/${resources.mounts}.json`));
    const view = monaco.editor.create(container.current!, {
      model, automaticLayout: false, minimap: { enabled: false }, fontSize: 14,
      wordBasedSuggestions: "off", quickSuggestions: false, folding: false,
    });
    setEditor(view);
    const validate = () => {
      setValidation(Promise.race([workerFailure, client.withSyncedResources([model.uri]).then(proxy => proxy.doValidation(model.uri.toString()))]).then(markers => {
        if (!disposed) { monaco.editor.setModelMarkers(model, "fixture-json", markers); resources.validations++; }
        return markers.length;
      }).catch(error => {
        if (!disposed) report({ code: "asset", message: String(error), recoverable: true });
        return -1;
      }));
    };
    const change = model.onDidChangeContent(validate);
    const resize = () => { resources.resizeCalls++; view.layout(); };
    window.addEventListener("resize", resize); resources.listeners++;
    const observer = new ResizeObserver(resize); observer.observe(container.current!); resources.observers++;
    validate();
    return () => {
      disposed = true; rejectWorker(new Error("Fixture disposed")); change.dispose(); observer.disconnect(); resources.observers--;
      window.removeEventListener("resize", resize); resources.listeners--;
      view.dispose(); model.dispose(); client.dispose(); resources.workers--;
      if (editor === view) setEditor(undefined);
      resources.disposals++;
    };
  }, []);
  if (props.failure === "render") throw new Error("Deliberate React render failure");
  return <main data-react-fixture>
    <h1 data-fixture-label>{String(props.label ?? "React laboratory")}</h1>
    <p data-variant>{String(props.variant ?? "Default")}</p>
    <button data-counter onClick={() => setCount(value => value + 1)}>Count: {count}</button>
    <button data-open-portal ref={trigger} onClick={() => setOpen(true)}>Open portal</button>
    {open && createPortal(<div role="dialog" aria-label="React portal"><p>Portal count: {count}</p><button ref={close} data-close-portal onClick={() => { setOpen(false); trigger.current?.focus(); }}>Close portal</button></div>, portal)}
    <div ref={container} data-editor style={{ height: 240 }} />
    <span className="codicon codicon-check" aria-label="Editor font loaded" />
  </main>;
}
