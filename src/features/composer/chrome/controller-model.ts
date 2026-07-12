// Pure Composer controller state + reducer (issue #247).
//
// The parent `/composer` route owns two independent pieces of state:
//   - the #245 `CompositionDocument` (the persisted, versioned document tree)
//   - session state that never round-trips through the document itself:
//     selection, expansion, edit/preview mode, canvas viewport choice, rail
//     widths, and an honest save/load status.
//
// This module is 100% pure — no DOM, no localStorage, no Preact. It only
// applies #245's commands (addNode/updateProps/reorderNode/removeNode) and
// folds their `CommandResult` into a new `ComposerControllerState`. Side
// effects (reading/writing localStorage, wiring the resizer DOM, the
// SPA-navigation guard) live in sibling modules (storage.ts,
// use-composer-controller.ts, navigation-guard.ts) — keeping this module
// pure is what makes "Controller unit tests cover save/reload/reset/
// malformed/future-schema quarantine + typed callback seams" (issue #247)
// cheap to prove without a DOM harness.

import type {
  ComponentManifest,
  CompositionDocument,
  IdFactory,
  InsertionTarget,
  JsonObject,
} from "@/composer";
import {
  addNode,
  findLocation,
  removeNode,
  reorderNode,
  repairSelection,
  updateProps,
} from "@/composer";

/** Edit vs. read-only preview rendering of the canvas. */
export type ComposerMode = "edit" | "preview";

/**
 * Canvas viewport choice. Session state only — the preview iframe (#248) owns
 * actually scaling/framing its document to match.
 */
export type ComposerCanvasViewport = "fluid" | "desktop" | "tablet" | "mobile";

/**
 * Honest persistence status. Only `"saved"` means the in-memory document
 * matches what is (or, for a fresh/empty document, will be) in localStorage.
 *
 *  - `"saved"` — the last mutation persisted successfully.
 *  - `"unsaved"` — a mutation is pending a persistence attempt.
 *  - `"error"` — the last localStorage write threw (quota / disabled storage
 *    / private mode). The document still works in memory.
 *  - `"quarantined"` — storage holds a newer, unrecognized schema (#245).
 *    Edits apply to the in-memory sample only; nothing is written back until
 *    the user explicitly Resets — see storage.ts / recovery.ts.
 */
export type ComposerSaveStatus =
  | { kind: "saved" }
  | { kind: "unsaved" }
  | { kind: "error"; reason: string }
  | { kind: "quarantined"; foundSchemaVersion: number };

/** Non-fatal notice surfaced once, right after the initial load. */
export type ComposerLoadNotice =
  | { kind: "recovered"; reason: string }
  | { kind: "quarantined"; foundSchemaVersion: number };

export interface ComposerControllerState {
  document: CompositionDocument;
  selectedId: string | null;
  expandedIds: ReadonlySet<string>;
  mode: ComposerMode;
  viewport: ComposerCanvasViewport;
  leftWidth: number;
  rightWidth: number;
  saveStatus: ComposerSaveStatus;
  loadNotice: ComposerLoadNotice | null;
}

/**
 * The typed action union the controller dispatches. `add` deliberately uses
 * #245's shared `InsertionTarget` (`{ parentId, slotId, index }`) — the same
 * shape #248/#250/#251 and the round-2 interaction waves address inserts
 * with, per the epic's locked architecture.
 */
export type ComposerAction =
  | { type: "add"; target: InsertionTarget; componentId: string }
  | { type: "updateProps"; nodeId: string; patch: JsonObject }
  | { type: "reorder"; nodeId: string; direction: "up" | "down" }
  | { type: "remove"; nodeId: string }
  | { type: "select"; nodeId: string | null }
  | { type: "reveal"; nodeId: string }
  | { type: "toggleExpanded"; nodeId: string }
  | { type: "setExpanded"; nodeId: string; expanded: boolean }
  | { type: "setMode"; mode: ComposerMode }
  | { type: "setViewport"; viewport: ComposerCanvasViewport }
  | { type: "setLeftWidth"; width: number }
  | { type: "setRightWidth"; width: number }
  | { type: "resetToSample"; document: CompositionDocument }
  | { type: "loadDocument"; document: CompositionDocument; notice: ComposerLoadNotice | null }
  | { type: "dismissLoadNotice" }
  | { type: "setSaveStatus"; status: ComposerSaveStatus };

export interface ComposerReducerContext {
  manifest: ComponentManifest;
  idFactory: IdFactory;
}

export interface ComposerReducerResult {
  state: ComposerControllerState;
  /** Non-null when a document command was rejected (e.g. cardinality/accepts). */
  error: string | null;
  /** True when `document` itself changed — callers use this to trigger persistence. */
  documentChanged: boolean;
}

const DOCUMENT_MUTATION_TYPES = new Set<ComposerAction["type"]>([
  "add",
  "updateProps",
  "reorder",
  "remove",
  "resetToSample",
]);

/** True for actions that mutate `document` (used by the hook to gate autosave). */
export function isDocumentMutation(action: ComposerAction): boolean {
  return DOCUMENT_MUTATION_TYPES.has(action.type);
}

function withExpanded(
  ids: ReadonlySet<string>,
  nodeId: string,
  expanded: boolean,
): ReadonlySet<string> {
  if (ids.has(nodeId) === expanded) return ids;
  const next = new Set(ids);
  if (expanded) next.add(nodeId);
  else next.delete(nodeId);
  return next;
}

/** Every ancestor id of `nodeId` (nearest first), not including the node itself. */
function ancestorIds(
  document: CompositionDocument,
  manifest: ComponentManifest,
  nodeId: string,
): string[] {
  const ids: string[] = [];
  let current = findLocation(document, manifest, nodeId);
  while (current && current.parentId !== null) {
    ids.push(current.parentId);
    current = findLocation(document, manifest, current.parentId);
  }
  return ids;
}

