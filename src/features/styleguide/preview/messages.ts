// postMessage protocol between the parent catalog page and a variant preview
// iframe.
//
// Two directions:
//   parent → iframe : MSG_UPDATE_PROPS  (live control values from the controls panel)
//                     + MSG_SET_THEME     (resolved catalog theme)
//   iframe → parent : MSG_READY         (the parent may start sending messages)
//                     + MSG_HEIGHT        (content height, so the parent auto-sizes the iframe)
//
// Design-token tweaks reach the iframe via a SEPARATE channel — the
// project-owned iframe-css-vars bridge (`apply-css-vars` envelope) — not
// these messages. See
// src/features/styleguide/token-tweak/iframe-css-vars-bridge.ts.

export const MSG_UPDATE_PROPS = "sg:updateProps" as const;
export const MSG_SET_THEME = "sg:setTheme" as const;
export const MSG_READY = "sg:ready" as const;
export const MSG_HEIGHT = "sg:height" as const;

export type PreviewTheme = "light" | "dark";

export interface UpdatePropsMessage {
  type: typeof MSG_UPDATE_PROPS;
  /** Prop name → value, merged over the variant's static props on re-render. */
  props: Record<string, unknown>;
}

export interface HeightMessage {
  type: typeof MSG_HEIGHT;
  height: number;
}

export interface SetThemeMessage {
  type: typeof MSG_SET_THEME;
  /** A resolved theme. The frame must never receive the unresolved `auto`. */
  theme: PreviewTheme;
}

export interface ReadyMessage {
  type: typeof MSG_READY;
}

export type ParentToPreviewMessage = UpdatePropsMessage | SetThemeMessage;
export type PreviewToParentMessage = ReadyMessage | HeightMessage;
export type PreviewMessage = ParentToPreviewMessage | PreviewToParentMessage;

export function isUpdatePropsMessage(value: unknown): value is UpdatePropsMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as UpdatePropsMessage).type === MSG_UPDATE_PROPS &&
    typeof (value as UpdatePropsMessage).props === "object"
  );
}

export function isHeightMessage(value: unknown): value is HeightMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as HeightMessage).type === MSG_HEIGHT &&
    typeof (value as HeightMessage).height === "number"
  );
}

export function isSetThemeMessage(value: unknown): value is SetThemeMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as SetThemeMessage).type === MSG_SET_THEME &&
    ((value as SetThemeMessage).theme === "light" ||
      (value as SetThemeMessage).theme === "dark")
  );
}

export function isReadyMessage(value: unknown): value is ReadyMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ReadyMessage).type === MSG_READY
  );
}
