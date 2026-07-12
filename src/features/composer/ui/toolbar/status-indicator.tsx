/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Reusable, composable Composer save-status indicator (issue #249). Mirrors
// the #247 toolbar's inline status span (`describeSaveStatus`) but extracted
// so a later status chip (wave-6 clipboard status, #255) can render beside
// it via `children` without editing the central Composer app entry — that's
// the "keep the status seam composable" synthesis note on this issue.

import type { ComponentChildren, JSX } from "preact";
import type { ComposerSaveStatus } from "@/features/composer/chrome/controller-model";
import { describeSaveStatus } from "@/features/composer/chrome/controller-model";

export interface ComposerStatusIndicatorProps {
  saveStatus: ComposerSaveStatus;
  /** Composability seam — e.g. wave-6's clipboard status chip renders here. */
  children?: ComponentChildren;
}

export function ComposerStatusIndicator({ saveStatus, children }: ComposerStatusIndicatorProps): JSX.Element {
  return (
    <div class="flex items-center gap-hsp-2xs">
      <span class="sg-composer-save-status" data-sg-status={saveStatus.kind} aria-live="polite">
        {describeSaveStatus(saveStatus)}
      </span>
      {children}
    </div>
  );
}
