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
// This file is deliberately thin: state lives in the controller, callback
// composition lives in `useComposerIntegration`, layout lives in
// `ComposerWorkspace`. It is the surface waves 6-9 extend.

import type { JSX } from "preact";
import type { ComposerManifestEntry } from "@/styleguide/data/composer-registry";
import { ComposerWorkspace } from "@/features/composer/chrome/composer-workspace";
import { ComposerLoadNoticeBanner } from "@/features/composer/chrome/composer-load-notice";
import type { UseComposerControllerOptions } from "@/features/composer/chrome/use-composer-controller";
import { ComposerTree } from "@/features/composer/ui/tree/composer-tree";
import { ComposerChooser } from "@/features/composer/ui/chooser/composer-chooser";
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

export interface ComposerIntegrationProps {
  /** The richer catalog. Defaults to the real derived `composerManifest`. */
  manifestEntries?: readonly ComposerManifestEntry[];
  /** Forwarded to the controller (sample/idFactory overrides for tests). */
  controllerOptions?: Omit<UseComposerControllerOptions, "manifest">;

  // ── Canvas bridge test seams (production defaults) ────────────────────────
  createBridge?: typeof createComposerPreviewBridge;
  previewLocation?: ComposerPreviewLocation;
  hostWindow?: MessageTarget;
}

export function ComposerIntegration(props: ComposerIntegrationProps): JSX.Element {
  const api = useComposerIntegration({
    manifestEntries: props.manifestEntries,
    controllerOptions: props.controllerOptions,
  });
  const { controller, manifestEntries, session, viewport, setViewport, chooser, exportState, titleFor } = api;
  const { state } = controller;
  const readOnly = state.mode === "preview";

  useComposerKeyboard({
    mode: state.mode,
    selectedId: state.selectedId,
    onRemoveSelected: api.handleRemoveSelected,
    onEscape: api.handleEscape,
  });

  return (
    <>
      <ComposerWorkspace
        treeWidthPx={state.leftWidth}
        inspectorWidthPx={state.rightWidth}
        banner={
          state.loadNotice && (
            <ComposerLoadNoticeBanner notice={state.loadNotice} onDismiss={controller.dismissLoadNotice} />
          )
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
            onExport={exportState.openExport}
            clipboard={state.clipboard}
            titleFor={titleFor}
          />
        }
        tree={
          <ComposerTree
            document={state.document}
            manifest={manifestEntries}
            selectedId={state.selectedId}
            expandedIds={state.expandedIds}
            onSelect={controller.select}
            onReveal={controller.reveal}
            onToggleExpanded={controller.toggleExpanded}
            onOpenChooser={api.openChooser}
            onReorder={controller.reorder}
            onRemove={controller.remove}
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
        manifest={manifestEntries}
        onAdd={api.handleChooserAdd}
        onExpandAncestors={api.handleExpandAncestors}
        onClose={api.closeChooser}
      />

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
