"use client";

// The Composer's record-scoped client controller. It keeps the synchronous
// reducer/preview/export ordering established by #247 while handing immutable
// record revisions to #300's async save queue:
//
//   controller-model.ts  — the document + session-state reducer
//   persistence/save-queue.ts — serialized, revision-aware record writes
//   navigation-guard.ts   — the SPA-router "unsaved edits" guard
//   resizer-contract.ts   — the vanilla-JS resizer script's width bridge
//
// A supported CompositionRecord is loaded before this hook is mounted; the
// record-scoped path performs no provider read. The optional sample-only path
// remains temporarily for the pre-library production mount and is replaced by
// the provider/route composition in #305.
//
// State is kept in a ref (not just `useState`) so `dispatch` can always act
// on the latest value without depending on `state` (which would otherwise
// force a new `dispatch` identity — and a new navigation-guard/effect
// teardown — on every action).

import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type {
  ComponentManifest,
  CompositionDocument,
  CompositionRecord,
  CompositionSaveQueue,
  CompositionSaveQueueState,
  IdFactory,
  InsertionTarget,
  JsonObject,
} from "@/composer";
import {
  cloneJson,
  createManifest,
  createSampleDocument,
  createUuidIdFactory,
  resetToSample,
} from "@/composer";
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
  /** The live record draft. Its id/createdAt stay fixed for this mounted controller. */
  record: CompositionRecord;
  manifest: ComponentManifest;
  /** Non-null right after a rejected command (e.g. cardinality/accepts) until the next successful action. */
  lastError: string | null;
  add: (target: InsertionTarget, componentId: string) => void;
  rename: (name: string) => void;
  updateProps: (nodeId: string, patch: JsonObject) => void;
  /**
   * Debounced sibling of `updateProps` for PER-KEYSTROKE sources (the
   * inspector's text/color/number streams, issue #291/#259). Patches are
   * coalesced per node and dispatched once per typing pause, so the whole
   * expensive commit path (reducer → immutable record snapshot + save queue
   * → preview-iframe re-render) runs once per pause instead of once per
   * keystroke — the same cheap-live-path / expensive-commit-point split the
   * rail resizer documents (resizer-scripts-source.ts). Deterministic flush
   * guarantees (a pending patch can never be lost or reordered):
   *   - any OTHER controller action (select, remove, setMode, …) flushes the
   *     pending patch FIRST, so the reducer always sees events in user order;
   *   - `flushPropUpdates` is wired to field blur, export/JSX generation, the
   *     navigation guard, and controller unmount.
   */
  updatePropsDebounced: (nodeId: string, patch: JsonObject) => void;
  /**
   * Synchronously dispatch any `updatePropsDebounced` patches still pending.
   * Returns the post-flush document read from the live state ref — fresh in
   * the SAME tick, which is what export needs (a re-render hasn't happened
   * yet when export generates JSX right after flushing).
   */
  flushPropUpdates: () => CompositionDocument;
  /** Commit pending props synchronously, then await persistence of the newest record revision. */
  flushPersistence: () => Promise<void>;
  /** Retry the newest retained draft after a persistence error. */
  retrySave: () => void;
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
  /**
   * Canvas drag & drop (issue #258): move (or, when `copy`, clone) `sourceNodeId`
   * to `target`, then select + reveal it. Atomically revalidated (slot/
   * cardinality/cycle/root/opaque-policy); an invalid drop surfaces via
   * `lastError`, never a silent partial change.
   */
  drop: (sourceNodeId: string, target: InsertionTarget, copy: boolean) => void;
  select: (nodeId: string | null) => void;
  reveal: (nodeId: string) => void;
  toggleExpanded: (nodeId: string) => void;
  setExpanded: (nodeId: string, expanded: boolean) => void;
  setMode: (mode: ComposerMode) => void;
  setViewport: (viewport: ComposerCanvasViewport) => void;
  setLeftWidth: (width: number) => void;
  setRightWidth: (width: number) => void;
  /** Legacy localStorage reload. Record-scoped controllers leave loading to the route coordinator. */
  reload: () => void;
  /** Restore the sample body while preserving a record-scoped controller's identity. */
  reset: () => void;
  dismissLoadNotice: () => void;
}

