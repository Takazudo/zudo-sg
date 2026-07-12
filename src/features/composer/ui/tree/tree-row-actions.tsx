/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Structural actions for one structure-rail row (issue #250): sibling
// move-up/move-down (within the node's current slot only — cross-slot
// reparenting/drag-drop are explicitly out of scope, see #245's command
// comments) and subtree removal. Removing a node with at least one descendant
// requires an explicit inline confirmation step before `onRemove` fires;
// removing an empty node (leaf, or a container with no children) fires
// immediately. Kept as its own component so the confirmation's local state
// doesn't live on the (already complex) recursive row renderer.

import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";

export interface SubtreeRemovalConfirmProps {
  nodeTitle: string;
  descendantCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * The inline "Remove X and its N nested components?" confirmation shown
 * before removing a populated subtree. Extracted so issue #256's node
 * context menu can reuse the EXACT same copy/behavior for its Delete item
 * (rendered as the menu's `children`, in place of its item list) instead of
 * re-deriving a second confirmation flow — see `use-composer-menus.ts`.
 */
export function SubtreeRemovalConfirm({
  nodeTitle,
  descendantCount,
  onCancel,
  onConfirm,
}: SubtreeRemovalConfirmProps): JSX.Element {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  return (
    <div class="sg-composer-tree-confirm" role="group" aria-label={`Confirm removing ${nodeTitle}`}>
      <span class="sg-composer-tree-confirm-text">
        Remove {nodeTitle} and its {descendantCount} nested component{descendantCount === 1 ? "" : "s"}?
      </span>
      <button
        type="button"
        class="sg-composer-tree-action"
        onClick={onCancel}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        Cancel
      </button>
      <button
        ref={confirmButtonRef}
        type="button"
        class="sg-composer-tree-action sg-composer-tree-action-danger"
        onClick={onConfirm}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        Confirm removal
      </button>
    </div>
  );
}

export interface TreeRowActionsProps {
  nodeTitle: string;
  descendantCount: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  readOnly?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

export function TreeRowActions({
  nodeTitle,
  descendantCount,
  canMoveUp,
  canMoveDown,
  readOnly = false,
  onMoveUp,
  onMoveDown,
  onRemove,
}: TreeRowActionsProps): JSX.Element {
  const [confirming, setConfirming] = useState(false);

  if (readOnly) return <></>;

  if (confirming) {
    return (
      <SubtreeRemovalConfirm
        nodeTitle={nodeTitle}
        descendantCount={descendantCount}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onRemove();
        }}
      />
    );
  }

  return (
    <div class="sg-composer-tree-row-actions">
      <button
        type="button"
        class="sg-composer-tree-action"
        disabled={!canMoveUp}
        aria-label={`Move ${nodeTitle} up`}
        title="Move up"
        onClick={onMoveUp}
      >
        <span aria-hidden="true">&uarr;</span>
      </button>
      <button
        type="button"
        class="sg-composer-tree-action"
        disabled={!canMoveDown}
        aria-label={`Move ${nodeTitle} down`}
        title="Move down"
        onClick={onMoveDown}
      >
        <span aria-hidden="true">&darr;</span>
      </button>
      <button
        type="button"
        class="sg-composer-tree-action sg-composer-tree-action-danger"
        aria-label={`Remove ${nodeTitle}`}
        title="Remove"
        onClick={() => {
          if (descendantCount > 0) setConfirming(true);
          else onRemove();
        }}
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}
