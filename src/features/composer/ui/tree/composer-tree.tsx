/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The Composer structure rail (issue #250) — a recursive, fully controlled
// tree over a `CompositionDocument` + the derived Composer catalog. Every row
// is DERIVED from `document` + `manifest`; there is no separate row model to
// drift out of sync (see `TreeNode`'s per-row derivation via `tree-helpers.ts`).
//
// ── The virtual-root pseudo-row ─────────────────────────────────────────────
// `document.root`'s children render under one always-expanded "Document root"
// row. That row is an INSERTION TARGET ONLY (`{ parentId: null, slotId:
// VIRTUAL_ROOT_SLOT_ID }`) — it is never a `CompositionNode`, is never itself
// movable/removable, and cannot be collapsed (there is no id to track in
// `expandedIds`). Selecting it calls `onSelect(null)` — the same "clear to
// virtual-root context" state `removeNode`'s selection repair (#245) falls
// back to when nothing remains selected.
//
// ── The reveal contract ─────────────────────────────────────────────────────
// This component is a fully controlled render of `selectedId`/`expandedIds` —
// it never owns selection or expansion state itself. That is what lets a
// FUTURE caller (e.g. the edit-canvas wave) "reveal" a node with no API of its
// own: expand that node's ancestors (`ancestorChainIds` in `tree-helpers.ts`,
// exactly what `controller.reveal()` already does — see #247's
// `controller-model.ts`) and set `selectedId`. Whenever `selectedId` changes to
// an id that is now rendered (its ancestors are in `expandedIds`), this
// component scrolls that row into view — see the `useEffect` below. No ref /
// imperative handle is needed; the two controlled props ARE the reveal API.
//
// Real component rows call `onReveal` (not `onSelect`) on primary click —
// `onReveal` is intended to be wired to `controller.reveal`, which selects AND
// expands ancestors in one action (a no-op beyond selecting for an
// already-visible row, and exactly right for a future canvas-driven selection
// reaching into a collapsed branch of the tree).

import { useEffect, useMemo, useRef } from "preact/hooks";
import type { JSX } from "preact";
import type { CompositionDocument, InsertionTarget } from "@/composer";
import { VIRTUAL_ROOT_SLOT_ID } from "@/composer";
import type { ComposerManifestEntry } from "@/styleguide/data/composer-registry";
import { buildCatalogById, buildDocumentIndex, buildManifestIndex, countDescendants } from "./tree-helpers";
import { TreeNode } from "./tree-node";

export interface ComposerTreeProps {
  document: CompositionDocument;
  manifest: readonly ComposerManifestEntry[];
  selectedId: string | null;
  expandedIds: ReadonlySet<string>;
  /** Virtual-root row selection (nodeId is always `null`) — wire to `controller.select`. */
  onSelect: (nodeId: string | null) => void;
  /** Real-node primary selection — wire to `controller.reveal` (selects + expands ancestors). */
  onReveal: (nodeId: string) => void;
  onToggleExpanded: (nodeId: string) => void;
  onOpenChooser: (target: InsertionTarget) => void;
  onReorder: (nodeId: string, direction: "up" | "down") => void;
  onRemove: (nodeId: string) => void;
  /** Opens the node context menu (Copy/Cut/Duplicate/Delete — issue #256). */
  onOpenNodeMenu: (nodeId: string, trigger: HTMLElement) => void;
  /** Opens the insert menu (Add component…/Paste here — issue #256), alongside the direct "+Add". */
  onOpenInsertMenu: (target: InsertionTarget, trigger: HTMLElement) => void;
  /** Hides every mutating affordance (Add/move/remove) — e.g. while in Preview mode. */
  readOnly?: boolean;
}

export function ComposerTree({
  document,
  manifest,
  selectedId,
  expandedIds,
  onSelect,
  onReveal,
  onToggleExpanded,
  onOpenChooser,
  onReorder,
  onRemove,
  onOpenNodeMenu,
  onOpenInsertMenu,
  readOnly = false,
}: ComposerTreeProps): JSX.Element {
  const manifestIndex = useMemo(() => buildManifestIndex(manifest), [manifest]);
  const catalogById = useMemo(() => buildCatalogById(manifest), [manifest]);
  const documentIndex = useMemo(() => buildDocumentIndex(document, manifestIndex), [document, manifestIndex]);

  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const registerRowRef = (nodeId: string, element: HTMLButtonElement | null) => {
    if (element) rowRefs.current.set(nodeId, element);
    else rowRefs.current.delete(nodeId);
  };

  // The reveal contract: whenever the controlled `selectedId` changes to a
  // node that is currently rendered (its row ref is registered — i.e. its
  // ancestors are already in `expandedIds`), scroll it into view. This is the
  // ONLY thing a future caller needs for "reveal" beyond updating
  // `selectedId`/`expandedIds` themselves.
  useEffect(() => {
    if (selectedId === null) return;
    const el = rowRefs.current.get(selectedId);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId, expandedIds]);

  const rootTotal = document.root.reduce((sum, node) => sum + 1 + countDescendants(node), 0);
  const rootSelected = selectedId === null;

  return (
    <div class="sg-composer-tree">
      <div class="sg-composer-tree-row sg-composer-tree-row-root" data-sg-selected={rootSelected}>
        <span class="sg-composer-tree-disclosure-spacer" aria-hidden="true" />
        <button
          type="button"
          class="sg-composer-tree-select sg-composer-tree-select-root"
          aria-pressed={rootSelected}
          onClick={() => onSelect(null)}
        >
          <span class="sg-composer-tree-select-title">Document root</span>
          <span class="sg-composer-tree-count" aria-hidden="true">
            {rootTotal}
          </span>
        </button>
        {!readOnly && (
          <div class="sg-composer-tree-row-actions">
            <button
              type="button"
              class="sg-composer-tree-action sg-composer-tree-add"
              aria-label="Add component to document root"
              onClick={() =>
                onOpenChooser({ parentId: null, slotId: VIRTUAL_ROOT_SLOT_ID, index: document.root.length })
              }
            >
              + Add
            </button>
            <button
              type="button"
              class="sg-composer-tree-action sg-composer-tree-insert-menu"
              aria-label="Insert options for document root"
              title="Insert options"
              onClick={(event) =>
                onOpenInsertMenu(
                  { parentId: null, slotId: VIRTUAL_ROOT_SLOT_ID, index: document.root.length },
                  event.currentTarget as HTMLElement,
                )
              }
            >
              <span aria-hidden="true">⋯</span>
            </button>
          </div>
        )}
      </div>

      {document.root.length === 0 ? (
        <p class="sg-composer-tree-empty">Empty document — add a component to get started.</p>
      ) : (
        <ul class="sg-composer-tree-list">
          {document.root.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              document={document}
              manifest={manifestIndex}
              catalogById={catalogById}
              index={documentIndex}
              selectedId={selectedId}
              expandedIds={expandedIds}
              readOnly={readOnly}
              onReveal={onReveal}
              onToggleExpanded={onToggleExpanded}
              onOpenChooser={onOpenChooser}
              onReorder={onReorder}
              onRemove={onRemove}
              registerRowRef={registerRowRef}
              onOpenNodeMenu={onOpenNodeMenu}
              onOpenInsertMenu={onOpenInsertMenu}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// Re-exported so #251/other waves can compose the same row-action affordance
// elsewhere (e.g. a future canvas selection toolbar) without reaching into
// this module's internals.
export { TreeRowActions, SubtreeRemovalConfirm } from "./tree-row-actions";
export type { TreeRowActionsProps, SubtreeRemovalConfirmProps } from "./tree-row-actions";
