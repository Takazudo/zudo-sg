// Pure helpers for the component chooser dialog (issue #250).
//
// Kept DOM-free so eligibility/search/filter logic is unit-testable directly,
// independent of the dialog's focus/capture mechanics — see
// `composer-chooser.tsx` for how these compose into the rendered dialog.

import type { ComponentManifest, CompositionDocument, InsertionTarget } from "@/composer";
import { findLocation } from "@/composer";
import type { ComposerManifestEntry } from "@/styleguide/data/composer-registry";

export interface ChooserEligibility {
  /** Catalog entries this target's slot can currently accept. */
  entries: ComposerManifestEntry[];
  /** Non-null when NOTHING can be added here (e.g. a single-cardinality slot already occupied). */
  blockedReason: string | null;
}

/**
 * Filter the catalog down to what `target` can currently accept: the virtual
 * root accepts anything (mirrors `@/composer`'s `addNode`); a real slot is
 * filtered by its `accepts` whitelist (undefined = any opted-in component) and
 * refuses everything when a `single`-cardinality slot already has a child.
 */
export function eligibleEntries(
  document: CompositionDocument,
  manifest: ComponentManifest,
  catalog: readonly ComposerManifestEntry[],
  target: InsertionTarget,
): ChooserEligibility {
  if (target.parentId === null) {
    return { entries: [...catalog], blockedReason: null };
  }

  const location = findLocation(document, manifest, target.parentId);
  if (!location) return { entries: [], blockedReason: "This destination no longer exists." };

  const entry = manifest.get(location.node.componentId);
  const slot = entry?.slots.find((s) => s.id === target.slotId);
  if (!entry || !slot) return { entries: [], blockedReason: "This destination is no longer available." };

  const children = location.node.slots[target.slotId] ?? [];
  if (slot.cardinality === "single" && children.length >= 1) {
    return { entries: [], blockedReason: "This slot already has a component." };
  }

  const filtered = catalog.filter((candidate) => !slot.accepts || slot.accepts.includes(candidate.componentId));
  return { entries: filtered, blockedReason: null };
}

/** Case-insensitive title/category/description substring match. */
export function matchesQuery(entry: ComposerManifestEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${entry.title} ${entry.category} ${entry.description}`.toLowerCase();
  return haystack.includes(q);
}

/** A human-readable label for the dialog title/status: "Document root" or "Parent › Slot". */
export function describeInsertionTarget(
  document: CompositionDocument,
  manifest: ComponentManifest,
  catalogById: ReadonlyMap<string, ComposerManifestEntry>,
  target: InsertionTarget,
): string {
  if (target.parentId === null) return "Document root";
  const location = findLocation(document, manifest, target.parentId);
  if (!location) return target.slotId;
  const parentTitle = catalogById.get(location.node.componentId)?.title ?? location.node.componentId;
  const entry = manifest.get(location.node.componentId);
  const slotLabel = entry?.slots.find((s) => s.id === target.slotId)?.label ?? target.slotId;
  return `${parentTitle} › ${slotLabel}`;
}
