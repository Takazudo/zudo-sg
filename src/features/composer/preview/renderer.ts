// The Composer preview RENDERER: a `CompositionDocument` (pure JSON, received
// over the bridge) → real, production Preact components.
//
// Written with `h()` rather than JSX on purpose: the vitest config collects
// `src/**/__tests__/**/*.test.ts` and its esbuild pass runs under the root
// `tsconfig.json` (`jsx: "preserve"`), so a `.tsx` module under `src/` cannot be
// imported from a unit test. Keeping the renderer JSX-free makes the DOM
// identity, slot-projection, and edit/preview behaviour directly testable
// without touching the shared vitest config (owned by the parallel #247).
//
// ── Trust boundary ───────────────────────────────────────────────────────────
// The document that arrives over the bridge is DATA. The component FUNCTIONS
// come from the trusted registry (#244), which this module imports itself
// inside the iframe. A `componentId` is only ever used as a Map key — never as
// a module specifier, never evaluated.
//
// ── DOM identity (hard acceptance criterion) ─────────────────────────────────
// Toggling hover or selection must NEVER remount a component's DOM node. Two
// mechanisms guarantee that:
//
//   1. HOVER IS PURE CSS. There is no hover state in Preact at all — the chrome
//      is revealed by `.zc-node:hover > .zc-chrome`. A hover cannot trigger a
//      re-render, so it cannot trigger a diff.
//   2. EVERY CHILD OF `.zc-node` IS KEYED. The selection/label chrome is keyed
//      `zc-chrome` and the component body is wrapped in a Fragment keyed
//      `zc-body`. Preact's UNKEYED children diff matches by position and falls
//      back to type, and can cross-match a chrome `<span>` against a
//      component's own `<span>` — destroying and recreating the component's DOM
//      node (a verified failure mode in the #242 prototype). Keyed children
//      match by key, so adding/removing the chrome (Edit ⇄ Preview) touches only
//      the chrome.
//
// Selection itself is a bare attribute swap (`data-zc-selected`) styled with
// `outline`, which is out-of-flow: it neither remounts nor reflows the node.

import { Component, Fragment, h } from "preact";
import { useMemo } from "preact/hooks";
import type { ComponentChildren, JSX } from "preact";
import type {
  CompositionDocument,
  CompositionNode,
  InsertionTarget,
  NodeDiagnostic,
} from "@/composer";
import { VIRTUAL_ROOT_SLOT_ID, classifyNode, createManifest } from "@/composer";
import type { ComposerEntry } from "@/styleguide/data/composer-registry";
import { toManifestEntry } from "@/styleguide/data/composer-registry";
import type { PreviewSession } from "./protocol";
import { slotFlow, type SlotFlow } from "./slot-flow";

export interface CompositionCanvasProps {
  document: CompositionDocument;
  /** The TRUSTED runtime registry — retains real component functions. */
  entries: readonly ComposerEntry[];
  session: PreviewSession;
  /**
   * Revision of the snapshot being drawn. Used ONLY to clear a node's error
   * boundary when a newer document arrives, so fixing the offending prop in the
   * inspector retries the component instead of leaving it stuck on its error.
   */
  revision?: number;
  /** A node (or the empty canvas, `null`) was activated in Edit mode. */
  onSelect: (nodeId: string | null) => void;
  /** An insert point was activated. Carries #245's insert-at-index target. */
  onRequestAdd: (target: InsertionTarget) => void;
  /** A node's component threw and was isolated behind its error boundary. */
  onNodeError?: (nodeId: string, message: string) => void;
}

/**
 * Renders a whole Composition. Every node gets a stable wrapper carrying its id;
 * in Edit mode it also gets out-of-flow chrome and an insert point at EVERY
 * addable index of EVERY declared slot.
 */
