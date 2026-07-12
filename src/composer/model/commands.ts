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
): CommandResult {
  const next = cloneJson(document);
  const index = indexDocument(next, manifest);
  const locate = (id: string): CompositionNode | undefined => index.byId.get(id)?.node;

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
  if (index.byId.has(id)) {
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
 * (their props are read-only), non-JSON-safe values, values that violate a
 * declared field's kind/domain, and any key that names a declared STRUCTURAL
 * slot's `prop` (that prop is reserved for the slot's rendered children — a
 * scalar written there would sit inert in storage yet claim the same prop the
 * generator binds structural children to). Props not described by a field are
 * otherwise still accepted as long as they are JSON-safe.
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
  const slotProps = new Set(entry.slots.map((s) => s.prop));

  for (const [prop, value] of Object.entries(patch)) {
    if (slotProps.has(prop)) {
      return {
        ok: false,
        error: `Prop "${prop}" is a structural slot on "${node.componentId}" and cannot be set as a scalar prop`,
      };
    }
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

// ── clipboard/duplicate foundation (wave 6, issue #255) ──────────────────────
//
// Two pure primitives the #247 controller composes into copy/cut/paste/
// duplicate: `cloneSubtreeWithNewIds` never touches a document (it only
// re-issues ids on a detached node tree), and `insertSubtree` inserts an
// already-built subtree — as opposed to `addNode`, which builds a fresh node
// from manifest defaults. Splitting them this way is what lets the controller
// paste (clone, then insert) and duplicate (clone, then insert right after the
// source) share the exact same insertion validation `addNode` uses.

/**
 * Deep-clone `node` and every descendant, re-issuing every node's `id` via
 * `idFactory` — componentId/componentVersion/props/slot structure are
 * preserved verbatim. Never mutates `node`; the result shares no references
 * with it. Two calls against the same source (e.g. pasting the same clipboard
 * twice) always produce fully distinct id sets, since `idFactory` mints a
 * fresh id on every invocation.
 */
export function cloneSubtreeWithNewIds(node: CompositionNode, idFactory: IdFactory): CompositionNode {
  const detached = cloneJson(node) as CompositionNode;
  const reissueIds = (n: CompositionNode): CompositionNode => {
    const slots: Record<string, CompositionNode[]> = {};
    for (const [slotId, children] of Object.entries(n.slots)) {
      slots[slotId] = children.map(reissueIds);
    }
    return { ...n, id: idFactory(n.componentId), slots };
  };
  return reissueIds(detached);
}

/**
 * Insert an already-built subtree (its ids already final — see
 * `cloneSubtreeWithNewIds`) into the slot described by `target`. Validates the
 * target's slot acceptance, cardinality, index bounds, and root-slot schema
 * exactly like `addNode` — BEFORE applying anything — and additionally refuses
 * to insert if any id in `subtree` already exists in `document` (an invariant
 * violation; callers are expected to have re-issued ids first). Never mutates
 * `document` or `subtree`.
 */
export function insertSubtree(
  document: CompositionDocument,
  manifest: ComponentManifest,
  target: InsertionTarget,
  subtree: CompositionNode,
): CommandResult {
  const next = cloneJson(document);
  const index = indexDocument(next, manifest);
  const locate = (id: string): CompositionNode | undefined => index.byId.get(id)?.node;

  const validation = validateInsertionTarget(next, manifest, target, locate);
  if (!validation.ok) return { ok: false, error: validation.error ?? "invalid insertion target" };

  // Slot-level acceptance + cardinality (the virtual root accepts anything).
  if (target.parentId !== null) {
    const parent = locate(target.parentId)!;
    const parentEntry = manifest.get(parent.componentId)!;
    const slot = parentEntry.slots.find((s) => s.id === target.slotId)!;
    const existing = parent.slots[target.slotId] ?? [];
    if (slot.accepts && !slot.accepts.includes(subtree.componentId)) {
      return {
        ok: false,
        error: `Slot "${target.slotId}" does not accept "${subtree.componentId}"`,
      };
    }
    if (slot.cardinality === "single" && existing.length >= 1) {
      return {
        ok: false,
        error: `Slot "${target.slotId}" is single-child and already occupied`,
      };
    }
  }

  const clone = cloneJson(subtree) as CompositionNode;
  for (const id of subtreeIds(clone)) {
    if (index.byId.has(id)) {
      return { ok: false, error: `Node id "${id}" already exists in the document` };
    }
  }

  const array = slotArray(next, target.parentId, target.slotId, locate)!;
  array.splice(target.index, 0, clone);

  return { ok: true, document: next, selectedId: clone.id, insertedId: clone.id, changed: true };
}

// ── move (cross-slot drag & drop, wave 9, issue #258) ────────────────────────
//
// Relocate an EXISTING node (with its whole subtree) from wherever it currently
// sits to an `InsertionTarget`. This is the MOVE half of drag & drop; the COPY
// half composes `cloneSubtreeWithNewIds` + `insertSubtree` instead (a fresh
// clone needs no cycle guard and no index adjustment because the source is not
// removed). The controller (#247) picks between them from the drop's Alt flag,
// and layers the opaque-node policy on top — this function is purely mechanical.

/**
 * Move `sourceNodeId` (and its subtree) to `target`, removing it from its
 * current slot first. Pure — returns a NEW document, never mutates the input.
 *
 * Two subtleties this function owns, both verified by the #242 interaction
 * prototype (see its README):
 *
 *  1. **Same-slot index adjustment.** The adjustment applies ONLY when the
 *     source and destination are the SAME slot (same parent AND same slot id) —
 *     same parent is NOT sufficient, because a `SplitLayout` left→right move
 *     shares a parent but crosses slots. Within one slot, removing the source
 *     shifts every later sibling down by one, so a target index that sat AFTER
 *     the source is decremented by one; otherwise the raw index is used.
 *
 *  2. **Descendant-cycle guard.** A target whose parent is the moved node itself
 *     or any of its descendants is rejected: the destination would be reparented
 *     under a subtree that is about to be detached, orphaning it.
 *
 * Slot acceptance is always enforced; single-cardinality is enforced only for a
 * cross-slot move (a same-slot reorder adds no new child, so it cannot exceed
 * cardinality — and a `single` slot's lone occupant must be able to reorder).
 * A same-slot move whose adjusted index equals the source index is a valid
 * no-op (`changed: false`).
 */
export function moveSubtree(
  document: CompositionDocument,
  manifest: ComponentManifest,
  sourceNodeId: string,
  target: InsertionTarget,
): CommandResult {
  const next = cloneJson(document);
  const index = indexDocument(next, manifest);
  const locate = (id: string): CompositionNode | undefined => index.byId.get(id)?.node;

  const source = index.byId.get(sourceNodeId);
  if (!source) return { ok: false, error: `Node "${sourceNodeId}" not found` };

  // Descendant-cycle guard: the destination parent may not be the moved node
  // itself or any node inside its subtree (that would orphan the destination).
  const movedIds = subtreeIds(source.node);
  if (target.parentId !== null && movedIds.has(target.parentId)) {
    return { ok: false, error: `Cannot move "${sourceNodeId}" into its own subtree` };
  }

  const validation = validateInsertionTarget(next, manifest, target, locate);
  if (!validation.ok) return { ok: false, error: validation.error ?? "invalid insertion target" };

  // Same SLOT — not merely same parent (SplitLayout left→right shares a parent
  // but crosses slots, so it must NOT get the same-slot index adjustment).
  const sameSlot = source.parentId === target.parentId && source.slotId === target.slotId;

  if (target.parentId !== null) {
    const parent = locate(target.parentId)!;
    const parentEntry = manifest.get(parent.componentId)!;
    const slot = parentEntry.slots.find((s) => s.id === target.slotId)!;
    if (slot.accepts && !slot.accepts.includes(source.node.componentId)) {
      return {
        ok: false,
        error: `Slot "${target.slotId}" does not accept "${source.node.componentId}"`,
      };
    }
    // Cardinality only bites on a CROSS-slot move — a same-slot reorder adds no
    // new child, so it can never push a `single` slot past one.
    if (!sameSlot && slot.cardinality === "single" && (parent.slots[target.slotId] ?? []).length >= 1) {
      return {
        ok: false,
        error: `Slot "${target.slotId}" is single-child and already occupied`,
      };
    }
  }

  // Remove the source subtree from its current slot, then insert it at the
  // (possibly adjusted) target index. When same-slot, both `slotArray` calls
  // resolve to the SAME array object, so the splice-out/splice-in run on it.
  const sourceArray = slotArray(next, source.parentId, source.slotId, locate)!;
  const [detached] = sourceArray.splice(source.index, 1);

  const insertIndex = sameSlot && source.index < target.index ? target.index - 1 : target.index;
  const targetArray = slotArray(next, target.parentId, target.slotId, locate)!;
  targetArray.splice(insertIndex, 0, detached);

  const changed = !(sameSlot && insertIndex === source.index);
  return { ok: true, document: next, selectedId: sourceNodeId, changed };
}
