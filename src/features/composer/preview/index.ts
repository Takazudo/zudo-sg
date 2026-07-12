// Public surface of the Composer preview runtime (issue #248).
//
// PARENT-SIDE consumers (#251 central integration, #254 chooser live preview)
// need only this module. The typical mount is:
//
//   const location = buildComposerPreviewUrl();              // base-aware URL + exact origin
//   <iframe ref={ref} {...composerPreviewFrameProps(location)} />
//   const bridge = createComposerPreviewBridge({
//     frame: ref.current, targetOrigin: location.targetOrigin, hostWindow: window,
//     onSelect, onRequestAdd, onError,
//   });
//   bridge.render(document, { mode, theme, selectedId });    // revision minted here
//   bridge.updateSession({ mode, theme, selectedId });       // session-only change
//   bridge.dispose();                                        // on unmount
//
// The bridge is INSTANCE-SCOPED: two live previews (canvas + chooser) keep
// separate readiness, revision counters, and retained snapshots.
//
// The IFRAME-SIDE modules (`preview-app`, `renderer`, `client`, `preview-styles`)
// are imported by `pages/composer/preview.tsx`, not by the parent app.

export { COMPOSER_PREVIEW_ROUTE_PATH, COMPOSER_PREVIEW_IFRAME_TITLE } from "./route";

export {
  buildComposerPreviewUrl,
  composerPreviewFrameProps,
  createComposerPreviewBridge,
} from "./bridge";
export type {
  ComposerPreviewBridge,
  ComposerPreviewBridgeOptions,
  ComposerPreviewFrameProps,
  ComposerPreviewLocation,
  PreviewFrameLike,
} from "./bridge";

export {
  COMPOSER_PREVIEW_CHANNEL,
  COMPOSER_PREVIEW_PROTOCOL_VERSION,
  compositionDocumentSchema,
  compositionNodeSchema,
  insertionTargetSchema,
  previewSessionSchema,
  errorMessageSchema,
  modeMessageSchema,
  readyMessageSchema,
  renderMessageSchema,
  requestAddMessageSchema,
  selectMessageSchema,
  parentToPreviewSchema,
  previewToParentSchema,
  readParentToPreview,
  readPreviewToParent,
} from "./protocol";
export type {
  ErrorMessage,
  GuardFailure,
  GuardResult,
  MessageEventLike,
  MessagePoster,
  MessageTarget,
  ModeMessage,
  ParentToPreviewMessage,
  PreviewMode,
  PreviewSession,
  PreviewTheme,
  PreviewToParentMessage,
  ReadyMessage,
  RenderMessage,
  RequestAddMessage,
  SelectMessage,
} from "./protocol";

export type { PreviewState } from "./snapshot-store";
export { INITIAL_PREVIEW_STATE, applyInbound } from "./snapshot-store";
