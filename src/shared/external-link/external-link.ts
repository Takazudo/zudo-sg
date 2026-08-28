export type ExternalLinkAttrs = { target?: string; rel?: string };

/** Anchor attrs for an external link (target=_blank + rel=noopener noreferrer), or {} when not external. */
export function externalLinkAttrs(isExternal?: boolean): ExternalLinkAttrs {
  return isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

/** Glyph marking an outbound (external) transition. */
export const EXTERNAL_GLYPH = "↗";
/** Glyph marking an inbound (internal) transition. */
export const INTERNAL_GLYPH = "→";
