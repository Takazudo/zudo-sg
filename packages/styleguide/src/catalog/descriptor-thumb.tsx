/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Descriptor-mode catalog thumbnails (epic #879, E3). A descriptor-mode
// registry has no story to render server-side (its stories may come from a
// foreign framework), so a tile here is built from the `ThumbnailDescriptor`
// the host supplied instead — a pre-captured image, a labelled placeholder,
// or, when the host gave nothing at all, a labelled "missing" note. Never a
// blank tile.
//
// This module deliberately imports NOTHING from `preact-render-to-string` (or
// anything that pulls it in). That keeps the split from `component-thumb.tsx`
// visible in the file graph, not just in a runtime `if`: the module-mode SSR
// renderer lives in one file, the descriptor branch in another, and only
// `catalog-thumb.tsx` ever imports both.

import type { JSX } from "preact";
import type { DescriptorCatalogEntry } from "../registry/catalog.js";

/** Note shown when a descriptor declares no `thumbnail` at all. */
export const DESCRIPTOR_THUMB_MISSING_NOTE = "No thumbnail provided";

/**
 * Prefixes a root-absolute thumbnail `src` with the site base, the same way
 * `withBase` does for route hrefs (`routes/_context.ts`). A relative or
 * absolute-URL `src` is left untouched. Kept local rather than importing
 * `withBase`: this package has no access to the route layer's
 * `virtual:zudo-sg-context` module (ADR decision 10), so the route calling
 * `CatalogThumb` passes its own resolved base in instead.
 */
function withThumbBase(base: string, src: string): string {
  if (!src.startsWith("/")) return src;
  return base.replace(/\/+$/, "") + src;
}

function DescriptorThumbNote({ note }: { note: string }): JSX.Element {
  return (
    <div class="sg-thumb" data-sg-preview-scope data-sg-thumb-note aria-hidden="true" inert>
      <p class="sg-thumb-note">{note}</p>
    </div>
  );
}

export interface DescriptorThumbProps {
  entry: DescriptorCatalogEntry;
  /** Site base to prefix a root-absolute image `src` with. Defaults to no prefix. */
  base?: string;
}

/**
 * One descriptor-mode tile's thumbnail slot. Mirrors `ComponentThumb`'s
 * `aria-hidden` + `inert` wrapper so both registry modes keep decorative
 * snapshots out of the tab order and the accessibility tree the same way.
 */
export function DescriptorThumb({ entry, base = "" }: DescriptorThumbProps): JSX.Element {
  const thumbnail = entry.thumbnail;

  if (!thumbnail) return <DescriptorThumbNote note={DESCRIPTOR_THUMB_MISSING_NOTE} />;
  if (thumbnail.kind === "placeholder") return <DescriptorThumbNote note={thumbnail.note} />;

  return (
    <div class="sg-thumb" data-sg-preview-scope data-sg-thumb-image aria-hidden="true" inert>
      <img
        class="sg-thumb-img"
        src={withThumbBase(base, thumbnail.src)}
        width={thumbnail.width}
        height={thumbnail.height}
        alt={thumbnail.alt ?? ""}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

DescriptorThumb.displayName = "DescriptorThumb";