export function CompositionCanvas(props: CompositionCanvasProps): JSX.Element {
  const { document, entries, session, revision, onSelect, onRequestAdd, onNodeError } = props;
  const edit = session.mode === "edit";

  // #245's diagnostics run against the NORMALIZED manifest projection, not the
  // raw definitions: `defineComposer` is an identity cast, so a leaf that
  // declares no slots/fields/defaults leaves those properties `undefined` on the
  // definition, while `toManifestEntry` fills them in. Feeding the raw
  // definitions to `classifyNode` would throw on every leaf component.
  const { entryById, manifest } = useMemo(() => {
    return {
      entryById: new Map(entries.map((entry) => [entry.componentId, entry])),
      manifest: createManifest(entries.map(toManifestEntry)),
    };
  }, [entries]);

  /**
   * In Edit mode the canvas swallows every click in the CAPTURE phase before it
   * can reach a rendered `<a>`/`<button>`, so authoring a link never navigates
   * away and authoring a button never fires its handler. Editor affordances
   * (insert points, chrome buttons, the opaque payload disclosure) opt out with
   * `data-zc-affordance` and behave normally.
   */
  const swallow = (event: Event): boolean => {
    const target = event.target as Element | null;
    if (target?.closest("[data-zc-affordance]")) return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  const onClickCapture = (event: MouseEvent): void => {
    if (!swallow(event)) return;
    const host = (event.target as Element | null)?.closest("[data-zc-node-id]");
    onSelect(host?.getAttribute("data-zc-node-id") ?? null);
  };

  /** Keyboard activation is the other way a link/button fires. Swallow it too. */
  const onKeyDownCapture = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    swallow(event);
  };

  function insertPoint(
    target: InsertionTarget,
    label: string,
    flow: SlotFlow,
    empty: boolean,
  ): JSX.Element {
    const position = empty ? `empty ${label}` : `${label}, position ${target.index + 1}`;
    return h(
      "button",
      {
        key: `zc-ip-${target.index}`,
        type: "button",
        class: `zc-insert zc-insert--${flow}${empty ? " zc-insert--empty" : ""}`,
        "data-zc-affordance": "",
        "data-zc-insert": `${target.parentId ?? VIRTUAL_ROOT_SLOT_ID}:${target.slotId}:${target.index}`,
        "aria-label": `Add a component to ${position}`,
        onClick: () => onRequestAdd(target),
      },
      h("span", { class: "zc-insert-plus", "aria-hidden": "true" }, "+"),
    );
  }

  /**
   * One slot's rendered children. In Edit mode an insert point is emitted at
   * EVERY addable index — before the first child, between each pair, and after
   * the last (the round-2 insert-at-index contract; never append-only).
   *
   * A `single` slot that already holds its one child has no addable index, so it
   * gets no insert point.
   */
  function renderSlotChildren(
    children: readonly CompositionNode[],
    parentId: string | null,
    slotId: string,
    label: string,
    flow: SlotFlow,
    single: boolean,
  ): ComponentChildren[] {
    if (!edit) return children.map((child) => renderNode(child));

    const out: ComponentChildren[] = [];
    const addable = !single || children.length === 0;
    for (let index = 0; index <= children.length; index += 1) {
      if (addable) {
        out.push(insertPoint({ parentId, slotId, index }, label, flow, children.length === 0));
      }
      const child = children[index];
      if (child) out.push(renderNode(child));
    }
    return out;
  }

  /** The real component, with slot ids projected onto its real Preact props. */
  function renderComponent(node: CompositionNode, entry: ComposerEntry): ComponentChildren {
    const definition = entry.definition;
    // Defaults first, then the document's own props — the document always wins.
    // (`defaults`/`slots` are optional on a raw definition; see the manifest note above.)
    const componentProps: Record<string, unknown> = { ...(definition.defaults ?? {}), ...node.props };
    const flow = slotFlow(node);

    for (const slot of definition.slots ?? []) {
      const children = node.slots[slot.id] ?? [];
      const single = slot.cardinality === "single";
      const rendered = renderSlotChildren(children, node.id, slot.id, slot.label, flow, single);
      // A `single` slot takes the child itself (not a 1-element array) so a
      // component that expects one VNode in a named prop gets exactly that.
      componentProps[slot.prop] =
        single && rendered.length === 1 ? rendered[0] : rendered;
    }

    return definition.adapters?.render
      ? definition.adapters.render(componentProps)
      : h(definition.component, componentProps);
  }

  /**
   * An unknown / unsupported-version / structurally-invalid node. It stays
   * SELECTABLE and its payload is shown verbatim, never dropped — the document
   * keeps it and #245's recovery contract keeps it round-trippable.
   */
  function renderOpaque(node: CompositionNode, diagnostic: NodeDiagnostic): ComponentChildren {
    return h(
      "div",
      { class: "zc-opaque" },
      h(
        "p",
        { class: "zc-opaque-title" },
        "Unavailable component: ",
        h("code", null, node.componentId),
      ),
      h(
        "ul",
        { class: "zc-opaque-reasons" },
        diagnostic.reasons.map((reason, index) =>
          h("li", { key: `zc-reason-${index}` }, reason.message),
        ),
      ),
      h(
        "details",
        { class: "zc-opaque-payload" },
        h("summary", { "data-zc-affordance": "" }, "Preserved payload"),
        h("pre", null, JSON.stringify(node, null, 2)),
      ),
    );
  }

  function renderNode(node: CompositionNode): JSX.Element {
    const entry = entryById.get(node.componentId);
    const diagnostic = classifyNode(node, manifest);
    const opaque = diagnostic.opaque || !entry;
    const label = entry?.title ?? node.componentId;

    const body: ComponentChildren =
      opaque || !entry ? renderOpaque(node, diagnostic) : renderComponent(node, entry);

    return h(
      "div",
      {
        key: `zc-node-${node.id}`,
        class: "zc-node",
        "data-zc-node-id": node.id,
        "data-zc-selected": session.selectedId === node.id ? "" : undefined,
        "data-zc-opaque": opaque ? "" : undefined,
      },
      // Both children are KEYED — see the DOM-identity note in the module header.
      edit
        ? h(
            "span",
            { key: "zc-chrome", class: "zc-chrome", "aria-hidden": "true" },
            label,
          )
        : null,
      h(
        Fragment,
        { key: "zc-body" },
        h(
          NodeErrorBoundary,
          {
            nodeId: node.id,
            componentId: node.componentId,
            resetToken: revision ?? 0,
            onError: onNodeError,
          },
          body,
        ),
      ),
    );
  }

  return h(
    "div",
    {
      class: "zc-canvas",
      "data-composer-canvas": "",
      "data-mode": session.mode,
      onClickCapture: edit ? onClickCapture : undefined,
      onKeyDownCapture: edit ? onKeyDownCapture : undefined,
    },
    renderSlotChildren(
      document.root,
      null,
      VIRTUAL_ROOT_SLOT_ID,
      "the document",
      "vertical",
      false,
    ),
  );
}

