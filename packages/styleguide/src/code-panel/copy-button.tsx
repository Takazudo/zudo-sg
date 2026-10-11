"use client";

// Reusable copy-to-clipboard button island. Used on the code panel source
// snippets. Self-contained: takes the verbatim text to copy as a prop, so
// it works regardless of where it is mounted (no DOM scraping).
//
// Clipboard access: navigator.clipboard.writeText requires a secure context.
// The catalog is served over https (and localhost counts as secure), so the
// modern API is the primary path; a hidden-textarea + execCommand fallback
// covers the rare insecure-context case so the button never silently no-ops.

import { computed, getScope, signal, Show } from "@takazudo/zfb/zudo-react";
import { copyText } from "./copy-text.js";

export interface CopyButtonProps {
  /** Verbatim text placed on the clipboard. */
  text: string;
  /** Optional accessible label / tooltip. */
  label?: string;
  /** Extra classes for layout (the visual style is fixed). */
  class?: string;
}

export default function CopyButton({
  text,
  label = "Copy",
  class: extraClass = "",
}: CopyButtonProps) {
  const copied = signal(false);
  const scope = getScope();
  let timer: number | undefined;
  scope.onActivate(() => () => window.clearTimeout(timer));

  async function handleClick(): Promise<void> {
    const ok = await copyText(text);
    if (!ok || scope.abortSignal.aborted) return;
    copied.value = true;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => { copied.value = false; }, 1400);
  }

  return (
    <button
      type="button"
      class={`sg-copy-btn ${extraClass}`}
      on:click={() => void handleClick()}
      aria-label={computed(() => copied.value ? "Copied" : label)}
      title={computed(() => copied.value ? "Copied" : label)}
      data-copied={computed(() => copied.value ? "true" : undefined)}
    >
      <Show when={copied} fallback={() => (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>Copy</span>
        </>
      )}>{() => (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span>Copied</span>
        </>
      )}</Show>
    </button>
  );
}
