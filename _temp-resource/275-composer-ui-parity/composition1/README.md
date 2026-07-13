# composition1 — Composer prototype

Interactive UX prototype for [zudo-sg issue #242](https://github.com/Takazudo/zudo-sg/issues/242):
**Composer**, a CMS-like sub-app that nests zudo-sg components into a
"Composition", with live preview, prop tweaking, and source export.

## Run

Open `index.html` directly in a browser (double-click). Preact/htm load from
jsdelivr CDN, so you need to be online. If `file://` gives trouble, serve it:

```bash
npx serve .        # or: python3 -m http.server
```

State auto-saves to `localStorage` (`composer-composition1`); the **Reset**
button restores the sample composition.

## What it covers (issue spec + round-2 feedback)

- Shared site header (mocked) + sub-app util header
- Util header: **Edit / Preview toggle**, **Export** button → dialog with the
  current source (JSX and JSON tabs, copy button), clipboard chip
- **L**: component tree structure, directory-tree style, resizable
- **C**: component preview area; **R**: detail panel with live prop editors
- **Insert points at every gap** — slim "+" bars before every child (including
  before the first) plus a full-width add button at each container end; both
  open the component chooser at that exact position
- **Component chooser dialog** — grouped catalog with an **enlarge toggle**
  (near-fullscreen) and a **live preview pane**: hovering a card renders that
  component with default props (containers get a dashed sample child)
- **Inline text editing** — Heading and Text are editable directly on the
  canvas: click the selected component again (or double-click). Enter commits
  (Heading), Escape cancels, blur commits; multiline preserved for Text
- **Drag & drop move** — the active component shows a drag grip (top right);
  dragging highlights every valid insert point (targets inside the dragged
  subtree are excluded), the hovered target gets a stronger highlight, and
  **holding Alt drops a copy** instead of moving
- **Context menus** — active component: "⋯" opens Copy / Cut / Duplicate /
  Delete; every insert point: "⋯" opens Add / **Paste here** (paste shows the
  clipboard's component type; disabled when empty)
- Keyboard: Delete removes selection, Escape closes menus/dialogs
- Preview mode is fully read-only: edit chrome hidden AND the inspector's
  prop fields/actions are disabled (tree stays navigable for inspection)

## Mock component registry

`app.js` contains a `REGISTRY` of 12 stand-in components (Section, Columns,
Stack, Row, Card, Heading, Text, Badge, Divider, Hero, ImagePlaceholder,
Button). Each entry carries the metadata the issue says should live in story
files:

- `container: true` — which component can hold others
- `slots: ['Left', 'Right']` — named multi-slot containers (Columns)
- `props` — schema: kind (`string` / `text` / `boolean` / `enum`), label,
  options, default. Drives the inspector's editors AND the JSX export
  (only non-default props are emitted)
- `inlineEdit: { prop, multiline }` — which prop is editable directly on
  the canvas
- `flow: 'row'` — horizontal containers get vertical insert bars

For the real implementation this registry would be generated from
`packages/ui` + story metadata (the styleguide's codegen-backed component
registry in `src/styleguide/data/` already scans the catalog).

## Implementation notes (hard-won)

- **Inline editing**: the contentEditable element is rendered with NO vdom
  text child (content set imperatively via ref) so Preact re-renders can't
  reset the caret; the element is **keyed differently in edit vs read mode**
  so exiting doesn't leave a duplicate text node behind.
- **Keyed structural children**: the hover tag / controls inside a node shell
  must be keyed — otherwise Preact's unkeyed diff can match the tag `<span>`
  against a component's own `<span>` (Badge) and destroy/recreate it on every
  hover.
- **Drop zones**: during a drag, insert-point children get
  `pointer-events: none` so child-crossing `dragleave` (null `relatedTarget`
  in Chromium DnD) can't wipe the dropover highlight.
- `dragstart` must not mutate state synchronously (cancels the drag in
  Chromium) — drag state is set via `setTimeout(0)`.
- **JSX export**: string props containing newlines/quotes are emitted as a JS
  expression (`text={"a\nb"}` via JSON.stringify) — JSX string attributes do
  NOT process backslash escapes, so `text="a\nb"` would render a literal \n.
- **Selection chrome placement**: the type tag and grip/⋯ controls float
  ABOVE the node box (Figma-style) so they never cover small components;
  page-top-level blocks keep them inside (the page frame clips above them).
  Shrink-wrap components (Button, Badge) mark `fit: true` in the registry so
  their shell is `width: fit-content` and the outline hugs the component.

## Not covered (out of scope for this prototype)

- Real `@zudo-sg/ui` components (stand-ins approximate the look)
- Persistence beyond localStorage, multi-composition management
- Import of a previously exported composition
- Undo/redo

Throwaway prototype — do not commit; the learning goes back to the issue.