// ── Per-node error boundary ─────────────────────────────────────────────────

interface NodeErrorBoundaryProps {
  nodeId: string;
  componentId: string;
  /** Changing this clears a latched error — see `getDerivedStateFromProps`. */
  resetToken: number;
  onError?: (nodeId: string, message: string) => void;
  children?: ComponentChildren;
}

interface NodeErrorBoundaryState {
  error: string | null;
  token: number | null;
}

/**
 * Isolates a throwing component to its own node. A Composition can legitimately
 * hold props a component rejects (an older document, a hand-edited value, a prop
 * whose domain narrowed) — the whole canvas must not go blank because one node
 * threw. The failure is reported to the host, rendered in place as a RECOVERABLE
 * message, and retryable both by hand ("Retry") and automatically when the next
 * revision arrives.
 */
class NodeErrorBoundary extends Component<NodeErrorBoundaryProps, NodeErrorBoundaryState> {
  state: NodeErrorBoundaryState = { error: null, token: null };

  /**
   * Clears a latched error whenever a NEWER snapshot arrives, without remounting
   * the subtree — so fixing the offending prop in the inspector retries the
   * component, while an ordinary re-render (hover, selection) leaves both the
   * error state AND the component's DOM node untouched.
   */
  static getDerivedStateFromProps(
    props: NodeErrorBoundaryProps,
    state: NodeErrorBoundaryState,
  ): Partial<NodeErrorBoundaryState> | null {
    if (props.resetToken !== state.token) return { error: null, token: props.resetToken };
    return null;
  }

  componentDidCatch(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.setState({ error: message });
    this.props.onError?.(this.props.nodeId, message);
  }

  render(): ComponentChildren {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return h(
      "div",
      { class: "zc-node-error", role: "status" },
      h(
        "p",
        { class: "zc-node-error-title" },
        "This component failed to render: ",
        h("code", null, this.props.componentId),
      ),
      h("p", { class: "zc-node-error-detail" }, error),
      h(
        "button",
        {
          type: "button",
          class: "zc-node-error-retry",
          "data-zc-affordance": "",
          onClick: () => this.setState({ error: null, token: this.props.resetToken }),
        },
        "Retry",
      ),
    );
  }
}
