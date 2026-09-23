# `@zudo-sg/demo-ui`

Preact components and their co-located stories for this repository's demo
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
