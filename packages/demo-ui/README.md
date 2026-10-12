# `@zudo-sg/demo-ui`

zudo-react components and their co-located stories for this repository's demo
library. This is this repo's own showcase component set — catalogued by the
`@takazudo/zudo-sg` styleguide engine to prove it on a real project — and is
not a shipped provider for any other product. The Composer and Sitemapper
applications live independently in
[Takazudo/zudo-composer](https://github.com/Takazudo/zudo-composer) with no
coupling to this package.

## Structure

Components live under `src/<category>/<component>/`, grouped into nine
category directories (`cards/ chrome/ content/ forms/ landing/ media/ news/
search/ shared/`). Each component's story is co-located beside it. This
components-only-package-with-co-located-stories layout is the pattern the
styleguide engine recommends for adopters — see the "Architecture" docs on the
root site for the full rationale.

The complete story-authoring rules live in [`STORIES.md`](./STORIES.md).

## Story contract: a re-export of the engine's canonical types

The canonical story types (`StoryMeta`, `Story<P>`, `StoryControl<P>`,
`StoryModule`, `defineStory`) are owned by the `@takazudo/zudo-sg` styleguide
engine (`packages/styleguide`, exported as `@takazudo/zudo-sg/stories`).
`src/stories/types.ts` in this package re-exports them from
`@takazudo/zudo-sg/stories` (a real `workspace:*` dependency) rather than
duplicating the type body. Existing hand-authored stories use this local
re-export; the engine's `new-component` scaffold imports the public
`@takazudo/zudo-sg/stories` contract directly. See
`docs/adr/styleguide-engine.md` decision 3 for the full rationale.

## Consuming from source

`@zudo-sg/demo-ui` is consumed from source — its `exports` map points at
`./src/*` directly and it has no `build` script, so edits are picked up by
consumers immediately; there is no dist step to run.

## Runtime and styles

The sole peer is `@takazudo/zfb ^4.3.1`; markdown uses
`@takazudo/zfb-md-wasm 4.3.3`. Components use `class`, native `on:*` events,
and setup-once zudo-react scopes. `ThemeControl` is the unique client island;
server wrappers import it statically and use the host's Island boundary.

Import `styles/tokens.css`, `styles/colors.css`, and `styles/components.css`.
Tokens are plain `:root` variables mapped to semantic wind utilities by
`styles/wind-tokens.mjs`. Unsupported utility forms use unlayered `zc-*`
classes in the category CSS files aggregated by `styles/components.css`.
Keep complete literal utility candidates, including `md:` at 768px.

`Field` takes `children({ id, describedBy })`: forward `id` and
`aria-describedby={describedBy}` to the control. A hint supplies `${id}-hint`;
without a hint `describedBy` is undefined.

Tests use `src/test-utils/zudo-react.ts`: `renderSsr` for server output and
`renderIsland(Component, props)` for hydration, then explicit-root queries,
`fire`, `flushAll`, and `disposeAll`. Diagnostics fail tests. New props require
dispose and remount; see [STORIES.md](./STORIES.md#10-no-provider-layer).
