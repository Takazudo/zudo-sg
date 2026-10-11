import { ExternalPreviewError } from "@takazudo/zudo-sg/preview/runtime";
import type * as monaco from "monaco-editor/editor/editor.api.js";
import type { ExternalRuntimeError } from "@takazudo/zudo-sg/preview/external-runtime";
export const resources = { mounts: 0, disposals: 0, workers: 0, listeners: 0, observers: 0, portals: 0, validations: 0, resizeCalls: 0, importsResolved: 0 };
export let editor: monaco.editor.IStandaloneCodeEditor | undefined;
export let validation = Promise.resolve(0);
let assetFailed = false;
let validationRevision = 0;
export const editorProbe = {
  get value() { return editor?.getValue(); },
  get selection() { return editor?.getSelection(); },
  get focused() { return editor?.hasTextFocus(); },
  async setValue(value: string) { editor!.setValue(value); return validation; },
  select() { editor!.focus(); editor!.setSelection({ startLineNumber: 1, startColumn: 2, endLineNumber: 1, endColumn: 5 }); },
  assertHealthy() { if (assetFailed) throw new ExternalPreviewError("asset", "JSON worker asset failed to load"); },
  async stable() { let pending: Promise<number>; do { pending = validation; await pending; } while (pending !== validation); this.assertHealthy(); },
};

export function setEditor(value: typeof editor) { editor = value; validationRevision++; if (value) assetFailed = false; }
export function setValidation(value: Promise<number>) { const revision = ++validationRevision; validation = value.then(result => { if (revision === validationRevision && result < 0) assetFailed = true; return result; }); }
export let reportFailure = (_error: ExternalRuntimeError): void => {};
export function setReporter(report: typeof reportFailure) { reportFailure = report; }
