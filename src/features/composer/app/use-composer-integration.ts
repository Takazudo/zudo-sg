"use client";

// The central Composer integration hook (issue #251). This is the single place
// every surface's callbacks are composed against #247's ONE controller/reducer.
// It is also the seam waves 6-9 (#254 chooser-preview, #255 clipboard, #256
// menus, #257 inline-edit, #258 DnD) extend: they can call this hook to obtain
// the live session/document/selection and the shared chooser + callback set
// without re-deriving any of it.
//
// Manifest reconciliation (the one non-obvious wiring detail):
//   - the tree (#250) and chooser (#250) want the RICHER `ComposerManifestEntry[]`
//     array (title/category/description);
//   - the inspector (#249), the export generator (#245), and the controller
//     model (#245/#247) want the model-side `ComponentManifest` lookup.
//   `ComposerManifestEntry` is a structural superset of the model's
//   `ComponentManifestEntry`, so ONE richer array is the source of truth and the
//   `ComponentManifest` is DERIVED from it (`createManifest`) — never a second,
//   drift-prone manifest. The controller is handed that same derived manifest,
//   so `controller.manifest` is identical to what the inspector/export receive.

import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { InsertionTarget } from "@/composer";
import { createManifest } from "@/composer";
import type { ComposerManifestEntry } from "@/styleguide/data/composer-registry";
import { composerManifest } from "@/styleguide/data/composer-registry";
import type { ComposerCanvasViewport } from "@/features/composer/chrome/controller-model";
import {
  useComposerController,
  type ComposerController,
  type UseComposerControllerOptions,
} from "@/features/composer/chrome/use-composer-controller";
import type { PreviewSession, PreviewTheme } from "@/features/composer/preview";
import {
  useComposerExport,
  type UseComposerExportResult,
} from "@/features/composer/ui/export/use-composer-export";
import { useHostTheme } from "./use-host-theme";
import { getPersistedViewport, setPersistedViewport } from "./viewport";

export interface UseComposerIntegrationOptions {
  /** The richer catalog. Defaults to the real derived `composerManifest`. */
  manifestEntries?: readonly ComposerManifestEntry[];
  /** Forwarded to `useComposerController` (sample/idFactory overrides for tests). */
  controllerOptions?: Omit<UseComposerControllerOptions, "manifest">;
}

export interface ComposerChooserState {
  open: boolean;
  target: InsertionTarget | null;
}

export interface ComposerIntegrationApi {
  controller: ComposerController;
  /** The richer array — feed the tree + chooser. */
  manifestEntries: readonly ComposerManifestEntry[];
  /** The live preview snapshot's session half (mode + theme + selection). */
  session: PreviewSession;
  theme: PreviewTheme;
  viewport: ComposerCanvasViewport;
  /** Set + persist the canvas viewport. */
  setViewport: (viewport: ComposerCanvasViewport) => void;
  chooser: ComposerChooserState;
  openChooser: (target: InsertionTarget) => void;
  closeChooser: () => void;
  exportState: UseComposerExportResult;
  /** Friendly display name for a component id, from the richer catalog. */
  titleFor: (componentId: string) => string | undefined;

  // ── Composed callbacks (all resolve to the one controller) ────────────────
  /** Canvas selection: a real node reveals (selects + expands ancestors); `null` clears. */
  handleCanvasSelect: (nodeId: string | null) => void;
  /** Canvas insert point → open the shared parent chooser for that exact target. */
  handleCanvasRequestAdd: (target: InsertionTarget) => void;
  /** Chooser confirm → add the component at the captured target. */
  handleChooserAdd: (target: InsertionTarget, componentId: string) => void;
  /** Chooser expand-ancestors → reveal the freshly added node in the tree. */
  handleExpandAncestors: (nodeIds: string[]) => void;
  /** Keyboard remove → remove the given (selected) node. */
  handleRemoveSelected: (nodeId: string) => void;
  /** Keyboard Escape → close any open menu/dialog. */
  handleEscape: () => void;

