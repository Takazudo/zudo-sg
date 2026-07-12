"use client";

// The Composer's client-side controller hook (issue #247) — the one typed
// integration seam #248 (preview bridge), #249 (inspector), #250 (tree /
// chooser), and #251 (central integration) build on. Glues three pure
// modules into one Preact hook:
//
//   controller-model.ts  — the document + session-state reducer
//   storage.ts            — versioned localStorage load/save (#245 recovery)
//   navigation-guard.ts   — the SPA-router "unsaved edits" guard
//   resizer-contract.ts   — the vanilla-JS resizer script's width bridge
//
// Persistence policy (mirrors storage.ts's file header): every action that
// changes `document` triggers an autosave attempt UNLESS the current session
// started from a quarantined (future-schema) load — in that case nothing is
// written back until an explicit `reset()`, which is the one path allowed to
// overwrite quarantined storage.
//
// State is kept in a ref (not just `useState`) so `dispatch` can always act
// on the latest value without depending on `state` (which would otherwise
// force a new `dispatch` identity — and a new navigation-guard/effect
// teardown — on every action).

import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type {
  ComponentManifest,
  CompositionDocument,
  IdFactory,
  InsertionTarget,
  JsonObject,
} from "@/composer";
import { createManifest, createSampleDocument, createUuidIdFactory, resetToSample } from "@/composer";
import { composerManifest } from "@/styleguide/data/composer-registry";
import {
  applyComposerAction,
  createInitialControllerState,
  hasUnsavedChanges,
  type ComposerAction,
  type ComposerCanvasViewport,
  type ComposerControllerState,
  type ComposerLoadNotice,
  type ComposerMode,
  type ComposerSaveStatus,
} from "./controller-model";
import { installComposerNavigationGuard } from "./navigation-guard";
import {
  LS_INSPECTOR_WIDTH,
  LS_TREE_WIDTH,
  MIN_RAIL_W,
  WIDTH_CHANGE_EVENT,
  getPersistedWidth,
  setPersistedWidth,
  type ComposerWidthChangeDetail,
} from "./resizer-contract";
import { initializeComposerStorage, saveComposerDocument, type ComposerStorageInitResult } from "./storage";

/**
 * The typed reducer/controller API surface. Downstream waves (#248-#251)
 * should depend on THIS type, not on `controller-model.ts`'s action union —
 * the action union is an implementation detail; this is the seam.
 */
export interface ComposerController {
  state: ComposerControllerState;
  manifest: ComponentManifest;
  /** Non-null right after a rejected command (e.g. cardinality/accepts) until the next successful action. */
  lastError: string | null;
  add: (target: InsertionTarget, componentId: string) => void;
  updateProps: (nodeId: string, patch: JsonObject) => void;
  reorder: (nodeId: string, direction: "up" | "down") => void;
  remove: (nodeId: string) => void;
  /** Session clipboard = a deep-cloned snapshot of the node. Refused for opaque nodes. */
  copy: (nodeId: string) => void;
  /** Copy + remove (with #245's selection repair). Refused for opaque nodes. */
  cut: (nodeId: string) => void;
  /** Clone-with-new-ids + insert-subtree at `target`, then select + reveal it. Errors (e.g. an incompatible slot) surface via `lastError`, never a silent no-op. */
  paste: (target: InsertionTarget) => void;
  /** Clone-with-new-ids + insert immediately after the source, then select + reveal it. Refused for opaque nodes. */
  duplicate: (nodeId: string) => void;
  select: (nodeId: string | null) => void;
  reveal: (nodeId: string) => void;
  toggleExpanded: (nodeId: string) => void;
  setExpanded: (nodeId: string, expanded: boolean) => void;
  setMode: (mode: ComposerMode) => void;
  setViewport: (viewport: ComposerCanvasViewport) => void;
  setLeftWidth: (width: number) => void;
  setRightWidth: (width: number) => void;
  /** Re-reads localStorage (e.g. after another tab changed it) without discarding an in-flight edit's UI state. */
  reload: () => void;
  /** The only action allowed to overwrite quarantined storage — see storage.ts. */
  reset: () => void;
  dismissLoadNotice: () => void;
}

export interface UseComposerControllerOptions {
  manifest?: ComponentManifest;
  sample?: CompositionDocument;
  idFactory?: IdFactory;
}

const defaultManifest = createManifest(composerManifest);

/** Resolve the honest {notice, saveStatus, quarantined} triple from one storage read. */
function resolveLoadResult(
  init: ComposerStorageInitResult,
): { notice: ComposerLoadNotice | null; status: ComposerSaveStatus; quarantined: boolean } {
  const { outcome, write } = init;
  if (outcome.status === "quarantined") {
    return {
      notice: { kind: "quarantined", foundSchemaVersion: outcome.foundSchemaVersion },
      status: { kind: "quarantined", foundSchemaVersion: outcome.foundSchemaVersion },
      quarantined: true,
    };
  }
  const status: ComposerSaveStatus =
    write && !write.ok ? { kind: "error", reason: write.error ?? "Storage write failed" } : { kind: "saved" };
  if (outcome.status === "recovered") {
    return { notice: { kind: "recovered", reason: outcome.reason }, status, quarantined: false };
  }
  return { notice: null, status, quarantined: false };
}

