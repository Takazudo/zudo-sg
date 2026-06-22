"use client";

// Client-side header controls for the styleguide chrome: toggle the right
// code panel and open the PREVIEW token tweaker. The sidebar toggle is handled
// by root's desktop-sidebar-toggle island (part of the shared docs chrome) —
// we do NOT duplicate that here.
//
// The Design Tokens trigger is NO LONGER rendered here: it now lives in the
// root header (site-wide) as a project-rendered icon dispatching
// "toggle-my-doc-tweak" (see pages/lib/_header-with-defaults.tsx). This island
// only adds the styleguide-only Preview tokens icon (and the code-panel toggle
// on detail pages), so styleguide pages show exactly two token icons
// (Design Tokens from the root header + Preview tokens here) while regular docs
// pages show one. See Takazudo/zudo-sg#84/#85.
//
// The Preview tokens trigger dispatches "toggle-preview-token-panel" — the
// distinct channel the preview-iframe panel instance listens on.
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

function openPreviewTokenPanel(): void {
  window.dispatchEvent(new CustomEvent("toggle-preview-token-panel"));
}

export default function SgHeaderToggles({
  showCodePanel = false,
}: HeaderTogglesProps): JSX.Element {
  // Icon controls matched to the framework chrome icons (search / theme toggle /
  // github / the root-header Design Tokens icon): `text-muted hover:text-fg`
  // treatment and a 20×20 feather-stroke SVG. Both controls are icon buttons so
  // the styleguide overlay stays a predictable pair of icons (sized by the
  // `--sg-header-toggles-slot` reservation in global.css). Class string is a
  // full literal (not composed at runtime) so the Tailwind v4 scanner generates
  // every utility.
  //
  // The code toggle is `hidden lg:inline-flex` — off mobile, where the code
  // panel stacks under the content. The Preview tokens icon stays visible
  // always.
  const codeIconButtonClass =
    "hidden lg:flex items-center justify-center text-muted " +
    "transition-colors hover:text-fg cursor-pointer";
  const iconButtonClass =
    "flex items-center justify-center text-muted transition-colors " +
    "hover:text-fg cursor-pointer";

  return (
    <div class="flex items-center gap-hsp-md">
      {showCodePanel && (
        <button
          type="button"
          class={codeIconButtonClass}
          onClick={() => toggleCodePanel()}
          aria-label="Toggle code panel"
          title="Toggle code panel"
        >
          {/* Code/brackets glyph — feather `<>` style, matched to the chrome
              icon set (20×20 viewBox, stroke-width 2). */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </button>
      )}
      <button
        type="button"
        class={iconButtonClass}
        onClick={openPreviewTokenPanel}
        aria-label="Open preview token panel"
        title="Preview tokens"
      >
        {/* Stacked-frames / layers glyph — evokes "preview iframe tokens".
            Cohesive matched pair with the root-header Design Tokens sliders
            glyph: same 20×20 viewBox, feather stroke-width 2, distinct shape. */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="13" height="13" rx="1.5" />
          <path d="M8 8h12.5A1.5 1.5 0 0 1 22 9.5V20a1.5 1.5 0 0 1-1.5 1.5H10A1.5 1.5 0 0 1 8.5 20" />
        </svg>
      </button>
    </div>
  );
}

SgHeaderToggles.displayName = "SgHeaderToggles";
