# Composer prototype — issue #242

Standalone interaction prototype for [Takazudo/zudo-sg#242](https://github.com/Takazudo/zudo-sg/issues/242), baked for the [Composer implementation epic](https://github.com/Takazudo/zudo-sg/issues/243).

This prototype tests the Composer's authoring model before production integration. It lives under the repository's temporary-resource convention but does not import production code.

## Run

```bash
python3 -m http.server 4173 \
  --bind 127.0.0.1 \
  --directory .
```

Open <http://127.0.0.1:4173/>.

From this directory, the deterministic interaction contract can be rerun with:

```bash
COMPOSER_PROTOTYPE_URL=http://127.0.0.1:4173/ node interaction-check.mjs
```

The check uses the repository's `@playwright/test` dependency and does not write screenshots.

## Core walkthrough

1. Select `SplitLayout` in the tree and inspect its named `left` and `right` slots.
2. Add a component to either slot from the tree or canvas.
3. Select the new component and edit its props in the right panel.
4. Move it up or down, or remove it.
5. Switch to Preview to remove editor outlines and make the canvas read-only.
6. Resize both side panels by dragging, or focus a divider and use the arrow keys.
7. Export JSX and compare its nesting and prop values with the canvas/tree.

Changes, panel widths, mode, and viewport choice persist in local storage. `Reset sample` restores the initial Composition.

## What this proves

- One serializable tree can drive the structure tree, canvas, inspector, and JSX export.
- Named slots must be first-class data. A `container: true` flag cannot express “put B and C in A's right column.”
- Stable node IDs are required because a Composition can contain duplicate component types.
- The existing story registry is a useful catalog seed, but its current metadata does not describe container/slot capability, a complete prop schema, or serialization.
- The production Composer will need a manifest layer (or richer story metadata) with component identity, editable props, slots, defaults, constraints, preview renderer, and serializer behavior.

## Deliberate prototype shortcuts

- The component catalog is a small hard-coded `composerManifest` inspired by `@zudo-sg/ui`.
- `SplitLayout` and `Stack` are prototype-only primitives used to test named and default slots.
- Export is labelled “JSX preview.” Production-component props follow the current UI APIs; `SplitLayout`, `Stack`, and their layout props remain prototype-only.
- The canvas renders representative HTML/CSS instead of production Preact components in an iframe.
- Mobile widths provide a canvas-only view; responsive authoring controls are deferred.
- No drag-and-drop, undo/redo, backend persistence, multi-document management, or JSX import.

## Production follow-up suggested by the prototype

Define a Composer manifest contract before building the route. The minimum shape is:

```ts
type ComposerComponentDefinition = {
  type: string;
  component: ComponentType<unknown>;
  category: string;
  defaults: Record<string, unknown>;
  controls: ComposerControl[];
  slots: Array<{
    name: string;
    label: string;
    accepts?: string[];
    maxItems?: number;
  }>;
  serialize?: (node: CompositionNode) => string;
};

type CompositionNode = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  slots: Record<string, CompositionNode[]>;
};
```

For production previewing, reuse the styleguide's iframe isolation pattern and pass the serializable Composition tree across the boundary.
