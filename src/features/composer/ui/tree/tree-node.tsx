/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// One recursive structure-rail row (issue #250): the component itself, its
// declared/preserved slots (in canonical order — see `@/composer`'s
// `orderedSlotIds`), each slot's children, and empty-slot placeholders.
//
// Plain nested `<ul>`/`<li>` + real `<button>`s — deliberately NOT
// `role="tree"` (that would require full arrow-key navigation + roving
// tabindex, which this issue does not implement; see #250's acceptance
// criteria). Disclosure and selection are two separate buttons so both stay
// independently keyboard-operable via native Tab/Enter/Space.

import type { JSX } from "preact";
import type {
  ComponentManifest,
  CompositionDocument,
  CompositionNode,
  DocumentIndex,
  InsertionTarget,
} from "@/composer";
import { orderedSlotIds } from "@/composer";
import type { ComposerManifestEntry } from "@/styleguide/data/composer-registry";
import { countDescendants, siblingBounds, summarizeNode } from "./tree-helpers";
import { TreeRowActions } from "./tree-row-actions";

export interface TreeNodeCallbacks {
  onReveal: (nodeId: string) => void;
  onToggleExpanded: (nodeId: string) => void;
  onOpenChooser: (target: InsertionTarget) => void;
  onReorder: (nodeId: string, direction: "up" | "down") => void;
  onRemove: (nodeId: string) => void;
  registerRowRef: (nodeId: string, element: HTMLButtonElement | null) => void;
  /** Opens the node context menu (Copy/Cut/Duplicate/Delete — issue #256). */
  onOpenNodeMenu: (nodeId: string, trigger: HTMLElement) => void;
  /** Opens the insert menu (Add component…/Paste here — issue #256), alongside the direct "+Add". */
  onOpenInsertMenu: (target: InsertionTarget, trigger: HTMLElement) => void;
}

export interface TreeNodeProps extends TreeNodeCallbacks {
  node: CompositionNode;
  document: CompositionDocument;
  manifest: ComponentManifest;
  catalogById: ReadonlyMap<string, ComposerManifestEntry>;
  index: DocumentIndex;
  selectedId: string | null;
  expandedIds: ReadonlySet<string>;
  readOnly: boolean;
}

export function TreeNode(props: TreeNodeProps): JSX.Element {
  const { node, document, manifest, catalogById, index, selectedId, expandedIds, readOnly } = props;
  const { onReveal, onToggleExpanded, onOpenChooser, onReorder, onRemove, registerRowRef } = props;
  const { onOpenNodeMenu, onOpenInsertMenu } = props;

  const entry = manifest.get(node.componentId);
  const summary = summarizeNode(node, manifest, catalogById);
  // The title alone collides across duplicate component instances (e.g. two
  // "Box" leaves) — every accessible name below uses this combined form so
  // assistive tech (and stable-id-keyed tests) can tell rows apart.
  const displayName = summary.subtitle ? `${summary.title} ${summary.subtitle}` : summary.title;
  const slotIds = orderedSlotIds(node, entry);
  const hasSlots = slotIds.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const bounds = siblingBounds(document, index, node.id);
  const descendantCount = countDescendants(node);

  return (
    <li class="sg-composer-tree-node" data-sg-tree-node-id={node.id}>
      <div class="sg-composer-tree-row" data-sg-selected={isSelected}>
        {hasSlots ? (
          <button
            type="button"
            class="sg-composer-tree-disclosure"
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${displayName}`}
            onClick={() => onToggleExpanded(node.id)}
          >
            <span aria-hidden="true">{isExpanded ? "▾" : "▸"}</span>
          </button>
        ) : (
          <span class="sg-composer-tree-disclosure-spacer" aria-hidden="true" />
        )}

        <button
          ref={(el) => registerRowRef(node.id, el)}
          type="button"
          class="sg-composer-tree-select"
          aria-pressed={isSelected}
          data-sg-opaque={summary.opaque}
          title={summary.reasonText ?? undefined}
          onClick={() => onReveal(node.id)}
        >
          <span class="sg-composer-tree-select-title">{summary.title}</span>
          {summary.subtitle && (
            <>
              {" "}
              <span class="sg-composer-tree-select-subtitle">{summary.subtitle}</span>
            </>
          )}
          {summary.opaque && (
            <>
              {" "}
              <span class="sg-composer-tree-badge" data-sg-tree-badge="unavailable">
                Unavailable
              </span>
            </>
          )}
          {descendantCount > 0 && (
            <span class="sg-composer-tree-count" aria-hidden="true">
              {descendantCount}
            </span>
          )}
        </button>

        <TreeRowActions
          nodeTitle={displayName}
          descendantCount={descendantCount}
          canMoveUp={bounds.canMoveUp}
          canMoveDown={bounds.canMoveDown}
          readOnly={readOnly}
          onMoveUp={() => onReorder(node.id, "up")}
          onMoveDown={() => onReorder(node.id, "down")}
          onRemove={() => onRemove(node.id)}
        />

        {!readOnly && (
          <button
            type="button"
            class="sg-composer-tree-action sg-composer-tree-menu-trigger"
            aria-label={`Open menu for ${displayName}`}
            title="More actions"
            onClick={(event) => onOpenNodeMenu(node.id, event.currentTarget as HTMLElement)}
          >
            <span aria-hidden="true">⋯</span>
          </button>
        )}
      </div>

      {hasSlots && isExpanded && (
        <div class="sg-composer-tree-slots">
          {slotIds.map((slotId) => {
            const slotMeta = entry?.slots.find((s) => s.id === slotId);
            const children = node.slots[slotId] ?? [];
            const label = slotMeta?.label ?? `${slotId} (unavailable)`;
            const canAdd =
              !readOnly &&
              !summary.opaque &&
              slotMeta !== undefined &&
              !(slotMeta.cardinality === "single" && children.length >= 1);

            return (
              <div class="sg-composer-tree-slot" key={slotId} data-sg-tree-slot-id={slotId}>
                <div class="sg-composer-tree-slot-header">
                  <span class="sg-composer-tree-slot-label">
                    {label} <span class="sg-composer-tree-count">({children.length})</span>
                  </span>
                  {canAdd && (
                    <span class="sg-composer-tree-slot-add-group">
                      <button
                        type="button"
                        class="sg-composer-tree-action sg-composer-tree-add"
                        aria-label={`Add component to ${label} in ${displayName}`}
                        onClick={() => onOpenChooser({ parentId: node.id, slotId, index: children.length })}
                      >
                        + Add
                      </button>
                      <button
                        type="button"
                        class="sg-composer-tree-action sg-composer-tree-insert-menu"
                        aria-label={`Insert options for ${label} in ${displayName}`}
                        title="Insert options"
                        onClick={(event) =>
                          onOpenInsertMenu(
                            { parentId: node.id, slotId, index: children.length },
                            event.currentTarget as HTMLElement,
                          )
                        }
                      >
                        <span aria-hidden="true">⋯</span>
                      </button>
                    </span>
                  )}
                </div>

                {children.length === 0 ? (
                  <p class="sg-composer-tree-empty">Empty slot</p>
                ) : (
                  <ul class="sg-composer-tree-list sg-composer-tree-list-nested">
                    {children.map((child) => (
                      <TreeNode
                        key={child.id}
                        node={child}
                        document={document}
                        manifest={manifest}
                        catalogById={catalogById}
                        index={index}
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
          })}
        </div>
      )}
    </li>
  );
}
