// @takazudo/zudo-sg/token-tweak — preview token panel config, iframe bridge
// and iframe registry. The two islands live on their own subpaths
// (`/token-tweak/preview-token-panel-bootstrap`, `/token-tweak/preview-tokens-button`)
// so this barrel never pulls in the plugin's virtual module, a "use client"
// module, or zudo-doc's panel bootstrap (preview iframes import this barrel).

export {
  BRIDGE_SOURCE,
  installIframeReceiver,
  isBridgeMessage,
  onIframeReady,
  sendApplyCssVars,
  sendClearCssVars,
} from "./iframe-css-vars-bridge.js";
export type {
  ApplyCssVarsMessage,
  BridgeMessage,
  ClearCssVarsMessage,
  CssVarPair,
  ReadyMessage,
} from "./iframe-css-vars-bridge.js";
export {
  applyPreviewVars,
  clearPreviewVars,
  registerPreviewIframe,
  unregisterPreviewIframe,
} from "./preview-iframe-registry.js";
export {
  PREVIEW_TOKEN_PANEL_TOGGLE_EVENT,
  createPreviewTokenPanelConfig,
} from "./preview-token-panel-config.js";
export type {
  PreviewTokenPanelConfigOptions,
  PreviewTokenPanelManifest,
} from "./preview-token-panel-config.js";
export { drainPrehydrationToggle, installOwnerConsoleHelpers, loadZdtp } from "./token-panel-native-bootstrap.js";