export interface UseComposerControllerOptions {
  manifest?: ComponentManifest;
  /** Already-loaded supported record. Must be paired with `saveQueue`. */
  record?: CompositionRecord;
  /** Record-scoped queue created for the same provider-qualified record. */
  saveQueue?: CompositionSaveQueue;
  sample?: CompositionDocument;
  idFactory?: IdFactory;
  now?: () => string;
}

const defaultManifest = createManifest(composerManifest);

/** 200ms — just above a fast typist's ~100-180ms inter-key gap (so steady typing coalesces into one trailing commit) yet keeps the trailing persist+preview inside the ~300ms "feels instant" budget; the UX trade is documented in #259. */
export const INSPECTOR_COMMIT_DEBOUNCE_MS = 200;

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

function saveStatusFromQueue(state: CompositionSaveQueueState): ComposerSaveStatus {
  switch (state.status) {
    case "saved":
      return { kind: "saved" };
    case "dirty":
      return { kind: "dirty" };
    case "saving":
      return { kind: "saving" };
    case "error":
      return { kind: "error", reason: state.error.message };
  }
}

export function useComposerController(options: UseComposerControllerOptions = {}): ComposerController {
  const manifest = options.manifest ?? defaultManifest;
  const sample = useMemo(() => options.sample ?? createSampleDocument(), [options.sample]);
  const idFactory = useMemo(() => options.idFactory ?? createUuidIdFactory(), [options.idFactory]);
  const now = options.now ?? (() => new Date().toISOString());

  if ((options.record === undefined) !== (options.saveQueue === undefined)) {
    throw new Error("useComposerController requires record and saveQueue together.");
  }

  const quarantinedRef = useRef(false);
  const queueRef = useRef<CompositionSaveQueue | null>(options.saveQueue ?? null);
  const nowRef = useRef(now);
  const recordRef = useRef<CompositionRecord | null>(null);
  const stateRef = useRef<ComposerControllerState | null>(null);
  if (stateRef.current === null) {
    let document: CompositionDocument;
    let notice: ComposerLoadNotice | null;
    let status: ComposerSaveStatus;
    if (options.record && options.saveQueue) {
      const record = cloneJson(options.record);
      if (
        record.id !== record.document.id ||
        options.saveQueue.ref.recordId !== record.id
      ) {
        throw new Error("The loaded Composition record does not match its save queue identity.");
      }
      recordRef.current = record;
      document = record.document;
      notice = null;
      status = saveStatusFromQueue(options.saveQueue.state);
    } else {
      // Transitional adapter for the pre-library production mount and its
      // existing tests. Provider-aware routing replaces this in #305. The
      // record-scoped path above never reads a persistence API during render.
      const init = initializeComposerStorage(sample);
      const resolved = resolveLoadResult(init);
      quarantinedRef.current = resolved.quarantined;
      document = init.outcome.document;
      notice = resolved.notice;
      status = resolved.status;
      const timestamp = nowRef.current();
      recordRef.current = {
        id: document.id,
        createdAt: timestamp,
        updatedAt: timestamp,
        document,
      };
    }
    stateRef.current = createInitialControllerState({
      document,
      manifest,
      loadNotice: notice,
      saveStatus: status,
      leftWidth: getPersistedWidth(LS_TREE_WIDTH, MIN_RAIL_W),
      rightWidth: getPersistedWidth(LS_INSPECTOR_WIDTH, MIN_RAIL_W),
    });
  }

  const [state, setState] = useState<ComposerControllerState>(stateRef.current);
  const [lastError, setLastError] = useState<string | null>(null);
  const pendingPropsRef = useRef<Map<string, JsonObject>>(new Map());
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingBaseSaveStatusRef = useRef<ComposerSaveStatus | null>(null);

  const applyAction = useCallback(
    (action: ComposerAction) => {
      const current = stateRef.current!;
      const result = applyComposerAction(current, action, { manifest, idFactory });
      setLastError(result.error);
      if (result.error) {
        const restoredStatus = queueRef.current
          ? saveStatusFromQueue(queueRef.current.state)
          : pendingBaseSaveStatusRef.current;
        if (restoredStatus && current.saveStatus.kind === "dirty") {
          const next = { ...current, saveStatus: restoredStatus };
          stateRef.current = next;
          setState(next);
        }
        return;
      }

      let next = result.state;
      // resetToSample is the one action allowed to overwrite quarantined
      // storage — see storage.ts's file header.
      if (action.type === "resetToSample") quarantinedRef.current = false;

      if (result.documentChanged) {
        recordRef.current = {
          ...recordRef.current!,
          updatedAt: nowRef.current(),
          document: next.document,
        };

        const queue = queueRef.current;
        if (queue) {
          try {
            queue.edit(queue.ref, recordRef.current);
            next = { ...next, saveStatus: saveStatusFromQueue(queue.state) };
          } catch (error) {
            next = {
              ...next,
              saveStatus: {
                kind: "error",
                reason: error instanceof Error ? error.message : "Composition persistence failed.",
              },
            };
          }
        } else if (!quarantinedRef.current) {
          const write = saveComposerDocument(next.document);
          next = {
            ...next,
            saveStatus: write.ok ? { kind: "saved" } : { kind: "error", reason: write.error ?? "Storage write failed" },
          };
        } else if (pendingBaseSaveStatusRef.current) {
          next = { ...next, saveStatus: pendingBaseSaveStatusRef.current };
        }
      } else if (action.type === "updateProps" && pendingBaseSaveStatusRef.current) {
        next = {
          ...next,
          saveStatus: queueRef.current
            ? saveStatusFromQueue(queueRef.current.state)
            : pendingBaseSaveStatusRef.current,
        };
      }
      stateRef.current = next;
      setState(next);
    },
    [manifest, idFactory],
  );

  // ── Debounced updateProps channel (issue #291) ─────────────────────────────
  // Per-keystroke inspector commits are coalesced here: the pending patch map
  // holds the latest merged patch per node, and only the trailing edge of a
  // typing burst dispatches (→ record snapshot + save queue + preview render).
  const flushPropUpdates = useCallback((): CompositionDocument => {
    if (pendingTimerRef.current !== null) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    if (pendingPropsRef.current.size > 0) {
      const pending = pendingPropsRef.current;
      pendingPropsRef.current = new Map();
      for (const [nodeId, patch] of pending) applyAction({ type: "updateProps", nodeId, patch });
      pendingBaseSaveStatusRef.current = null;
    }
    return stateRef.current!.document;
  }, [applyAction]);

  // Every non-debounced action flushes pending keystroke patches FIRST, so the
  // reducer always sees user events in real order — a pending text edit lands
  // BEFORE the remove/reorder/mode-switch/reset that followed it, and a patch
  // can never target a node an interleaved action already removed.
  const dispatch = useCallback(
    (action: ComposerAction) => {
      flushPropUpdates();
      applyAction(action);
    },
    [flushPropUpdates, applyAction],
  );

  const updatePropsDebounced = useCallback(
    (nodeId: string, patch: JsonObject) => {
      const pending = pendingPropsRef.current;
      if (pending.size === 0) pendingBaseSaveStatusRef.current = stateRef.current!.saveStatus;
      pending.set(nodeId, { ...pending.get(nodeId), ...patch });
      const current = stateRef.current!;
      if (current.saveStatus.kind !== "dirty") {
        const next = { ...current, saveStatus: { kind: "dirty" } as const };
        stateRef.current = next;
        setState(next);
      }
      if (pendingTimerRef.current !== null) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(() => {
        pendingTimerRef.current = null;
        flushPropUpdates();
      }, INSPECTOR_COMMIT_DEBOUNCE_MS);
    },
    [flushPropUpdates],
  );

  const flushPersistence = useCallback(async (): Promise<void> => {
    flushPropUpdates();
    const queue = queueRef.current;
    if (queue) await queue.flush();
  }, [flushPropUpdates]);

  const flushPropUpdatesRef = useRef(flushPropUpdates);
  flushPropUpdatesRef.current = flushPropUpdates;

  const retrySave = useCallback((): void => {
    flushPropUpdates();
    const queue = queueRef.current;
    if (!queue) return;
    try {
      queue.retry();
    } catch (error) {
      const current = stateRef.current!;
      const next = {
        ...current,
        saveStatus: {
          kind: "error" as const,
          reason: error instanceof Error ? error.message : "Composition persistence failed.",
        },
      };
      stateRef.current = next;
      setState(next);
    }
  }, [flushPropUpdates]);

  // Queue state is provider-neutral. Pending debounce input remains visibly
  // dirty even if an older revision finishes while the 200ms timer is open.
  // On unmount, land pending props, detach immediately, and explicitly consume
  // close() so teardown can neither claim a late success nor leak a rejection.
  useEffect(() => {
    const queue = queueRef.current;
    if (!queue) return () => void flushPropUpdatesRef.current();
    const unsubscribe = queue.subscribe((queueState) => {
      const current = stateRef.current!;
      const saveStatus: ComposerSaveStatus =
        pendingPropsRef.current.size > 0 ? { kind: "dirty" } : saveStatusFromQueue(queueState);
      if (
        current.saveStatus.kind === saveStatus.kind &&
        (saveStatus.kind !== "error" ||
          (current.saveStatus.kind === "error" && current.saveStatus.reason === saveStatus.reason))
      ) {
        return;
      }
      const next = { ...current, saveStatus };
      stateRef.current = next;
      setState(next);
    });
    return () => {
      flushPropUpdatesRef.current();
      unsubscribe();
      void queue.close().catch(() => undefined);
    };
  }, []);

  // SPA-router + native beforeunload guard while the document is not "saved".
  // The guard flushes first: a debounce-pending keystroke is LANDED before
  // deciding, then async dirty/in-flight work synchronously blocks navigation.
  useEffect(
    () =>
      installComposerNavigationGuard(() => {
        flushPropUpdates();
        const queue = queueRef.current;
        return (
          pendingPropsRef.current.size > 0 ||
          hasUnsavedChanges(stateRef.current!) ||
          (queue ? queue.state.dirty || queue.state.saving : false)
        );
      }),
    [flushPropUpdates],
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
      record: recordRef.current!,
      manifest,
      lastError,
      add: (target, componentId) => dispatch({ type: "add", target, componentId }),
      rename: (name) => dispatch({ type: "rename", name }),
      updateProps: (nodeId, patch) => dispatch({ type: "updateProps", nodeId, patch }),
      updatePropsDebounced,
      flushPropUpdates,
      flushPersistence,
      retrySave,
      reorder: (nodeId, direction) => dispatch({ type: "reorder", nodeId, direction }),
      remove: (nodeId) => dispatch({ type: "remove", nodeId }),
      copy: (nodeId) => dispatch({ type: "copy", nodeId }),
      cut: (nodeId) => dispatch({ type: "cut", nodeId }),
      paste: (target) => dispatch({ type: "paste", target }),
      duplicate: (nodeId) => dispatch({ type: "duplicate", nodeId }),
      drop: (sourceNodeId, target, copy) => dispatch({ type: "drop", sourceNodeId, target, copy }),
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
        // Provider-aware loading belongs to the route coordinator. A mounted
        // record-scoped controller never reaches back into a provider.
        if (queueRef.current) {
          flushPropUpdates();
          return;
        }
        // Land any debounce-pending edit BEFORE reading storage (issue #291) —
        // otherwise the flush inside the loadDocument dispatch below would
        // write storage AFTER this read, leaving state and storage diverged.
        flushPropUpdates();
        const init = initializeComposerStorage(sample);
        const { notice, status, quarantined } = resolveLoadResult(init);
        quarantinedRef.current = quarantined;
        dispatch({ type: "loadDocument", document: init.outcome.document, notice });
        dispatch({ type: "setSaveStatus", status });
      },
      reset: () => {
        const document = resetToSample(sample);
        if (queueRef.current) document.id = recordRef.current!.id;
        dispatch({ type: "resetToSample", document });
      },
      dismissLoadNotice: () => dispatch({ type: "dismissLoadNotice" }),
    }),
    [
      state,
      manifest,
      lastError,
      dispatch,
      updatePropsDebounced,
      flushPropUpdates,
      flushPersistence,
      retrySave,
      sample,
    ],
  );
}
