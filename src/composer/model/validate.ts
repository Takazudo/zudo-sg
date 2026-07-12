// Load/validate + per-node diagnostics for the Composition model.
//
// Two independent layers:
//  1. STRUCTURAL validity (`isStructurallyValidDocument`) — manifest-agnostic.
//     Answers "is this a well-formed CompositionDocument?" (schema version,
//     shape, JSON-safe props, unique ids, no cycles). Recovery uses this to
//     decide malformed-vs-loadable. A document that merely references an
//     unknown component is STILL structurally valid — it loads and its unknown
//     nodes become opaque placeholders.
//  2. SEMANTIC diagnostics (`diagnoseDocument`) — checked against a manifest.
//     Classifies opaque/unavailable nodes (unknown component, unsupported
//     version, removed slot, cardinality/accepts violations) and decides
//     whether JSX export is safe.

import type {
  ComponentManifest,
  CompositionDocument,
  CompositionNode,
  InsertionTarget,
} from "./types";
import { COMPOSITION_SCHEMA_VERSION, VIRTUAL_ROOT_SLOT_ID } from "./types";
import { isJsonSafe, isPlainObject } from "./json";
import { orderedSlotIds } from "./index-model";

// ── Structural validation (manifest-agnostic) ───────────────────────────────

function isValidNodeShape(
  value: unknown,
  seenIds: Set<string>,
  seenRefs: Set<object>,
): boolean {
  if (!isPlainObject(value)) return false;
  if (seenRefs.has(value)) return false; // structural cycle via shared ref
  seenRefs.add(value);

  const node = value as Record<string, unknown>;
  if (typeof node.id !== "string" || node.id.length === 0) return false;
  if (seenIds.has(node.id)) return false; // duplicate id
  seenIds.add(node.id);
  if (typeof node.componentId !== "string" || node.componentId.length === 0) return false;
  if (typeof node.componentVersion !== "number" || !Number.isInteger(node.componentVersion)) {
    return false;
  }
  if (!isPlainObject(node.props) || !isJsonSafe(node.props)) return false;
  if (!isPlainObject(node.slots)) return false;

  for (const children of Object.values(node.slots as Record<string, unknown>)) {
    if (!Array.isArray(children)) return false;
    for (const child of children) {
      if (!isValidNodeShape(child, seenIds, seenRefs)) return false;
    }
  }
  return true;
}

/**
 * True when `value` is a well-formed `CompositionDocument` of the SUPPORTED
 * schema version: correct shape, JSON-safe props, globally unique node ids, and
 * no structural cycles. Unknown component ids do NOT fail this check.
 */
export function isStructurallyValidDocument(value: unknown): value is CompositionDocument {
  if (!isPlainObject(value)) return false;
  const doc = value as Record<string, unknown>;
  if (doc.schemaVersion !== COMPOSITION_SCHEMA_VERSION) return false;
  if (typeof doc.id !== "string" || typeof doc.name !== "string") return false;
  if (!Array.isArray(doc.root)) return false;

  const seenIds = new Set<string>();
  const seenRefs = new Set<object>();
  for (const node of doc.root) {
    if (!isValidNodeShape(node, seenIds, seenRefs)) return false;
  }
  return true;
}

// ── Semantic diagnostics (manifest-aware) ───────────────────────────────────

export type DiagnosticCode =
  | "unknown-component"
  | "unsupported-version"
  | "removed-slot"
  | "cardinality-violation"
  | "unaccepted-child";

export interface DiagnosticReason {
  code: DiagnosticCode;
  message: string;
  /** Slot the reason concerns, when applicable. */
  slotId?: string;
}

export interface NodeDiagnostic {
  nodeId: string;
  componentId: string;
  /** True when the node is unavailable and must render as an opaque placeholder. */
  opaque: boolean;
  reasons: DiagnosticReason[];
}

export interface DocumentDiagnostics {
  byId: Map<string, NodeDiagnostic>;
  /** Ids of all opaque nodes, in traversal order. */
  opaqueIds: string[];
  hasOpaque: boolean;
  /** False when any opaque node exists — JSX export must be refused. */
  canExport: boolean;
}

