"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The `/composer` client island entry (issue #247) — composes the controller
// hook with the presentational workspace shell. This is the component
// `pages/composer/index.tsx` mounts via zfb's `<Island>`.
//
// Deliberately thin: all state lives in `useComposerController`, all layout
// lives in `ComposerWorkspace`. Tree/canvas/inspector stay at their default
// placeholders (see ComposerWorkspace's header) — wiring the real structure
// tree (#250), preview iframe (#248), and inspector (#249) in here is
// explicitly the wave-5 integration's job (#251), not this issue's.

import type { JSX } from "preact";
import { useComposerController } from "./use-composer-controller";
import { ComposerWorkspace } from "./composer-workspace";
import { ComposerToolbar } from "./composer-toolbar";
import { ComposerLoadNoticeBanner } from "./composer-load-notice";

export default function ComposerApp(): JSX.Element {
  const controller = useComposerController();
  const { state } = controller;

  return (
    <ComposerWorkspace
      treeWidthPx={state.leftWidth}
      inspectorWidthPx={state.rightWidth}
      banner={
        state.loadNotice && (
          <ComposerLoadNoticeBanner notice={state.loadNotice} onDismiss={controller.dismissLoadNotice} />
        )
      }
      toolbar={
        <ComposerToolbar
          documentName={state.document.name}
          mode={state.mode}
          viewport={state.viewport}
          saveStatus={state.saveStatus}
          onSetMode={controller.setMode}
          onSetViewport={controller.setViewport}
          onReset={controller.reset}
        />
      }
    />
  );
}

ComposerApp.displayName = "ComposerApp";
