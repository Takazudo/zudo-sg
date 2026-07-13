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
import { ChevronDownIcon, ChevronRightIcon, ContainerIcon, EllipsisIcon, LeafIcon, SlotIcon } from "@/components/icons";
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
      <div
        class={`sg-composer-tree-row ${
          hasSlots ? "sg-composer-tree-row-container" : "sg-composer-tree-row-leaf"
        }`}
        data-sg-selected={isSelected}
        data-sg-tree-branch-open={hasSlots && isExpanded ? "true" : undefined}
      >
        {hasSlots ? (
          <button
            type="button"
            class="sg-composer-tree-disclosure"
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${displayName}`}
            onClick={() => onToggleExpanded(node.id)}
          >
            {isExpanded ? <ChevronDownIcon size="xs" /> : <ChevronRightIcon size="xs" />}
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
          {hasSlots ? (
            <ContainerIcon size="xs" class="sg-composer-tree-node-icon" />
          ) : (
            <LeafIcon size="xs" class="sg-composer-tree-node-icon" />
          )}
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
            <EllipsisIcon size="xs" />
          </button>
        )}
      </div>

      {hasSlots && isExpanded && (
        <div class="sg-composer-tree-slots">
          {slotIds.map((slotId) => {
            const slotMeta = entry?.slots.find((s) => s.id === slotId);
            const children = node.slots[slotId] ?? [];
            const label = slotMeta?.label ?? `${slotId} (unavailable)`;
            const cardinalityLabel =
              slotMeta === undefined ? null : slotMeta.cardinality === "single" ? "Single" : "Multiple";
            const canAdd =
              !readOnly &&
              !summary.opaque &&
              slotMeta !== undefined &&
              !(slotMeta.cardinality === "single" && children.length >= 1);

            return (
              <div class="sg-composer-tree-slot" key={slotId} data-sg-tree-slot-id={slotId}>
                <div
                  class="sg-composer-tree-slot-header"
                  data-sg-tree-branch-open={children.length > 0 ? "true" : undefined}
                >
                  <span
                    class="sg-composer-tree-disclosure-spacer sg-composer-tree-slot-spacer"
                    aria-hidden="true"
                  />
                  <span class="sg-composer-tree-slot-label">
                    <SlotIcon size="xs" class="sg-composer-tree-node-icon" />
                    <span class="sg-composer-tree-slot-kind">Slot</span>
                    <span class="sg-composer-tree-slot-name">{label}</span>
                    {cardinalityLabel && (
                      <span class="sg-composer-tree-slot-cardinality">{cardinalityLabel}</span>
                    )}
                  </span>
                  <span class="sg-composer-tree-slot-controls">
                    <span
                      class="sg-composer-tree-count"
                      aria-label={`${children.length} component${children.length === 1 ? "" : "s"}`}
                    >
                      {children.length}
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
                          <EllipsisIcon size="xs" />
                        </button>
                      </span>
                    )}
                  </span>
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
