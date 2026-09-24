import { PREVIEW_TOKEN_PANEL_TOGGLE_EVENT } from "./preview-token-panel-config.js";

interface PreviewTokenPanelCaptureState {
  pending: number;
  ready: boolean;
  listener: EventListener;
}

type CaptureWindow = Window & {
  __sgPreviewTokenPanelCapture?: PreviewTokenPanelCaptureState;
};

/**
 * Inline, package-owned capture installed before a delayed panel island.
 * The state belongs to the window because an SPA may replace the script node
 * while retaining its header and event listeners.
 */
export const PREVIEW_TOKEN_PANEL_CAPTURE_SCRIPT =
  "(function(){" +
  "if(window.__sgPreviewTokenPanelCapture)return;" +
  "var state={pending:0,ready:false,listener:null};" +
  "state.listener=function(){if(!state.ready)state.pending++};" +
  `window.addEventListener(${JSON.stringify(PREVIEW_TOKEN_PANEL_TOGGLE_EVENT)},state.listener);` +
  "window.__sgPreviewTokenPanelCapture=state;" +
  "})();";

/** Embed before the load island when a host supplies its own header trigger. */
export function previewTokenPanelCaptureScript(): string {
  return PREVIEW_TOKEN_PANEL_CAPTURE_SCRIPT;
}

/** Returns whether the package capture was installed; replay runs after native bootstrap. */
export function drainPreviewTokenPanelCapture(): { installed: boolean; pending: number } {
  if (typeof window === "undefined") return { installed: false, pending: 0 };
  const captureWindow = window as CaptureWindow;
  const state = captureWindow.__sgPreviewTokenPanelCapture;
  if (!state) return { installed: false, pending: 0 };

  state.ready = true;
  window.removeEventListener(PREVIEW_TOKEN_PANEL_TOGGLE_EVENT, state.listener);
  const pending = state.pending;
  state.pending = 0;
  return { installed: true, pending };
}
