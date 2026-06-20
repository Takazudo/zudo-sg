"use client";

// Reusable copy-to-clipboard button island. Used on the code panel source
// snippets. Self-contained: takes the verbatim text to copy as a prop, so
// it works regardless of where it is mounted (no DOM scraping).
//
// Clipboard access: navigator.clipboard.writeText requires a secure context.
// The catalog is served over https (and localhost counts as secure), so the
// modern API is the primary path; a hidden-textarea + execCommand fallback
// covers the rare insecure-context case so the button never silently no-ops.

import type { JSX } from "preact";
import { useState } from "preact/hooks";

export async function copyText(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard?.writeText
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  // Legacy fallback for insecure contexts where navigator.clipboard is absent.
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

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
}: CopyButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function handleClick(): Promise<void> {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      class={`sg-copy-btn ${extraClass}`}
      onClick={() => void handleClick()}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      data-copied={copied ? "true" : undefined}
    >
      {copied ? (
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
      ) : (
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
      )}
    </button>
  );
}

CopyButton.displayName = "CopyButton";
