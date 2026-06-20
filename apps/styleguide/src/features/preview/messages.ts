// postMessage protocol between the parent catalog page and a variant preview
// iframe.
//
// Two channels:
//   parent → iframe : MSG_UPDATE_PROPS  (live control values from the controls panel)
//   iframe → parent : MSG_HEIGHT        (content height, so the parent auto-sizes the iframe)
//
// Design-token tweaks reach the iframe via a SEPARATE channel — zudo-doc's
// theme iframe-bridge (`apply-css-vars` envelope) — not these messages. See
// src/features/token-tweak/preview-iframe-registry.ts.

export const MSG_UPDATE_PROPS = "sg:updateProps" as const;
export const MSG_HEIGHT = "sg:height" as const;

export interface UpdatePropsMessage {
  type: typeof MSG_UPDATE_PROPS;
  /** Prop name → value, merged over the variant's static props on re-render. */
  props: Record<string, unknown>;
}

export interface HeightMessage {
  type: typeof MSG_HEIGHT;
  height: number;
}

export type PreviewMessage = UpdatePropsMessage | HeightMessage;

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
