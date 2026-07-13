/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The Composer's component chooser dialog (issue #250).
//
// A single, reusable dialog ANY Add affordance can open by supplying #245's
// shared `InsertionTarget` (`{ parentId, slotId, index }`) — the same shape
// canvas insert points (a later wave) and this issue's tree slot Adds both
// use, so "one code path" (epic #243's synthesis note) holds without this
// dialog needing to know who opened it.
//
// ── Target capture (the acceptance-critical bit) ────────────────────────────
// Opening the dialog (the `open` prop's false → true transition) CAPTURES
// `target` into its own state (`capturedTarget` — a ref mutation alone
// wouldn't force the render that needs to happen) and the triggering element
// (`document.activeElement`, the Add button just clicked) into a ref. Every
// subsequent render reads ONLY `capturedTarget` — never the live `target`
// prop — so a selection change elsewhere in the app while the dialog is open
// cannot redirect an in-flight "add" to a different destination. See
// `__tests__/composer-chooser.test.tsx`'s "capture survives a selection
// change" test.
//
// ── Accessibility ────────────────────────────────────────────────────────────
// Native `<dialog>` + `showModal()` for top-layer rendering; Escape is handled
// explicitly (native UA Escape-to-cancel isn't simulated by every test/DOM
// environment) via a keydown listener that calls `.close()` — the dialog's
// native `close` event then drives `onClose` + focus restoration uniformly for
// every close path (Escape, Cancel, backdrop click, successful add). A
// `aria-live` status region sits OUTSIDE the `<dialog>` (this component is
// expected to be mounted unconditionally, with `open` toggling visibility) so
// "Added" announcements survive the dialog closing/hiding.
//
// ── Live preview + enlarge (issue #254) ─────────────────────────────────────
// Search/filter/list rendering stayed in this one component (no internal
// sub-dialog abstraction, per #250's own header note) so this extension could
// wrap the existing target-capture/focus/keyboard machinery without
// re-deriving it. Hovering OR keyboard-focusing a catalog card sets the
// STICKY `previewedComponentId` (never cleared by mouseleave/blur — only
// replaced by the next hover/focus); `ChooserPreviewHost` owns the actual
// second bridge + iframe (see that module's header for the ephemeral
// create/dispose contract). The enlarge toggle is local UI state only — it
// resizes the `<dialog>` via `data-sg-enlarged`; it does not touch #250's
// focus-containment/Escape/restoration effects, which key off `open` and
// `capturedTarget`, not this attribute.

