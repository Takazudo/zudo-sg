"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The production Composer app (issue #251). Fills #247's `ComposerWorkspace`
// slots with the real surfaces and drives them all from ONE controller via
// `useComposerIntegration` — no second renderer/source mapping, one document
// snapshot everywhere:
//
//   toolbar   → #249 pieces (composed in ComposerToolbarBar) + viewport control
//   banner    → #247 load-notice (recovered/quarantined storage)
//   tree      → #250 structure rail (read-only in Preview)
//   canvas    → the #248 preview iframe host (ComposerCanvasHost)
//   inspector → #249 schema-driven inspector
//
// The shared component chooser (#250) is mounted ONCE here, at app level —
// opened by BOTH tree slot Adds and canvas insert-point `request-add`s, capturing
// its target on open so a later selection change cannot redirect an in-flight
// add. The export dialog (#249) reads the SAME document/manifest the canvas does.
//
// The context menu (#256) is likewise mounted ONCE here: `useComposerMenus`
// owns which menu is open and its derived items, `ComposerTree` opens it via
// its `onOpenNodeMenu`/`onOpenInsertMenu` callbacks, and `ComposerCanvasHost`
// opens it via the SAME two callbacks after translating the iframe-relayed
// rect to host coordinates — one menu, one positioning/dismissal
// implementation, regardless of origin.
//
// This file is deliberately thin: state lives in the controller, callback
// composition lives in `useComposerIntegration`, layout lives in
// `ComposerWorkspace`. It is the surface waves 6-9 extend.

import { useEffect } from "preact/hooks";
import type { JSX } from "preact";
import type { ComposerManifestEntry } from "@/styleguide/data/composer-registry";
import { ComposerWorkspace } from "@/features/composer/chrome/composer-workspace";
import { ComposerLoadNoticeBanner } from "@/features/composer/chrome/composer-load-notice";
import type { UseComposerControllerOptions } from "@/features/composer/chrome/use-composer-controller";
import { ComposerTree } from "@/features/composer/ui/tree/composer-tree";
import { ComposerChooser } from "@/features/composer/ui/chooser/composer-chooser";
import { ComposerMenu } from "@/features/composer/ui/menu/composer-menu";
import { SubtreeRemovalConfirm } from "@/features/composer/ui/tree/tree-row-actions";
import { InspectorPanel } from "@/features/composer/ui/inspector/inspector-panel";
import { ComposerExportDialog } from "@/features/composer/ui/export/export-dialog";
import {
  createComposerPreviewBridge,
  type ComposerPreviewLocation,
  type MessageTarget,
} from "@/features/composer/preview";
import { ComposerCanvasHost } from "./composer-canvas-host";
import { ComposerToolbarBar } from "./composer-toolbar-bar";
import { useComposerIntegration } from "./use-composer-integration";
import { useComposerKeyboard } from "./use-composer-keyboard";
import { useComposerMenus } from "./use-composer-menus";

export interface ComposerIntegrationProps {
  /** The richer catalog. Defaults to the real derived `composerManifest`. */
  manifestEntries?: readonly ComposerManifestEntry[];
  /** Forwarded to the controller (sample/idFactory overrides for tests). */
  controllerOptions?: Omit<UseComposerControllerOptions, "manifest">;

  // ── Canvas bridge test seams (production defaults) ────────────────────────
  createBridge?: typeof createComposerPreviewBridge;
  previewLocation?: ComposerPreviewLocation;
  hostWindow?: MessageTarget;
  /** Production route coordinator seam for landing debounced props before transitions. */
  registerFlushPendingProps?: (flush: (() => void) | null) => void;
  onNavigateToLibrary?: () => void;
  onDuplicateComposition?: () => void;
  duplicatingComposition?: boolean;
  navigationError?: string | null;
  onRetryNavigation?: () => void;
  navigationRetrying?: boolean;
  recoveryNotice?: string | null;
  onRetryRecovery?: () => void;
  recoveryRetrying?: boolean;
}

