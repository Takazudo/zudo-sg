// Pure helpers backing the structure rail (issue #250).
//
// The tree/chooser consume BOTH the derived host registry's RICHER entries
// (`ComposerManifestEntry` — src/styleguide/data/composer-registry.ts, title +
// category + description on top of the model's slot/field metadata) AND the
// model's `ComponentManifest`, because rows and chooser cards need
// human-readable titles the model-only `ComponentManifestEntry`
// (src/composer/model/types.ts) doesn't carry, while model traversal/
// diagnostic helpers (`classifyNode`, `findLocation`, `indexDocument`, ...)
// need the `ComponentManifest` `createManifest()` produces from those same
// entries. `ComposerManifestEntry` is a structural SUPERSET of
// `ComponentManifestEntry`, so the exact same array is assignable to
// `createManifest()` — one array, two projections. `createManifest` itself
// runs exactly ONCE, at the app layer (issue #290) — see `buildManifestIndex`
// below for why it is NOT called again here.
//
// Everything here is pure and DOM-free so it can be unit-tested directly,
// independent of the recursive tree-node rendering.

import type {
  ComponentManifest,
  CompositionDocument,
  CompositionNode,
  DocumentIndex,
} from "@/composer";
import { classifyNode, createManifest, findLocation, indexDocument } from "@/composer";
import type { ComposerManifestEntry } from "@/styleguide/data/composer-registry";

/**
 * Build the model's `ComponentManifest` index from the richer catalog array.
 * A thin `createManifest` pass-through — kept as a test/callsite convenience
 * for pure-function tests in this directory. NOT used by `ComposerTree` or
 * `ComposerChooser` themselves: `createManifest` runs ONCE, at the app layer
 * (`use-composer-integration.ts`), and that single `ComponentManifest` is
 * passed down as a prop so per-render/per-component re-derivation (and its
 * per-entry zod validation cost) doesn't happen 3x for identical input
 * (issue #290).
 */
export function buildManifestIndex(entries: readonly ComposerManifestEntry[]): ComponentManifest {
  return createManifest(entries);
}

/** Fast componentId → catalog entry lookup, for display metadata (title/category/description). */
export function buildCatalogById(
  entries: readonly ComposerManifestEntry[],
): Map<string, ComposerManifestEntry> {
  return new Map(entries.map((entry) => [entry.componentId, entry]));
}

export interface NodeSummary {
  /** Catalog title when known, else the raw componentId (unknown/opaque component). */
  title: string;
  /**
   * A short text preview drawn from a common scalar prop (`label`, `children`,
   * `heading`, `title`, in that order) when one holds a plain string — the row
   * distinguisher for duplicate component types (e.g. two Box leaves), mirroring
   * the prototype's own `nodeSummary` line. Null when nothing textual is set.
   */
  subtitle: string | null;
  opaque: boolean;
  /** Human-readable diagnostic reasons, joined — null when the node is not opaque. */
  reasonText: string | null;
}

const SUBTITLE_PROP_CANDIDATES = ["label", "children", "heading", "title"] as const;

function pickSubtitle(node: CompositionNode): string | null {
  for (const prop of SUBTITLE_PROP_CANDIDATES) {
    const value = node.props[prop];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.length > 60 ? `${value.slice(0, 57)}…` : value;
    }
  }
  return null;
}

/** Describe one node for row display: its title, text preview, and opaque/diagnostic status. */
export function summarizeNode(
  node: CompositionNode,
  manifest: ComponentManifest,
  catalogById: ReadonlyMap<string, ComposerManifestEntry>,
): NodeSummary {
  const diagnostic = classifyNode(node, manifest);
  const catalogEntry = catalogById.get(node.componentId);
  return {
    title: catalogEntry?.title ?? node.componentId,
    subtitle: pickSubtitle(node),
    opaque: diagnostic.opaque,
    reasonText: diagnostic.opaque ? diagnostic.reasons.map((r) => r.message).join("; ") : null,
  };
}

/** Total descendant count (not including the node itself). */
export function countDescendants(node: CompositionNode): number {
  let count = 0;
  for (const children of Object.values(node.slots)) {
    count += children.length;
    for (const child of children) count += countDescendants(child);
  }
  return count;
}

export interface SiblingBounds {
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/** Whether `nodeId` has a previous/next sibling in its own parent slot. */
export function siblingBounds(document: CompositionDocument, index: DocumentIndex, nodeId: string): SiblingBounds {
  const location = index.byId.get(nodeId);
  if (!location) return { canMoveUp: false, canMoveDown: false };
  const siblings =
    location.parentId === null
      ? document.root
      : (index.byId.get(location.parentId)?.node.slots[location.slotId] ?? []);
  return { canMoveUp: location.index > 0, canMoveDown: location.index < siblings.length - 1 };
}

/**
 * The ancestor chain of `nodeId`, NEAREST FIRST, inclusive of `nodeId` itself.
 * `parentId: null` (virtual root) yields `[]`. Shared by the chooser's
 * post-add "expand ancestors" step and available to future callers (e.g. a
 * later canvas-selection wave) that need the same ancestor math the
 * controller's own `reveal` action performs — see this module's header.
 */
export function ancestorChainIds(
  document: CompositionDocument,
  manifest: ComponentManifest,
  nodeId: string | null,
): string[] {
  if (nodeId === null) return [];
  const ids: string[] = [];
  let currentId: string | null = nodeId;
  while (currentId !== null) {
    ids.push(currentId);
    const location = findLocation(document, manifest, currentId);
    currentId = location ? location.parentId : null;
  }
  return ids;
}

/** Build the ephemeral document index once per render (shared by every row). */
export function buildDocumentIndex(document: CompositionDocument, manifest: ComponentManifest): DocumentIndex {
  return indexDocument(document, manifest);
}