import { useEffect, useId, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { ComponentManifest, CompositionDocument, InsertionTarget } from "@/composer";
import { ExpandIcon, XMarkIcon } from "@/components/icons";
import type { ComposerManifestEntry } from "@/styleguide/data/composer-registry";
import type {
  ComposerPreviewLocation,
  MessageTarget,
  createComposerPreviewBridge,
} from "@/features/composer/preview";
import { ancestorChainIds, buildCatalogById } from "../tree/tree-helpers";
import { describeInsertionTarget, eligibleEntries, matchesQuery } from "./chooser-helpers";
import { ChooserPreviewHost } from "./chooser-preview-host";

export interface ComposerChooserProps {
  open: boolean;
  /** The target to capture on open. Ignored for the rest of the dialog's lifetime once captured. */
  target: InsertionTarget | null;
  document: CompositionDocument;
  /** The single app-layer `createManifest(entries)` derivation (issue #290) — never re-derived here. */
  manifest: ComponentManifest;
  /** The richer catalog backing search/filter/display (title/category/description) — same array `manifest` was derived from. */
  entries: readonly ComposerManifestEntry[];
  /** Fired once, with the CAPTURED target, when a component is chosen. */
  onAdd: (target: InsertionTarget, componentId: string) => void;
  /** Fired right after `onAdd`, with the captured target's ancestor chain, so callers can `setExpanded` each id. */
  onExpandAncestors: (nodeIds: string[]) => void;
  /** Fired on every close path (Escape, Cancel, backdrop, or after a successful add). */
  onClose: () => void;

  // ── Live preview pane test seams (production defaults) — forwarded to
  // `ChooserPreviewHost`'s OWN, second bridge. Never used by the main canvas. ──
  previewCreateBridge?: typeof createComposerPreviewBridge;
  previewLocation?: ComposerPreviewLocation;
  previewHostWindow?: MessageTarget;
}

const ALL_CATEGORY = "All" as const;

export function ComposerChooser({
  open,
  target,
  document,
  manifest,
  entries,
  onAdd,
  onExpandAncestors,
  onClose,
  previewCreateBridge,
  previewLocation,
  previewHostWindow,
}: ComposerChooserProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // The captured target lives in STATE (not just a ref) so the false -> true
  // capture produces a render — a ref mutation alone wouldn't. Every render
  // below reads ONLY `capturedTarget`, never the live `target` prop, which is
  // what makes a later selection-change prop update unable to redirect an
  // in-flight chooser (see this module's header + the "capture survives a
  // selection change" test).
  const [capturedTarget, setCapturedTarget] = useState<InsertionTarget | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const [status, setStatus] = useState("");
  // Sticky: set on hover/focus, never cleared by mouseleave/blur — only ever
  // replaced by the NEXT hover/focus, or reset to null on the next open.
  const [previewedComponentId, setPreviewedComponentId] = useState<string | null>(null);
  // Resets to false on every open (see the capture effect below) — the
  // enlarge toggle is per-session UI state, not a persisted preference.
  const [enlarged, setEnlarged] = useState(false);

  const titleId = useId();

  const catalogById = useMemo(() => buildCatalogById(entries), [entries]);

  useEffect(() => {
    if (open && capturedTarget === null) {
      setCapturedTarget(target);
      triggerRef.current =
        globalThis.document?.activeElement instanceof HTMLElement ? globalThis.document.activeElement : null;
      setQuery("");
      setCategory(ALL_CATEGORY);
      setStatus("");
      setPreviewedComponentId(null);
      setEnlarged(false);
    } else if (!open && capturedTarget !== null) {
      setCapturedTarget(null);
    }
  }, [open, target, capturedTarget]);

  // Bridge the controlled `open` prop to the native <dialog> element.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Focus the search input once the CAPTURED content (including the input
  // itself) has actually rendered — a render earlier, on the same tick
  // `showModal()` is called, the content is still gated behind
  // `capturedTarget` being null (see the capture effect above), so
  // `searchRef.current` would not yet exist.
  useEffect(() => {
    if (open && capturedTarget) searchRef.current?.focus();
  }, [open, capturedTarget]);

  // The native `close` event fires for EVERY close path (Escape via our own
  // handler, Cancel, backdrop click, `.close()` after a successful add) — one
  // place to restore focus and tell the controlling parent `open` is false.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleClose() {
      onClose();
      triggerRef.current?.focus?.();
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  const { entries: eligible, blockedReason } = useMemo(() => {
    if (!capturedTarget) return { entries: [] as ComposerManifestEntry[], blockedReason: null as string | null };
    return eligibleEntries(document, manifest, entries, capturedTarget);
  }, [capturedTarget, document, manifest, entries]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const entry of eligible) set.add(entry.category);
    return [ALL_CATEGORY, ...[...set].sort()];
  }, [eligible]);

  const filtered = useMemo(() => {
    return eligible.filter(
      (entry) => (category === ALL_CATEGORY || entry.category === category) && matchesQuery(entry, query),
    );
  }, [eligible, category, query]);

  const targetLabel = capturedTarget ? describeInsertionTarget(document, manifest, catalogById, capturedTarget) : "";

  const previewedEntry = previewedComponentId ? (catalogById.get(previewedComponentId) ?? null) : null;

  function confirmAdd(componentId: string) {
    if (!capturedTarget) return;
    const entry = catalogById.get(componentId);
    const ancestors = ancestorChainIds(document, manifest, capturedTarget.parentId);
    onAdd(capturedTarget, componentId);
    onExpandAncestors(ancestors);
    setStatus(`${entry?.title ?? componentId} added to ${targetLabel}.`);
    dialogRef.current?.close();
  }

  // Enter only confirms when the current filter narrows to exactly ONE
  // component — with several matches still showing, silently adding
  // whichever happens to sort first would be a surprising, easy-to-mistrigger
  // footgun rather than a helpful shortcut.
  function handleSearchKeyDown(event: JSX.TargetedKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && filtered.length === 1) {
      event.preventDefault();
      confirmAdd(filtered[0]!.componentId);
    }
  }

  // Manual Tab-wrap focus containment. Real browsers already make everything
  // OUTSIDE a `showModal()` dialog inert, but not every DOM test environment
  // simulates that (see this module's tests), and defense-in-depth here is
  // cheap and matches common accessible-dialog practice.
  function handleDialogKeyDown(event: JSX.TargetedKeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      dialogRef.current?.close();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>("button, input, [href], [tabindex]")].filter(
      (el) => !el.hasAttribute("disabled"),
    );
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = globalThis.document?.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function clearFilters() {
    setQuery("");
    setCategory(ALL_CATEGORY);
    searchRef.current?.focus();
  }

  const hasActiveFilter = query.trim().length > 0 || category !== ALL_CATEGORY;

  return (
    <>
      <dialog
        ref={dialogRef}
        class="sg-composer-chooser"
        data-sg-enlarged={enlarged}
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleDialogKeyDown}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        {/* Gated on `capturedTarget` (not just `open`) rather than the raw
            `open` prop: this keeps the dialog's interactive content (and its
            accessible names, e.g. duplicate catalog-card titles that also
            appear in the tree) out of the DOM entirely while closed, instead
            of depending on `dialog:not([open]) { display:none }` UA-stylesheet
            behavior a DOM test environment may not simulate. */}
        {capturedTarget && (
          <>
            <div class="sg-composer-chooser-header">
              <h2 id={titleId} class="sg-composer-chooser-title">
                Add a component
              </h2>
              <button
                type="button"
                class="sg-composer-toolbar-button sg-composer-chooser-enlarge"
                aria-pressed={enlarged}
                aria-label={enlarged ? "Restore chooser to default size" : "Enlarge chooser"}
                title={enlarged ? "Restore size" : "Enlarge"}
                onClick={() => setEnlarged((value) => !value)}
              >
                {enlarged ? <XMarkIcon size="sm" /> : <ExpandIcon size="sm" />}
              </button>
              <p class="sg-composer-chooser-target">
                Adding to: <strong>{targetLabel}</strong>
              </p>
              <button
                type="button"
                class="sg-composer-toolbar-button sg-composer-chooser-cancel"
                onClick={() => dialogRef.current?.close()}
              >
                Cancel
              </button>
            </div>

            {blockedReason ? (
              <p class="sg-composer-chooser-empty" role="status">
                {blockedReason}
              </p>
            ) : (
              <div class="sg-composer-chooser-body">
                <div class="sg-composer-chooser-catalog">
                  <div class="sg-composer-chooser-controls">
                    <label class="sg-composer-chooser-search-label">
                      <span class="sr-only">Search components</span>
                      <input
                        ref={searchRef}
                        type="search"
                        class="sg-composer-chooser-search"
                        placeholder="Search components…"
                        value={query}
                        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
                        onKeyDown={handleSearchKeyDown}
                      />
                    </label>

                    <div class="sg-composer-chooser-categories" role="group" aria-label="Filter by category">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          class="sg-composer-chooser-category"
                          aria-pressed={category === cat}
                          onClick={() => setCategory(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p class="sg-composer-chooser-count" aria-live="polite">
                    {filtered.length} of {eligible.length} component{eligible.length === 1 ? "" : "s"}
                  </p>

                  {filtered.length === 0 ? (
                    <div class="sg-composer-chooser-empty">
                      <p>No matching components. Try another search or clear the filters.</p>
                      {hasActiveFilter && (
                        <button type="button" class="sg-composer-toolbar-button" onClick={clearFilters}>
                          Clear filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <ul class="sg-composer-chooser-list">
                      {filtered.map((entry) => (
                        <li key={entry.componentId}>
                          <button
                            type="button"
                            class="sg-composer-chooser-card"
                            // The accessible NAME is the title alone (not the
                            // concatenated title+category+description a plain
                            // button would otherwise compute) — category and
                            // description are supplementary, linked via
                            // aria-describedby instead, per the accname vs.
                            // accdescription split.
                            aria-label={entry.title}
                            aria-describedby={`${entry.componentId}-meta`}
                            onClick={() => confirmAdd(entry.componentId)}
                            onMouseEnter={() => setPreviewedComponentId(entry.componentId)}
                            onFocus={() => setPreviewedComponentId(entry.componentId)}
                          >
                            <span class="sg-composer-chooser-card-title" aria-hidden="true">
                              {entry.title}
                            </span>
                            <span id={`${entry.componentId}-meta`} class="sg-composer-chooser-card-meta">
                              <span class="sg-composer-chooser-card-category">{entry.category}</span>
                              <span class="sg-composer-chooser-card-description">{entry.description}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <ChooserPreviewHost
                  entry={previewedEntry}
                  catalogById={catalogById}
                  createBridge={previewCreateBridge}
                  location={previewLocation}
                  hostWindow={previewHostWindow}
                />
              </div>
            )}
          </>
        )}
      </dialog>
      <div class="sr-only" role="status" aria-live="polite">
        {status}
      </div>
    </>
  );
}