export function ComposerIntegration(props: ComposerIntegrationProps): JSX.Element {
  const api = useComposerIntegration({
    manifestEntries: props.manifestEntries,
    controllerOptions: props.controllerOptions,
  });
  const { controller, manifestEntries, session, viewport, setViewport, chooser, exportState, titleFor } = api;
  const { state } = controller;
  const readOnly = state.mode === "preview";
  const menus = useComposerMenus(api);

  useEffect(() => {
    props.registerFlushPendingProps?.(controller.flushPropUpdates);
    return () => props.registerFlushPendingProps?.(null);
  }, [controller.flushPropUpdates, props.registerFlushPendingProps]);

  useComposerKeyboard({
    mode: state.mode,
    selectedId: state.selectedId,
    onRemoveSelected: api.handleRemoveSelected,
    onEscape: api.handleEscape,
    menuOpen: menus.open,
  });

  return (
    <>
      <ComposerWorkspace
        treeWidthPx={state.leftWidth}
        inspectorWidthPx={state.rightWidth}
        banner={
          <>
            {props.navigationError && (
              <div class="sg-composer-library-alert sg-composer-library-alert-error" role="alert">
                <p>{props.navigationError}</p>
                {props.onRetryNavigation && (
                  <button
                    type="button"
                    class="sg-composer-library-button"
                    disabled={props.navigationRetrying}
                    onClick={props.onRetryNavigation}
                  >
                    {props.navigationRetrying ? "Retrying navigation…" : "Retry navigation"}
                  </button>
                )}
              </div>
            )}
            {props.recoveryNotice && (
              <div class="sg-composer-library-alert" aria-label="Composition recovery notice">
                <p>{props.recoveryNotice}</p>
                {props.onRetryRecovery && (
                  <button
                    type="button"
                    class="sg-composer-library-button"
                    disabled={props.recoveryRetrying}
                    onClick={props.onRetryRecovery}
                  >
                    {props.recoveryRetrying ? "Retrying recovery…" : "Retry recovery"}
                  </button>
                )}
              </div>
            )}
            {state.loadNotice && (
              <ComposerLoadNoticeBanner notice={state.loadNotice} onDismiss={controller.dismissLoadNotice} />
            )}
          </>
        }
        toolbar={
          <ComposerToolbarBar
            documentName={state.document.name}
            saveStatus={state.saveStatus}
            mode={state.mode}
            viewport={viewport}
            onSetMode={controller.setMode}
            onSetViewport={setViewport}
            onReset={controller.reset}
            onRetrySave={controller.retrySave}
            onExport={exportState.openExport}
            clipboard={state.clipboard}
            titleFor={titleFor}
            onNavigateToLibrary={props.onNavigateToLibrary}
            onDuplicateComposition={props.onDuplicateComposition}
            duplicatingComposition={props.duplicatingComposition}
          />
        }
        tree={
          <ComposerTree
            document={state.document}
            manifest={controller.manifest}
            entries={manifestEntries}
            selectedId={state.selectedId}
            expandedIds={state.expandedIds}
            onSelect={controller.select}
            onReveal={controller.reveal}
            onToggleExpanded={controller.toggleExpanded}
            onOpenChooser={api.openChooser}
            onReorder={controller.reorder}
            onRemove={controller.remove}
            onOpenNodeMenu={menus.handleTreeOpenNodeMenu}
            onOpenInsertMenu={menus.handleTreeOpenInsertMenu}
            readOnly={readOnly}
          />
        }
        canvas={
          <ComposerCanvasHost
            document={state.document}
            session={session}
            viewport={viewport}
            onSelect={api.handleCanvasSelect}
            onRequestAdd={api.handleCanvasRequestAdd}
            onRequestNodeMenu={menus.openNodeMenu}
            onRequestInsertMenu={menus.openInsertMenu}
            onCommitInlineEdit={api.handleCommitInlineEdit}
            onDropNode={api.handleDropNode}
            createBridge={props.createBridge}
            location={props.previewLocation}
            hostWindow={props.hostWindow}
          />
        }
        inspector={
          <InspectorPanel
            document={state.document}
            manifest={controller.manifest}
            selectedId={state.selectedId}
            mode={state.mode}
            onUpdateProps={controller.updateProps}
            onUpdatePropsDebounced={controller.updatePropsDebounced}
            onFlushPendingProps={controller.flushPropUpdates}
            onReorder={controller.reorder}
            onRemove={controller.remove}
            titleFor={titleFor}
          />
        }
      />

      <ComposerChooser
        open={chooser.open}
        target={chooser.target}
        document={state.document}
        manifest={controller.manifest}
        entries={manifestEntries}
        onAdd={api.handleChooserAdd}
        onExpandAncestors={api.handleExpandAncestors}
        onClose={api.closeChooser}
      />

      <ComposerMenu
        open={menus.open}
        label={menus.label}
        anchor={menus.anchor}
        onClose={menus.onClose}
        items={menus.items ?? undefined}
      >
        {menus.confirm && (
          <SubtreeRemovalConfirm
            nodeTitle={menus.confirm.nodeTitle}
            descendantCount={menus.confirm.descendantCount}
            onCancel={menus.onCancelConfirm}
            onConfirm={menus.onConfirmDelete}
          />
        )}
      </ComposerMenu>

      <ComposerExportDialog
        open={exportState.open}
        onClose={exportState.closeExport}
        documentName={state.document.name}
        result={exportState.result}
      />
    </>
  );
}

ComposerIntegration.displayName = "ComposerIntegration";
