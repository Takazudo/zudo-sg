"use client";

export default function PreviewTokensButton() {
  return (
    <button
      type="button"
      class="inline-flex items-center gap-hsp-2xs px-hsp-xs py-vsp-3xs border border-border rounded text-small text-muted hover:text-fg transition-colors cursor-pointer"
      onClick={() => window.dispatchEvent(new CustomEvent("toggle-preview-token-panel"))}
    >
      Preview tokens →
    </button>
  );
}

PreviewTokensButton.displayName = "PreviewTokensButton";
