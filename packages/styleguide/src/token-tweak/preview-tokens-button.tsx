"use client";

export default function PreviewTokensButton() {
  return (
    <button
      type="button"
      class="inline-flex items-center gap-hsp-2xs px-hsp-xs py-vsp-3xs border border-sg-border rounded text-small text-sg-muted hover:text-sg-fg transition-colors cursor-pointer"
      on:click={() => { window.dispatchEvent(new CustomEvent("toggle-preview-token-panel")); }}
    >
      Preview tokens →
    </button>
  );
}
