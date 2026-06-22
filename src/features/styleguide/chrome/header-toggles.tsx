"use client";

// Client-side header controls for the styleguide chrome: toggle the right
// code panel and open the design-token tweaker. The sidebar toggle is handled
// by root's desktop-sidebar-toggle island (part of the shared docs chrome) —
// we do NOT duplicate that here.
//
// The token-panel trigger dispatches the same `toggle-design-token-panel`
// event the host's existing zdtp bootstrap listens for.
//
// Rendered as its own `<Island when="load">` inside the StyleguideLayout
// header override: the surrounding header shell (brand + nav) is static SSR
// markup, so only this interactive part hydrates.

import type { JSX } from "preact";
import { toggleCodePanel } from "./panel-contract";

export interface HeaderTogglesProps {
  /** Whether to show the code-panel toggle (only on detail pages). */
  showCodePanel?: boolean;
}

function openTokenPanel(): void {
  window.dispatchEvent(new CustomEvent("toggle-design-token-panel"));
}

function openPreviewTokenPanel(): void {
  window.dispatchEvent(new CustomEvent("toggle-preview-token-panel"));
}

export default function SgHeaderToggles({
  showCodePanel = false,
}: HeaderTogglesProps): JSX.Element {
  // Native token styling: bordered pills using the docs semantic utilities.
  // The code toggle is `hidden lg:inline-flex` — off mobile, where the code
  // panel stacks under the content. The Tokens trigger stays visible always.
  // Class strings are written as full literals (not composed at runtime) so the
  // Tailwind v4 scanner generates every utility.
  const chromeToggleClass =
    "hidden lg:inline-flex items-center gap-hsp-2xs px-hsp-xs py-vsp-3xs " +
    "border border-muted rounded text-small text-muted hover:text-fg " +
    "transition-colors cursor-pointer";
  const tokenToggleClass =
    "inline-flex items-center gap-hsp-2xs px-hsp-xs py-vsp-3xs " +
    "border border-muted rounded text-small text-muted hover:text-fg " +
    "transition-colors cursor-pointer";

  return (
    <div class="flex items-center gap-hsp-2xs">
      {showCodePanel && (
        <button
          type="button"
          class={chromeToggleClass}
          onClick={() => toggleCodePanel()}
          title="Toggle code panel"
        >
          Code
        </button>
      )}
      <button
        type="button"
        class={tokenToggleClass}
        onClick={openTokenPanel}
        title="Open design-token tweaker"
      >
        Tokens
      </button>
      <button
        type="button"
        class={tokenToggleClass}
        onClick={openPreviewTokenPanel}
        title="Open preview token tweaker"
      >
        Preview tokens
      </button>
    </div>
  );
}

SgHeaderToggles.displayName = "SgHeaderToggles";
