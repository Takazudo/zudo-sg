// postMessage protocol between the parent catalog page and a variant preview
// iframe.
//
// Two directions:
//   parent → iframe : MSG_REQUEST_READY (recover a one-shot ready race)
//                     + MSG_UPDATE_PROPS  (live control values from the controls panel)
//                     + MSG_SET_THEME     (resolved catalog theme)
//   iframe → parent : MSG_READY         (the parent may start sending messages)
//                     + MSG_HEIGHT        (content height, so the parent auto-sizes the iframe)
//
// Design-token tweaks reach the iframe via a SEPARATE channel — the
// project-owned iframe-css-vars bridge (`apply-css-vars` envelope) — not
// these messages. See
// ../token-tweak/iframe-css-vars-bridge.ts.
//
// Framework-free on purpose: this module is also published on its own as
// `@takazudo/zudo-sg/preview/messages` so a preview frame written in any
// framework (or none) can speak the protocol without pulling in Preact. It
// must never import anything — keep it a leaf module.
//
// Protocol v1 rules (#880):
//   - every message the engine sends carries `v: PROTOCOL_VERSION`;
//   - a message with `v === 1` is v1; a message with NO `v` is accepted as
//     legacy v1 (pre-0.4 frames keep working); any other `v` is rejected;
//   - `sg:ready` / `sg:height` may carry the frame's `{ slug, variant }`
//     identity so the parent can drop a report from a stale document;
//   - both sides post to their own origin (never `"*"`) and accept a message
//     only when its origin matches and its source is the expected window.

/** The preview postMessage protocol version this engine speaks. */
export const PROTOCOL_VERSION = 1 as const;
export type ProtocolVersion = typeof PROTOCOL_VERSION;

export const MSG_UPDATE_PROPS = "sg:updateProps" as const;
export const MSG_SET_THEME = "sg:setTheme" as const;
export const MSG_REQUEST_READY = "sg:requestReady" as const;
export const MSG_READY = "sg:ready" as const;
export const MSG_HEIGHT = "sg:height" as const;

export type PreviewTheme = "light" | "dark";

/** Fields every protocol message may carry. Absent `v` means legacy v1. */
export interface VersionedMessage {
  v?: ProtocolVersion;
}

/**
 * The frame's identity, read from its `?slug=…&variant=…` query. Optional on
 * the wire: a legacy frame omits it, and the parent then relies on the origin
 * and source checks alone.
 */
export interface PreviewIdentity {
  slug?: string;
  variant?: string;
}

export interface UpdatePropsMessage extends VersionedMessage {
  type: typeof MSG_UPDATE_PROPS;
  /** Prop name → value, merged over the variant's static props on re-render. */
  props: Record<string, unknown>;
}

export interface RequestReadyMessage extends VersionedMessage {
  type: typeof MSG_REQUEST_READY;
}

export interface HeightMessage extends VersionedMessage, PreviewIdentity {
  type: typeof MSG_HEIGHT;
  height: number;
}

export interface SetThemeMessage extends VersionedMessage {
  type: typeof MSG_SET_THEME;
  /** A resolved theme. The frame must never receive the unresolved `auto`. */
  theme: PreviewTheme;
}

export interface ReadyMessage extends VersionedMessage, PreviewIdentity {
  type: typeof MSG_READY;
}

export type ParentToPreviewMessage =
  | RequestReadyMessage
  | UpdatePropsMessage
  | SetThemeMessage;
export type PreviewToParentMessage = ReadyMessage | HeightMessage;
export type PreviewMessage = ParentToPreviewMessage | PreviewToParentMessage;

/**
 * True when `value` is an object whose `v` is this protocol's version or is
 * absent (legacy v1). Any other `v` — including a future `2` — is rejected.
 */
export function isSupportedProtocolVersion(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const v = (value as VersionedMessage).v;
  return v === undefined || v === PROTOCOL_VERSION;
}

function hasType(value: unknown, type: string): boolean {
  return (
    isSupportedProtocolVersion(value) && (value as { type?: unknown }).type === type
  );
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function hasWellFormedIdentity(value: unknown): boolean {
  const { slug, variant } = value as PreviewIdentity;
  return isOptionalString(slug) && isOptionalString(variant);
}

/**
 * True unless the message names a `slug` or `variant` that differs from
 * `current`. A message without identity (a legacy frame) matches.
 */
export function matchesPreviewIdentity(
  message: PreviewIdentity,
  current: { slug: string; variant: string },
): boolean {
  if (message.slug !== undefined && message.slug !== current.slug) return false;
  if (message.variant !== undefined && message.variant !== current.variant) {
    return false;
  }
  return true;
}

export function isRequestReadyMessage(
  value: unknown,
): value is RequestReadyMessage {
  return hasType(value, MSG_REQUEST_READY);
}

export function isUpdatePropsMessage(value: unknown): value is UpdatePropsMessage {
  const props = (value as UpdatePropsMessage | null)?.props;
  return (
    hasType(value, MSG_UPDATE_PROPS) && typeof props === "object" && props !== null
  );
}

export function isHeightMessage(value: unknown): value is HeightMessage {
  return (
    hasType(value, MSG_HEIGHT) &&
    typeof (value as HeightMessage).height === "number" &&
    hasWellFormedIdentity(value)
  );
}

export function isSetThemeMessage(value: unknown): value is SetThemeMessage {
  const theme = (value as SetThemeMessage | null)?.theme;
  return hasType(value, MSG_SET_THEME) && (theme === "light" || theme === "dark");
}

export function isReadyMessage(value: unknown): value is ReadyMessage {
  return hasType(value, MSG_READY) && hasWellFormedIdentity(value);
}
