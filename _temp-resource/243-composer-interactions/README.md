# Composer round-2 interaction prototype — issue #242

Standalone interaction prototype for the **round-2 interaction layer** of
[Takazudo/zudo-sg#242](https://github.com/Takazudo/zudo-sg/issues/242), baked
for the [Composer implementation epic #243](https://github.com/Takazudo/zudo-sg/issues/243)
(waves 6–8: chooser live preview/enlarge, clipboard/context menus, inline
canvas editing, drag & drop).

This is the sibling of `_temp-resource/243-composer/` (the document-model /
recovery / a11y prototype). This directory fixes the behavioral contract for
the interactions that prototype does not cover. Reference material only —
production code and tests must never import or read `_temp-resource`.

## Run

```bash
python3 -m http.server 4174 \
  --bind 127.0.0.1 \
  --directory .
```

Open <http://127.0.0.1:4174/>. (Port 4173 is the sibling prototype's slot.)

The deterministic interaction contract (40 checks, all passing at bake time):

```bash
COMPOSER_INTERACTIONS_URL=http://127.0.0.1:4174/ node interaction-check.mjs
```

Uses the repository's `@playwright/test` dependency; writes no screenshots.
Preact/htm load from the jsdelivr CDN, so running requires network access.

## Behavioral contract fixed by this prototype

- **Insert points at every gap** — slim "+" bars before every child (including
  before the first) plus a full add button at each container end; each opens
  the chooser at that exact index; horizontal containers get vertical bars
- **Chooser** — grouped catalog with an **enlarge toggle** (near-fullscreen)
  and a **live preview pane**: hovering/focusing a card renders the component
  with default props (containers get a dashed sample child)
- **Inline text editing** — text-like components editable directly on the
  canvas: click the selected component again (or double-click). Enter commits
  single-line, Escape cancels, blur commits; multiline preserved
- **Drag & drop** — the active component shows a drag grip; dragging
  highlights every valid insert point (targets inside the dragged subtree are
  excluded), the hovered target gets a stronger highlight; **Alt at drop =
  copy** instead of move
- **Context menus** — active component "⋯": Copy / Cut / Duplicate / Delete;
  every insert point "⋯": Add / **Paste here** (shows the clipboard's
  component type; disabled when empty); clipboard chip in the toolbar
- **Preview mode is fully read-only** — edit chrome hidden AND the inspector's
  fields/actions disabled; tree stays navigable
- Keyboard: Delete removes the selection; Escape closes menus/dialogs
- Selection chrome (type tag + grip/⋯ controls) floats **above** the node box
  so it never covers small components; shrink-wrap components (Button, Badge)
  use fit-content shells so the outline hugs the component

## Hard-won implementation notes (apply these in production)

- **Inline editing**: render the contentEditable element with NO vdom text
  child (content set imperatively via ref) so re-renders can't reset the
  caret; **key the element differently in edit vs read mode** so exiting
  doesn't leave a duplicate text node; stop `dblclick` propagation inside an
  active session (word-select must not restart the session and revert typing).
- **Keyed structural chrome**: hover tags / control clusters rendered as
  conditional siblings of the component's element MUST be keyed — Preact's
  unkeyed diff can match the tag `<span>` against a component's own `<span>`
  (Badge) and destroy/recreate the component's DOM node on every hover.
  Production acceptance: toggling hover/selection must not change the
  component's DOM node identity.
- **Drop zones**: during a drag, give insert-point children
  `pointer-events: none` — child-crossing `dragleave` (null `relatedTarget`
  in Chromium DnD) otherwise wipes the drop-target highlight.
- **`dragstart` must not mutate state synchronously** (cancels the drag in
  Chromium) — defer drag-state updates (e.g. `setTimeout(0)`).
- **Move semantics**: moving into the dragged node's own subtree is invalid
  (the destination would be orphaned); same-parent moves need an index
  adjustment when the source precedes the destination.
- **JSX export**: string props containing newlines/quotes must be emitted as
  JS expressions (`text={"a\nb"}`) — JSX string attributes do NOT process
  backslash escapes, so `text="a\nb"` renders a literal `\n`.
- **Clipboard**: store a deep-cloned JSON payload; re-issue every node ID at
  each paste; validate slot acceptance at the paste target.
- Reveal-in-tree (expand ancestors) must run on add AND paste/duplicate/drop.

## Files

- `index.html` / `app.js` / `styles.css` — the prototype (Preact + htm via
  CDN, no build step; state persists to localStorage, Reset restores sample)
- `interaction-check.mjs` — the 40-check deterministic contract

## Lifecycle

Deleted together with the sibling prototype by the epic's final confirmation
issue (#252) once durable production behavior/tests exist.