export function useComposerController(options: UseComposerControllerOptions = {}): ComposerController {
  const manifest = options.manifest ?? defaultManifest;
  const sample = useMemo(() => options.sample ?? createSampleDocument(), [options.sample]);
  const idFactory = useMemo(() => options.idFactory ?? createUuidIdFactory(), [options.idFactory]);

  const quarantinedRef = useRef(false);
  const stateRef = useRef<ComposerControllerState | null>(null);
  if (stateRef.current === null) {
    const init = initializeComposerStorage(sample);
    const { notice, status, quarantined } = resolveLoadResult(init);
    quarantinedRef.current = quarantined;
    stateRef.current = createInitialControllerState({
      document: init.outcome.document,
      manifest,
      loadNotice: notice,
      saveStatus: status,
      leftWidth: getPersistedWidth(LS_TREE_WIDTH, MIN_RAIL_W),
      rightWidth: getPersistedWidth(LS_INSPECTOR_WIDTH, MIN_RAIL_W),
    });
  }

  const [state, setState] = useState<ComposerControllerState>(stateRef.current);
  const [lastError, setLastError] = useState<string | null>(null);

  const dispatch = useCallback(
    (action: ComposerAction) => {
      const current = stateRef.current!;
      const result = applyComposerAction(current, action, { manifest, idFactory });
      setLastError(result.error);
      if (result.error) return;

      let next = result.state;
      // resetToSample is the one action allowed to overwrite quarantined
      // storage — see storage.ts's file header.
      if (action.type === "resetToSample") quarantinedRef.current = false;

      if (result.documentChanged && !quarantinedRef.current) {
        const write = saveComposerDocument(next.document);
        next = {
          ...next,
          saveStatus: write.ok ? { kind: "saved" } : { kind: "error", reason: write.error ?? "Storage write failed" },
        };
      }
      stateRef.current = next;
      setState(next);
    },
    [manifest, idFactory],
  );

  // SPA-router + native beforeunload guard while the document is not "saved".
  useEffect(
    () => installComposerNavigationGuard(() => hasUnsavedChanges(stateRef.current!)),
    [],
  );

  // Mirror the vanilla resizer script's committed widths into typed state
  // (the drag/keyboard mechanics themselves run outside Preact for
  // per-pixel performance — see resizer-scripts-source.ts).
  useEffect(() => {
    function onWidthChange(event: Event): void {
      const detail = (event as CustomEvent<ComposerWidthChangeDetail>).detail;
      if (!detail) return;
      dispatch(
        detail.rail === "tree"
          ? { type: "setLeftWidth", width: detail.width }
          : { type: "setRightWidth", width: detail.width },
      );
    }
    document.addEventListener(WIDTH_CHANGE_EVENT, onWidthChange);
    return () => document.removeEventListener(WIDTH_CHANGE_EVENT, onWidthChange);
  }, [dispatch]);

  return useMemo<ComposerController>(
    () => ({
      state,
      manifest,
      lastError,
      add: (target, componentId) => dispatch({ type: "add", target, componentId }),
      updateProps: (nodeId, patch) => dispatch({ type: "updateProps", nodeId, patch }),
      reorder: (nodeId, direction) => dispatch({ type: "reorder", nodeId, direction }),
      remove: (nodeId) => dispatch({ type: "remove", nodeId }),
      copy: (nodeId) => dispatch({ type: "copy", nodeId }),
      cut: (nodeId) => dispatch({ type: "cut", nodeId }),
      paste: (target) => dispatch({ type: "paste", target }),
      duplicate: (nodeId) => dispatch({ type: "duplicate", nodeId }),
      select: (nodeId) => dispatch({ type: "select", nodeId }),
      reveal: (nodeId) => dispatch({ type: "reveal", nodeId }),
      toggleExpanded: (nodeId) => dispatch({ type: "toggleExpanded", nodeId }),
      setExpanded: (nodeId, expanded) => dispatch({ type: "setExpanded", nodeId, expanded }),
      setMode: (mode) => dispatch({ type: "setMode", mode }),
      setViewport: (viewport) => dispatch({ type: "setViewport", viewport }),
      setLeftWidth: (width) => {
        setPersistedWidth(LS_TREE_WIDTH, width);
        dispatch({ type: "setLeftWidth", width });
      },
      setRightWidth: (width) => {
        setPersistedWidth(LS_INSPECTOR_WIDTH, width);
        dispatch({ type: "setRightWidth", width });
      },
      reload: () => {
        const init = initializeComposerStorage(sample);
        const { notice, status, quarantined } = resolveLoadResult(init);
        quarantinedRef.current = quarantined;
        dispatch({ type: "loadDocument", document: init.outcome.document, notice });
        dispatch({ type: "setSaveStatus", status });
      },
      reset: () => dispatch({ type: "resetToSample", document: resetToSample(sample) }),
      dismissLoadNotice: () => dispatch({ type: "dismissLoadNotice" }),
    }),
    [state, manifest, lastError, dispatch, sample],
  );
}
