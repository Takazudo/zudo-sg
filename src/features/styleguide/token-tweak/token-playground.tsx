"use client";

// Interactive layer for the `/components/tokens` reference. The swatch/spacing/
// type rows are SERVER-RENDERED (no-JS users still see the full token reference);
// this island wires the INTERACTIVITY on top via event delegation against the
// SSR DOM:
//
//   1. CLICK-TO-COPY — every `[data-sg-token]` element copies its token on
//      click. It copies the *resolved* value (read from getComputedStyle at
//      click time, so `light-dark()` / `var()` chains resolve to a concrete
//      hex / rem) AND keeps the `var(--name)` reference available. A small
//      toast confirms.
//   2. COPY MODE — a toggle picks whether a click copies the resolved value
//      (e.g. `#1f6f8b`) or the `var(--color-accent)` reference, since designers
//      want one and engineers the other.
//   3. LIVE TWEAK — a button opens the existing zdtp design-token panel via the
//      same "toggle-sg-doc-tweak" event the header Design Tokens icon
//      dispatches; edits there propagate to every preview iframe via the
//      token-tweak bridge, and — because the swatches use `var(--…)` inline —
//      this page's swatches update live too.
//
// Contract with the SSR markup (pages/components/tokens.tsx):
//   - Each copyable element is `[data-sg-token]` with:
//       data-var   → the custom property name, e.g. "--color-accent"
//       data-kind  → "color" | "length" | "raw" (formatting hint for the value)
//   - A `[data-sg-tokens-root]` element is the delegation host.

import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { copyText } from "@/features/styleguide/code-panel/copy-button";

type CopyMode = "value" | "var";

/** Read the resolved value of a custom property off :root. */
function resolveVar(varName: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}

export default function TokenPlayground(): JSX.Element {
  const [mode, setMode] = useState<CopyMode>("value");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  // Read `mode` through a ref inside the delegated click handler so the global
  // listener can register once (`[]` deps) instead of being torn down and
  // re-added on every mode toggle.
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    function onClick(e: MouseEvent): void {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>("[data-sg-token]");
      if (!el) return;
      e.preventDefault();
      const varName = el.dataset.var ?? "";
      if (!varName) return;

      const reference = `var(${varName})`;
      const resolved = resolveVar(varName) || reference;
      const text = modeRef.current === "var" ? reference : resolved;

      void copyText(text).then((ok) => {
        if (!ok) return;
        setToast(`Copied ${text}`);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 1600);
      });
    }

    const root = document.querySelector<HTMLElement>("[data-sg-tokens-root]");
    if (!root) return;
    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("click", onClick);
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  function openTweaker(): void {
    // "toggle-sg-doc-tweak" is the doc-chrome panel's explicit toggle channel.
    // The reserved "toggle-design-token-panel" is intentionally avoided so the
    // doc-chrome and preview zdtp instances stay isolated (Takazudo/zudo-sg#84).
    window.dispatchEvent(new CustomEvent("toggle-sg-doc-tweak"));
  }

  function openPreviewTweaker(): void {
    window.dispatchEvent(new CustomEvent("toggle-preview-token-panel"));
  }

  return (
    <div class="sg-token-toolbar">
      <div class="sg-token-modes" role="group" aria-label="Copy format">
        <span class="text-xs font-medium text-muted">Click copies:</span>
        <button
          type="button"
          class="sg-chip"
          aria-pressed={mode === "value"}
          onClick={() => setMode("value")}
        >
          Resolved value
        </button>
        <button
          type="button"
          class="sg-chip"
          aria-pressed={mode === "var"}
          onClick={() => setMode("var")}
        >
          var(--token)
        </button>
      </div>

      {/* Native pill, mirroring the header's Tokens trigger (header-toggles.tsx
          `tokenToggleClass`): the shared `.sg-toggle-btn` chrome class was
          retired in the native-chrome restyle, so this feature trigger now
          carries the same native utility literal. Kept as a full literal (not
          composed) so the Tailwind v4 scanner emits every utility. */}
      <button
        type="button"
        class="inline-flex items-center gap-hsp-2xs px-hsp-xs py-vsp-3xs border border-muted rounded text-small text-muted hover:text-fg transition-colors cursor-pointer"
        onClick={openTweaker}
      >
        Tweak tokens live →
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-hsp-2xs px-hsp-xs py-vsp-3xs border border-muted rounded text-small text-muted hover:text-fg transition-colors cursor-pointer"
        onClick={openPreviewTweaker}
      >
        Preview tokens →
      </button>

      <div
        class="sg-token-toast"
        role="status"
        aria-live="polite"
        data-visible={toast ? "true" : undefined}
      >
        {toast}
      </div>
    </div>
  );
}

TokenPlayground.displayName = "TokenPlayground";
