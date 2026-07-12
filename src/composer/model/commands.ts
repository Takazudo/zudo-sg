// Pure Composition commands.
//
// Every command takes a document and returns a NEW document (never mutates the
// input — it clones via a JSON round-trip, then mutates the clone). Commands
// return a discriminated `CommandResult` so callers get either the next
// document + repaired selection, or an actionable error string.
//
// MVP movement is sibling up/down WITHIN one parent slot only. Cross-slot
// reparenting and drag-and-drop are deferred (later waves). Opaque nodes are
// preserved: they may be reordered/removed within their current slot, but their
// props are read-only and nothing may be added into them.

import type { ComposerFieldMeta, JsonValue } from "@zudo-sg/ui";
import type {
  ComponentManifest,
  CompositionDocument,
  CompositionNode,
  InsertionTarget,
  JsonObject,
} from "./types";
import { VIRTUAL_ROOT_SLOT_ID } from "./types";
import type { IdFactory } from "./id-factory";
import { cloneJson, isJsonSafe } from "./json";
import { indexDocument } from "./index-model";
import { isNodeOpaque, validateInsertionTarget } from "./validate";

export type CommandResult =
  | {
      ok: true;
      document: CompositionDocument;
      /** Selection the caller should adopt after the command. */
      selectedId: string | null;
      /** Id of the node created by `addNode` (only present on add). */
      insertedId?: string;
      /** False when a command was a valid no-op (e.g. reorder at a boundary). */
      changed: boolean;
    }
  | { ok: false; error: string };

/** Build a fast id → node lookup over a document. */
function nodeLookup(document: CompositionDocument, manifest: ComponentManifest) {
  const index = indexDocument(document, manifest);
  return (id: string): CompositionNode | undefined => index.byId.get(id)?.node;
}

/** The mutable slot array an `InsertionTarget`/location addresses in `document`. */
function slotArray(
  document: CompositionDocument,
  parentId: string | null,
  slotId: string,
  locate: (id: string) => CompositionNode | undefined,
): CompositionNode[] | undefined {
  if (parentId === null) return document.root;
  const parent = locate(parentId);
  if (!parent) return undefined;
  if (!Array.isArray(parent.slots[slotId])) parent.slots[slotId] = [];
  return parent.slots[slotId];
}

// ── add ──────────────────────────────────────────────────────────────────────

/**
 * Insert a fresh node of `componentId` into the slot described by `target`, at
 * `target.index` (default append is expressed as `index === slot.length`). The
 * new node's props come from the manifest defaults and its declared slots are
 * initialised to empty arrays. Enforces the target slot's `accepts` whitelist
 * and single-cardinality. Ids are minted by the injected `idFactory`.
 */
export function addNode(
  document: CompositionDocument,
  manifest: ComponentManifest,
  target: InsertionTarget,
  componentId: string,
  idFactory: IdFactory,
  selectedId: string | null = null,
): CommandResult {
  const next = cloneJson(document);
  const locate = nodeLookup(next, manifest);

  const validation = validateInsertionTarget(next, manifest, target, locate);
  if (!validation.ok) return { ok: false, error: validation.error ?? "invalid insertion target" };

  const entry = manifest.get(componentId);
  if (!entry) {
    return { ok: false, error: `Cannot add unknown component "${componentId}"` };
  }

  // Slot-level acceptance + cardinality (the virtual root accepts anything).
  if (target.parentId !== null) {
    const parent = locate(target.parentId)!;
    const parentEntry = manifest.get(parent.componentId)!;
    const slot = parentEntry.slots.find((s) => s.id === target.slotId)!;
    const existing = parent.slots[target.slotId] ?? [];
    if (slot.accepts && !slot.accepts.includes(componentId)) {
      return {
        ok: false,
        error: `Slot "${target.slotId}" does not accept "${componentId}"`,
      };
    }
    if (slot.cardinality === "single" && existing.length >= 1) {
      return {
        ok: false,
        error: `Slot "${target.slotId}" is single-child and already occupied`,
      };
    }
  }

  const id = idFactory(componentId);
  if (indexDocument(next, manifest).byId.has(id)) {
    return { ok: false, error: `Id factory produced a duplicate id "${id}"` };
  }

  const node: CompositionNode = {
    id,
    componentId,
    componentVersion: entry.version,
    props: cloneJson(entry.defaults ?? {}) as JsonObject,
    slots: Object.fromEntries(entry.slots.map((s) => [s.id, [] as CompositionNode[]])),
  };

  const array = slotArray(next, target.parentId, target.slotId, locate)!;
  array.splice(target.index, 0, node);

  return { ok: true, document: next, selectedId: id, insertedId: id, changed: true };
}

// ── update props ───────────────────────────────────────────────────────────

function validateFieldValue(field: ComposerFieldMeta, value: JsonValue): string | null {
  switch (field.kind) {
    case "select":
      return field.options.includes(value as string)
        ? null
        : `must be one of [${field.options.join(", ")}]`;
    case "boolean":
      return typeof value === "boolean" ? null : "must be a boolean";
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return "must be a finite number";
      if (field.min !== undefined && value < field.min) return `is below min ${field.min}`;
      if (field.max !== undefined && value > field.max) return `is above max ${field.max}`;
      return null;
    case "text":
    case "color":
      return typeof value === "string" ? null : "must be a string";
    default:
      return null;
  }
}