/** Classify a single node against the manifest. Pure; ignores children. */
export function classifyNode(
  node: CompositionNode,
  manifest: ComponentManifest,
): NodeDiagnostic {
  const reasons: DiagnosticReason[] = [];
  const entry = manifest.get(node.componentId);

  if (!entry) {
    reasons.push({
      code: "unknown-component",
      message: `Unknown component "${node.componentId}" — not in the manifest`,
    });
    return { nodeId: node.id, componentId: node.componentId, opaque: true, reasons };
  }

  if (node.componentVersion !== entry.version) {
    reasons.push({
      code: "unsupported-version",
      message: `Node uses "${node.componentId}" v${node.componentVersion}, but the manifest provides v${entry.version}`,
    });
  }

  const declaredIds = new Set(entry.slots.map((s) => s.id));
  for (const slotId of Object.keys(node.slots)) {
    if (!declaredIds.has(slotId)) {
      reasons.push({
        code: "removed-slot",
        message: `Slot "${slotId}" is no longer declared on "${node.componentId}"`,
        slotId,
      });
    }
  }

  for (const slot of entry.slots) {
    const children = node.slots[slot.id] ?? [];
    if (slot.cardinality === "single" && children.length > 1) {
      reasons.push({
        code: "cardinality-violation",
        message: `Slot "${slot.id}" is single but holds ${children.length} children`,
        slotId: slot.id,
      });
    }
    if (slot.accepts) {
      const allowed = new Set(slot.accepts);
      for (const child of children) {
        if (!allowed.has(child.componentId)) {
          reasons.push({
            code: "unaccepted-child",
            message: `Slot "${slot.id}" does not accept "${child.componentId}"`,
            slotId: slot.id,
          });
        }
      }
    }
  }

  return {
    nodeId: node.id,
    componentId: node.componentId,
    opaque: reasons.length > 0,
    reasons,
  };
}

/**
 * Classify every node in the document. `canExport` is false when any node is
 * opaque — the JSX generator uses it to refuse a misleading export rather than
 * silently dropping preserved data.
 */
export function diagnoseDocument(
  document: CompositionDocument,
  manifest: ComponentManifest,
): DocumentDiagnostics {
  const byId = new Map<string, NodeDiagnostic>();
  const opaqueIds: string[] = [];

  const walk = (children: CompositionNode[]): void => {
    for (const node of children) {
      const diagnostic = classifyNode(node, manifest);
      byId.set(node.id, diagnostic);
      if (diagnostic.opaque) opaqueIds.push(node.id);
      const entry = manifest.get(node.componentId);
      for (const slotId of orderedSlotIds(node, entry)) {
        walk(node.slots[slotId] ?? []);
      }
    }
  };
  walk(document.root);

  return {
    byId,
    opaqueIds,
    hasOpaque: opaqueIds.length > 0,
    canExport: opaqueIds.length === 0,
  };
}

/** True when the given node is editable (known component, matching version). */
export function isNodeOpaque(node: CompositionNode, manifest: ComponentManifest): boolean {
  return classifyNode(node, manifest).opaque;
}

// ── Insertion-target validation ─────────────────────────────────────────────

export interface TargetValidation {
  ok: boolean;
  /** Present when `ok` is false. */
  error?: string;
}

/**
 * Validates an `InsertionTarget` against the document + manifest: the parent
 * must exist (or be the virtual root), the slot must be declared on the parent,
 * the parent must not be opaque, and `index` must be a strict integer in
 * `0..length` of the target slot array (`length` = append).
 */
export function validateInsertionTarget(
  document: CompositionDocument,
  manifest: ComponentManifest,
  target: InsertionTarget,
  locate: (id: string) => CompositionNode | undefined,
): TargetValidation {
  const { parentId, slotId, index } = target;

  let slotChildren: CompositionNode[];

  if (parentId === null) {
    if (slotId !== VIRTUAL_ROOT_SLOT_ID) {
      return { ok: false, error: `Virtual-root insertion must use slot "${VIRTUAL_ROOT_SLOT_ID}"` };
    }
    slotChildren = document.root;
  } else {
    const parent = locate(parentId);
    if (!parent) return { ok: false, error: `Parent node "${parentId}" not found` };
    const entry = manifest.get(parent.componentId);
    if (!entry) {
      return { ok: false, error: `Cannot add into opaque node "${parentId}" (unknown component)` };
    }
    if (isNodeOpaque(parent, manifest)) {
      return { ok: false, error: `Cannot add into opaque node "${parentId}"` };
    }
    const slot = entry.slots.find((s) => s.id === slotId);
    if (!slot) {
      return { ok: false, error: `Slot "${slotId}" is not declared on "${parent.componentId}"` };
    }
    slotChildren = parent.slots[slotId] ?? [];
  }

  if (!Number.isInteger(index) || index < 0 || index > slotChildren.length) {
    return {
      ok: false,
      error: `Insertion index ${index} out of range 0..${slotChildren.length}`,
    };
  }

  return { ok: true };
}
