/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The Sitemapper toolbar (issue #409).
//
// The toolbar is a deliberately small, controller-neutral surface: the
// controller supplies the current document name and provider save state, and
// receives an optional retry callback. It does not reach into controller
// state, so the wave-7 assembly can replace or extend the controls through the
// workspace's `toolbar` slot.

import type { JSX } from "preact";

/** Honest persistence states exposed by the Sitemapper save queue. */
export type SitemapperSaveStatus =
  | { kind: "saved" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "error"; reason?: string }
  // These two compatibility states are useful while a record is being
  // recovered or while an older local-only mount is being replaced. They are
  // still honest: neither means the mounted document matches persistence.
  | { kind: "unsaved" }
  | { kind: "quarantined"; foundSchemaVersion: number };

export interface SitemapperToolbarProps {
  documentName: string;
  saveStatus: SitemapperSaveStatus;
  onRetrySave?: () => void;
}

/** Convert a queue state into short, accessible status text. */
export function describeSitemapperSaveStatus(status: SitemapperSaveStatus): string {
  switch (status.kind) {
    case "saved":
      return "Saved";
    case "dirty":
    case "unsaved":
      return "Unsaved changes";
    case "saving":
      return "Saving…";
    case "error":
      return "Save failed";
    case "quarantined":
      return "Not saved — a newer Sitemap is in storage; editing the sample until you reset";
  }
}

/** Composer-compatible name for consumers that share toolbar adapters. */
export const describeSaveStatus = describeSitemapperSaveStatus;

export function SitemapperToolbar({
  documentName,
  saveStatus,
  onRetrySave,
}: SitemapperToolbarProps): JSX.Element {
  return (
    <>
      <div class="sg-sitemapper-toolbar-identity">
        <div class="sg-sitemapper-toolbar-name">
          <span class="sg-sitemapper-toolbar-kicker">Sitemap</span>
          <strong>{documentName}</strong>
        </div>
        <span
          class="sg-sitemapper-save-status"
          data-sg-status={saveStatus.kind}
          aria-live="polite"
          title={saveStatus.kind === "error" ? saveStatus.reason : undefined}
        >
          {describeSitemapperSaveStatus(saveStatus)}
        </span>
        {saveStatus.kind === "error" && onRetrySave && (
          <button type="button" class="sg-sitemapper-toolbar-button" onClick={onRetrySave}>
            Retry
          </button>
        )}
      </div>
    </>
  );
}

export default SitemapperToolbar;
