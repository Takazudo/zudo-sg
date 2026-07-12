// Composer document model — JSON-safe types (wave 2, epic #243 / issue #245).
//
// The persisted `CompositionDocument` is one recursive, versioned, JSON-safe
// tree. `document.root` is a VIRTUAL insertion slot (a pseudo-row), never a
// component, persisted node, rendered wrapper, selectable/removable node, or
// JSX import. Nodes carry stable ids, a component id + schema version, JSON
// props, and a map of stable named-slot ids to child arrays.
//
// The model is pure and parameterised by a serializable manifest so it can be
// built and tested independently of the real component cohort (owned by #246).

import type {
  ComposerConstraints,
  ComposerFieldMeta,
  ComposerSlotMeta,
  ComposerSource,
  JsonValue,
} from "@zudo-sg/ui";

/** A JSON object — the shape of a node's `props`. */
export type JsonObject = { [key: string]: JsonValue };

/** The only Composition document schema version this build understands. */
export const COMPOSITION_SCHEMA_VERSION = 1 as const;
export type CompositionSchemaVersion = typeof COMPOSITION_SCHEMA_VERSION;

/** A single persisted node in a Composition tree. */
export interface CompositionNode {
  /** Stable, unique node id (persisted document key). */
  id: string;
  /** Stable component id — looked up in the manifest. */
  componentId: string;
  /** Component schema version this node was authored against. */
  componentVersion: number;
  /** JSON-safe scalar props. */
  props: JsonObject;
  /** Stable slot id → ordered child nodes. */
  slots: Record<string, CompositionNode[]>;
}

/** The full persisted Composition document. */
export interface CompositionDocument {
  schemaVersion: CompositionSchemaVersion;
  id: string;
  name: string;
  /**
   * The virtual root's children. `root` is an insertion slot only — the array
   * itself is NOT a node and has no id/props/component.
   */
  root: CompositionNode[];
}

/**
 * The stable slot id used when an `InsertionTarget` addresses the virtual
 * document root (`document.root`). It is a pseudo-slot id, never a real
 * component slot.
 */
export const VIRTUAL_ROOT_SLOT_ID = "root" as const;

/**
 * A shared, discriminated insertion position reused by every downstream wave
 * (#247 controller, #248 request-add, #250 chooser capture, #251 wiring, and
 * the round-2 interaction waves). Discriminated on `parentId === null`.
 *
 * - `parentId: null` addresses the VIRTUAL ROOT; `slotId` must be
 *   `VIRTUAL_ROOT_SLOT_ID`.
 * - `parentId: string` addresses a real parent node's named slot.
 * - `index` is a strict integer in `0..length` of the target slot array
 *   (`length` = append). Validation lives in `validateInsertionTarget`.
 */
export interface InsertionTarget {
  parentId: string | null;
  slotId: string;
  index: number;
}

/**
 * The model-local, serializable manifest entry a command validates against. It
 * is a structural SUBSET of the host `ComposerManifestEntry` (which adds
 * display metadata), so the real `composerManifest` is assignable here without
 * an adapter — wave-5 integration passes it directly.
 */
export interface ComponentManifestEntry {
  componentId: string;
  version: number;
  source: ComposerSource;
  defaults: Record<string, JsonValue>;
  fields: ComposerFieldMeta[];
  slots: ComposerSlotMeta[];
  constraints?: ComposerConstraints;
}

/** Fast, read-only lookup over a set of manifest entries. */
export interface ComponentManifest {
  get(componentId: string): ComponentManifestEntry | undefined;
  has(componentId: string): boolean;
  ids(): string[];
}

/** Builds a `ComponentManifest` index from a flat list of entries. */
export function createManifest(
  entries: readonly ComponentManifestEntry[],
): ComponentManifest {
  const byId = new Map<string, ComponentManifestEntry>();
  for (const entry of entries) byId.set(entry.componentId, entry);
  return {
    get: (id) => byId.get(id),
    has: (id) => byId.has(id),
    ids: () => [...byId.keys()],
  };
}