/**
 * Build the initial in-memory controller state from an already-resolved
 * document (the result of a #245 `loadCompositionDocument` call, an explicit
 * reset, or a native sample fallback). Pure — never touches storage itself.
 */
export function createInitialControllerState(options: {
  document: CompositionDocument;
  manifest: ComponentManifest;
  loadNotice: ComposerLoadNotice | null;
  saveStatus: ComposerSaveStatus;
  leftWidth: number;
  rightWidth: number;
}): ComposerControllerState {
  const { document, manifest, loadNotice, saveStatus, leftWidth, rightWidth } = options;
  return {
    document,
    selectedId: repairSelection(document, manifest, null),
    expandedIds: new Set<string>(),
    mode: "edit",
    viewport: "fluid",
    leftWidth,
    rightWidth,
    saveStatus,
    loadNotice,
  };
}

/**
 * Apply one action to `state`, returning the next state plus a command error
 * (if any) and whether `document` changed. Never throws: a rejected #245
 * command (e.g. "slot does not accept X") is reported via `error` and leaves
 * `state` untouched, matching the model's own `CommandResult` contract.
 */
export function applyComposerAction(
  state: ComposerControllerState,
  action: ComposerAction,
  ctx: ComposerReducerContext,
): ComposerReducerResult {
  switch (action.type) {
    case "add": {
      const result = addNode(
        state.document,
        ctx.manifest,
        action.target,
        action.componentId,
        ctx.idFactory,
      );
      if (!result.ok) return { state, error: result.error, documentChanged: false };
      return {
        state: { ...state, document: result.document, selectedId: result.selectedId },
        error: null,
        documentChanged: result.changed,
      };
    }
    case "updateProps": {
      const result = updateProps(state.document, ctx.manifest, action.nodeId, action.patch);
      if (!result.ok) return { state, error: result.error, documentChanged: false };
      return {
        state: { ...state, document: result.document, selectedId: result.selectedId },
        error: null,
        documentChanged: result.changed,
      };
    }
    case "reorder": {
      const result = reorderNode(state.document, ctx.manifest, action.nodeId, action.direction);
      if (!result.ok) return { state, error: result.error, documentChanged: false };
      return {
        state: { ...state, document: result.document, selectedId: result.selectedId },
        error: null,
        documentChanged: result.changed,
      };
    }
    case "remove": {
      const result = removeNode(state.document, ctx.manifest, action.nodeId, state.selectedId);
      if (!result.ok) return { state, error: result.error, documentChanged: false };
      return {
        state: { ...state, document: result.document, selectedId: result.selectedId },
        error: null,
        documentChanged: result.changed,
      };
    }
    case "resetToSample": {
      return {
        state: {
          ...state,
          document: action.document,
          selectedId: repairSelection(action.document, ctx.manifest, null),
          expandedIds: new Set<string>(),
          loadNotice: null,
        },
        error: null,
        documentChanged: true,
      };
    }
    case "loadDocument": {
      return {
        state: {
          ...state,
          document: action.document,
          selectedId: repairSelection(action.document, ctx.manifest, state.selectedId),
          loadNotice: action.notice,
        },
        error: null,
        documentChanged: false,
      };
    }
    case "select":
      return { state: { ...state, selectedId: action.nodeId }, error: null, documentChanged: false };
    case "reveal": {
      let nextExpanded: ReadonlySet<string> = state.expandedIds;
      for (const id of ancestorIds(state.document, ctx.manifest, action.nodeId)) {
        nextExpanded = withExpanded(nextExpanded, id, true);
      }
      return {
        state: { ...state, selectedId: action.nodeId, expandedIds: nextExpanded },
        error: null,
        documentChanged: false,
      };
    }
    case "toggleExpanded":
      return {
        state: {
          ...state,
          expandedIds: withExpanded(state.expandedIds, action.nodeId, !state.expandedIds.has(action.nodeId)),
        },
        error: null,
        documentChanged: false,
      };
    case "setExpanded":
      return {
        state: { ...state, expandedIds: withExpanded(state.expandedIds, action.nodeId, action.expanded) },
        error: null,
        documentChanged: false,
      };
    case "setMode":
      return { state: { ...state, mode: action.mode }, error: null, documentChanged: false };
    case "setViewport":
      return { state: { ...state, viewport: action.viewport }, error: null, documentChanged: false };
    case "setLeftWidth":
      return { state: { ...state, leftWidth: action.width }, error: null, documentChanged: false };
    case "setRightWidth":
      return { state: { ...state, rightWidth: action.width }, error: null, documentChanged: false };
    case "dismissLoadNotice":
      return { state: { ...state, loadNotice: null }, error: null, documentChanged: false };
    case "setSaveStatus":
      return { state: { ...state, saveStatus: action.status }, error: null, documentChanged: false };
  }
}

/** True while the document is NOT known to match localStorage — drives the navigation guard. */
export function hasUnsavedChanges(state: ComposerControllerState): boolean {
  return state.saveStatus.kind !== "saved";
}

/**
 * A short, honest, user-facing description of `saveStatus` — the single
 * place the toolbar's save indicator sources its copy from, so "blocked
 * storage still starts and honestly reports 'not saved'" (issue #247) has
 * one wording, not one per call site.
 */
export function describeSaveStatus(status: ComposerSaveStatus): string {
  switch (status.kind) {
    case "saved":
      return "Saved locally";
    case "unsaved":
      return "Not saved yet";
    case "error":
      return "Not saved — local storage is unavailable";
    case "quarantined":
      return "Not saved — a newer Composition is in storage; editing the sample until you Reset";
  }
}
