// Route path for the isolated preview iframe, served by
// `pages/components/preview.tsx`. VariantFrame builds each iframe's `src`
// from this constant; the code-panel's live-CSS injection selects those same
// iframes by matching this same substring (css-injection.ts). Importing one
// shared constant in both places turns a past regression (#48 — the selector
// silently drifting from the route) into something TypeScript enforces
// instead of a comment (#105).
export const PREVIEW_ROUTE_PATH = "/components/preview";
