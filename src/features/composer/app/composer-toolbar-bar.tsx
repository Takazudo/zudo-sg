/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The central Composer app's toolbar (issue #251). Reconciles the two toolbar
// assemblies: rather than reuse #247's monolithic `chrome/ComposerToolbar`
// (which predates the Export action and inlines its own mode toggle), this
// COMPOSES #249's presentational pieces — `ComposerStatusIndicator`,
// `ComposerModeToggle`, `ComposerToolbarActions` (Reset + Export) — plus the
// canvas-viewport `<select>` this issue owns. Purely presentational; every
// action is a typed callback the integration composes against the one
// controller. The status indicator keeps its `children` seam open for wave-6's
// clipboard chip (#255).

import type { JSX } from "preact";
import type {
  ComposerCanvasViewport,
  ComposerMode,
  ComposerSaveStatus,
} from "@/features/composer/chrome/controller-model";
import { ComposerModeToggle } from "@/features/composer/ui/toolbar/mode-toggle";
import { ComposerStatusIndicator } from "@/features/composer/ui/toolbar/status-indicator";
import { ComposerToolbarActions } from "@/features/composer/ui/toolbar/toolbar-actions";
import { COMPOSER_VIEWPORTS, COMPOSER_VIEWPORT_LABELS } from "./viewport";

export interface ComposerToolbarBarProps {
  documentName: string;
  saveStatus: ComposerSaveStatus;
  mode: ComposerMode;
  viewport: ComposerCanvasViewport;
  onSetMode: (mode: ComposerMode) => void;
  onSetViewport: (viewport: ComposerCanvasViewport) => void;
  onReset: () => void;
  onExport: () => void;
  exportDisabled?: boolean;
}

export function ComposerToolbarBar({
  documentName,
  saveStatus,
  mode,
  viewport,
  onSetMode,
  onSetViewport,
  onReset,
  onExport,
  exportDisabled = false,
}: ComposerToolbarBarProps): JSX.Element {
  return (
    <>
      <div class="flex items-center gap-hsp-md min-w-0">
        <div class="min-w-0">
          <p class="text-xs text-muted uppercase tracking-wide">Composition</p>
          <strong class="block truncate text-fg text-small font-semibold">{documentName}</strong>
        </div>
        <ComposerStatusIndicator saveStatus={saveStatus} />
      </div>

      <div class="flex items-center gap-hsp-sm">
        <label class="flex items-center gap-hsp-2xs text-small text-muted">
          <span class="sr-only">Canvas viewport</span>
          <select
            class="border border-border rounded-md bg-surface px-hsp-xs py-vsp-3xs text-fg"
            value={viewport}
            onChange={(e) => {
              if (e.target instanceof HTMLSelectElement) {
                onSetViewport(e.target.value as ComposerCanvasViewport);
              }
            }}
          >
            {COMPOSER_VIEWPORTS.map((v) => (
              <option key={v} value={v}>
                {COMPOSER_VIEWPORT_LABELS[v]}
              </option>
            ))}
          </select>
        </label>

        <ComposerModeToggle mode={mode} onSetMode={onSetMode} />

        <ComposerToolbarActions onReset={onReset} onExport={onExport} exportDisabled={exportDisabled} />
      </div>
    </>
  );
}