  // ── Clipboard/duplicate seam (issue #255; wave 7's #256 menus call these) ──
  /** Copy: session clipboard = a snapshot of the node. Refused (via `controller.lastError`) for opaque nodes. */
  handleCopy: (nodeId: string) => void;
  /** Cut: copy + remove, with #245's selection repair. Refused for opaque nodes. */
  handleCut: (nodeId: string) => void;
  /** Paste: clone-with-new-ids + insert-subtree at `target`, then select + reveal it. An incompatible target surfaces via `controller.lastError`, never a silent no-op. */
  handlePaste: (target: InsertionTarget) => void;
  /** Duplicate: clone-with-new-ids + insert immediately after the source, then select + reveal it. Refused for opaque nodes. */
  handleDuplicate: (nodeId: string) => void;
}

export function useComposerIntegration(
  options: UseComposerIntegrationOptions = {},
): ComposerIntegrationApi {
  const manifestEntries = options.manifestEntries ?? composerManifest;
  const manifest = useMemo(() => createManifest(manifestEntries), [manifestEntries]);
  const controller = useComposerController({ manifest, ...options.controllerOptions });
  const { state } = controller;

  const theme = useHostTheme();

  // Restore the persisted viewport once, after mount (the controller always
  // initializes to "fluid"; dispatching during render is not allowed).
  useEffect(() => {
    const persisted = getPersistedViewport();
    if (persisted && persisted !== state.viewport) controller.setViewport(persisted);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const setViewport = useCallback(
    (viewport: ComposerCanvasViewport) => {
      setPersistedViewport(viewport);
      controller.setViewport(viewport);
    },
    [controller],
  );

  const session = useMemo<PreviewSession>(
    () => ({ mode: state.mode, theme, selectedId: state.selectedId }),
    [state.mode, theme, state.selectedId],
  );

  const [chooser, setChooser] = useState<ComposerChooserState>({ open: false, target: null });
  const openChooser = useCallback((target: InsertionTarget) => {
    setChooser({ open: true, target });
  }, []);
  const closeChooser = useCallback(() => setChooser({ open: false, target: null }), []);

  const exportState = useComposerExport(state.document, manifest);

  const titleFor = useMemo(() => {
    const byId = new Map(manifestEntries.map((e) => [e.componentId, e.title]));
    return (componentId: string) => byId.get(componentId);
  }, [manifestEntries]);

  const handleCanvasSelect = useCallback(
    (nodeId: string | null) => {
      if (nodeId === null) controller.select(null);
      else controller.reveal(nodeId);
    },
    [controller],
  );

  const handleCanvasRequestAdd = useCallback(
    (target: InsertionTarget) => openChooser(target),
    [openChooser],
  );

  const handleChooserAdd = useCallback(
    (target: InsertionTarget, componentId: string) => controller.add(target, componentId),
    [controller],
  );

  const handleExpandAncestors = useCallback(
    (nodeIds: string[]) => nodeIds.forEach((id) => controller.setExpanded(id, true)),
    [controller],
  );

  const handleRemoveSelected = useCallback(
    (nodeId: string) => controller.remove(nodeId),
    [controller],
  );

  const handleCopy = useCallback((nodeId: string) => controller.copy(nodeId), [controller]);
  const handleCut = useCallback((nodeId: string) => controller.cut(nodeId), [controller]);
  const handlePaste = useCallback((target: InsertionTarget) => controller.paste(target), [controller]);
  const handleDuplicate = useCallback((nodeId: string) => controller.duplicate(nodeId), [controller]);

  // Keep an escape handler whose identity only changes when what it must close
  // changes, so the keyboard hook does not re-bind on every controller update.
  const openStateRef = useRef({ chooserOpen: chooser.open, exportOpen: exportState.open });
  openStateRef.current = { chooserOpen: chooser.open, exportOpen: exportState.open };
  const handleEscape = useCallback(() => {
    if (openStateRef.current.chooserOpen) closeChooser();
    if (openStateRef.current.exportOpen) exportState.closeExport();
  }, [closeChooser, exportState]);

  return {
    controller,
    manifestEntries,
    session,
    theme,
    viewport: state.viewport,
    setViewport,
    chooser,
    openChooser,
    closeChooser,
    exportState,
    titleFor,
    handleCanvasSelect,
    handleCanvasRequestAdd,
    handleChooserAdd,
    handleExpandAncestors,
    handleRemoveSelected,
    handleEscape,
    handleCopy,
    handleCut,
    handlePaste,
    handleDuplicate,
  };
}
