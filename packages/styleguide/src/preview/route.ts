// Default route path for the isolated preview iframe (ADR
// docs/adr/styleguide-engine.md decision 6, `routes.componentsPreview`).
// VariantFrame builds each iframe's `src` from the preview URL; the
// code-panel's live-CSS injection selects those same iframes by matching the
// same substring (css-injection.ts). Both default to this one constant, and
// hosts pass the same base-prefixed `previewUrl` to both islands, so the
// selector cannot silently drift from the route (#48, #105).
import { DEFAULT_SG_ROUTES } from "../sg-routes.js";

export const PREVIEW_ROUTE_PATH = DEFAULT_SG_ROUTES.componentsPreview;
