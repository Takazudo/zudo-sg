/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Mode-neutral catalog tile thumbnail (epic #879, E3). Branches on the
// entry's `source` BEFORE touching anything story-shaped, so a descriptor
// entry (which has no `variants[0].story` to render) never reaches the
// module-mode SSR path — see `component-thumb.tsx` (module mode, imports
// `preact-render-to-string`) and `descriptor-thumb.tsx` (descriptor mode,
// does not). This file is the only one that imports both.

import type { JSX } from "preact";
import type { CatalogEntry } from "../registry/catalog.js";
import { ComponentThumb } from "./component-thumb.js";
import { DescriptorThumb } from "./descriptor-thumb.js";

export interface CatalogThumbProps {
  entry: CatalogEntry;
  /** Site base, forwarded to `DescriptorThumb` to prefix a root-absolute `src`. Ignored for module entries. */
  base?: string;
}

/**
 * Catalog tile thumbnail for either registry mode. A module entry renders its
 * story inline through `ComponentThumb`; a descriptor entry renders its
 * `ThumbnailDescriptor` (image, placeholder, or a labelled "missing" note)
 * through `DescriptorThumb`.
 */
export function CatalogThumb({ entry, base }: CatalogThumbProps): JSX.Element {
  if (entry.source === "module") return <ComponentThumb entry={entry.storyEntry} />;
  return <DescriptorThumb entry={entry} base={base} />;
}

CatalogThumb.displayName = "CatalogThumb";
