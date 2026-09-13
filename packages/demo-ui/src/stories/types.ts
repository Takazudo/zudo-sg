/**
 * @zudo-sg/ui — story-authoring contract (re-export)
 *
 * These types define the shape every `*.stories.tsx` module must satisfy so the
 * S6 styleguide catalog can discover and render stories. Discovery itself is
 * codegen (the `zudo-sg gen-registry` CLI command), not `import.meta.glob` — see
 * STORIES.md §2.
 *
 * The full prose contract — glob root, file location, source-extraction rules,
 * browser/MSW rules — lives in packages/ui/STORIES.md. Keep that doc in sync
 * with the canonical contract at packages/styleguide/src/stories/types.ts.
 *
 * A story module exports exactly:
 *   - a default-exported `meta: StoryMeta`
 *   - one or more named `Story` objects (the variants to render)
 * Nothing else should be exported. The registry keys stories by the module's
 * glob path and reads `meta` + every named export that is a `Story`.
 *
 * This file re-exports the engine's canonical contract (`@takazudo/zudo-sg/stories`)
 * rather than duplicating it — see ADR docs/adr/styleguide-engine.md decision 3.
 * Kept as its own module (not a direct `@takazudo/zudo-sg/stories` import from
 * callers) because the engine's `new-component` scaffold
 * (`packages/styleguide/src/cli/scaffold/`) generates relative `../stories/types`
 * imports and its tests assert that path — do not remove this file.
 */

export type { Story, StoryCategory, StoryControl, StoryMeta, StoryModule } from "@takazudo/zudo-sg/stories";
export { defineStory } from "@takazudo/zudo-sg/stories";