/**
 * Merge a JSON-safe prop patch into a node's props. Rejects opaque nodes
 * (their props are read-only), non-JSON-safe values, and values that violate a
 * declared field's kind/domain. Props not described by a field are still
 * accepted as long as they are JSON-safe.
 */
export function updateProps(
  document: CompositionDocument,
  manifest: ComponentManifest,
  nodeId: string,
  patch: JsonObject,
): CommandResult {
  const next = cloneJson(document);
  const locate = nodeLookup(next, manifest);
  const node = locate(nodeId);
  if (!node) return { ok: false, error: `Node "${nodeId}" not found` };
  if (isNodeOpaque(node, manifest)) {
    return { ok: false, error: `Node "${nodeId}" is opaque; its props are read-only` };
  }

  const entry = manifest.get(node.componentId)!;
  const fieldsByProp = new Map(entry.fields.map((f) => [f.prop, f]));

  for (const [prop, value] of Object.entries(patch)) {
    if (!isJsonSafe(value)) {
      return { ok: false, error: `Prop "${prop}" value is not JSON-safe` };
    }
    const field = fieldsByProp.get(prop);
    if (field) {
      const problem = validateFieldValue(field, value);
      if (problem) return { ok: false, error: `Prop "${prop}" ${problem}` };
    }
  }

  node.props = { ...node.props, ...(cloneJson(patch) as JsonObject) };
  return { ok: true, document: next, selectedId: nodeId, changed: true };
}

// ── reorder (sibling up/down within one parent slot) ─────────────────────────

/**
 * Swap a node with its previous ("up") or next ("down") sibling in the SAME
 * parent slot. A move at the slot boundary is a valid no-op (`changed: false`).
 * Allowed for opaque nodes (movement stays within the current slot).
 */
export function reorderNode(
  document: CompositionDocument,
  manifest: ComponentManifest,
  nodeId: string,
  direction: "up" | "down",
): CommandResult {
  const next = cloneJson(document);
  const index = indexDocument(next, manifest);
  const location = index.byId.get(nodeId);
  if (!location) return { ok: false, error: `Node "${nodeId}" not found` };

  const array =
    location.parentId === null
      ? next.root
      : (index.byId.get(location.parentId)!.node.slots[location.slotId] ?? []);

  const from = location.index;
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= array.length) {
    return { ok: true, document: next, selectedId: nodeId, changed: false };
  }

  [array[from], array[to]] = [array[to], array[from]];
  return { ok: true, document: next, selectedId: nodeId, changed: true };
}

// ── remove subtree + selection repair ────────────────────────────────────────

/** Collect the id of a node and every descendant. */
function subtreeIds(node: CompositionNode, acc: Set<string> = new Set()): Set<string> {
  acc.add(node.id);
  for (const children of Object.values(node.slots)) {
    for (const child of children) subtreeIds(child, acc);
  }
  return acc;
}

/**
 * Remove a node (and its whole subtree) from its parent slot. Returns a repaired
 * selection: if the current selection survived the removal it is kept; otherwise
 * it falls back to the sibling that shifts into the removed slot index, then the
 * previous sibling, then the parent node, then null (empty root). The virtual
 * root cannot be removed (it has no id).
 */
export function removeNode(
  document: CompositionDocument,
  manifest: ComponentManifest,
  nodeId: string,
  selectedId: string | null = null,
): CommandResult {
  const next = cloneJson(document);
  const index = indexDocument(next, manifest);
  const location = index.byId.get(nodeId);
  if (!location) return { ok: false, error: `Node "${nodeId}" not found` };

  const array =
    location.parentId === null
      ? next.root
      : (index.byId.get(location.parentId)!.node.slots[location.slotId] ?? []);

  const removed = subtreeIds(location.node);
  const selectionSurvives = selectedId !== null && !removed.has(selectedId);

  array.splice(location.index, 1);

  let repaired: string | null;
  if (selectionSurvives) {
    repaired = selectedId;
  } else if (array.length > 0) {
    const at = Math.min(location.index, array.length - 1);
    repaired = array[at].id;
  } else {
    repaired = location.parentId; // null when the removed node was at the root
  }

  return { ok: true, document: next, selectedId: repaired, changed: true };
}

/**
 * Repair an arbitrary selection against a (possibly replaced) document: keep it
 * if the node still exists, else fall back to the first root node, else null.
 * Used after a whole-document swap (load/reset/recovery), where the location of
 * a since-removed node is unknown.
 */
export function repairSelection(
  document: CompositionDocument,
  manifest: ComponentManifest,
  selectedId: string | null,
): string | null {
  if (selectedId !== null && indexDocument(document, manifest).byId.has(selectedId)) {
    return selectedId;
  }
  return document.root[0]?.id ?? null;
}
