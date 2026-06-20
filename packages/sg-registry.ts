// Styleguide story registry — the single eager-glob discovery point.
//
// DISCOVERY MECHANISM (S6 decision): eager `import.meta.glob`, the preferred
// path #1 of the issue's fallback ladder. No codegen prebuild is needed —
// zfb 0.1.0-next.53 expands eager `import.meta.glob` at SSR render time, so
// every `*.stories.tsx` module's `meta` + variant exports are present
// synchronously when this module is imported by a page.
//
// WHY THIS FILE LIVES AT `packages/` (not the literal repo root):
//   STORIES.md (S5) specifies "the registry lives at the repo root" with the
//   pattern `./packages/ui/**/*.stories.tsx`. Empirically (S6 spike) zfb's
//   bundler:
//     1. REJECTS `../` parent-relative glob patterns outright
//        ("parent-directory (`../`) patterns are not supported"), and
//     2. only materialises KNOWN top-level dirs (`pages/`, `src/`,
//        `packages/`, `apps/`) into its esbuild shadow tree — a bare file at
//        the literal repo root (`/registry.ts`) is never bundled and fails to
//        resolve ("Could not resolve").
//   The glob base is the IMPORTER'S directory. So the registry must sit inside
//   a materialised dir, one level above `ui/`, and glob with a plain (no-`../`)
//   pattern. `packages/` is the materialised root of the `ui` workspace, so
//   `packages/sg-registry.ts` + `./ui/**/*.stories.tsx` is the functional
//   equivalent of the STORIES.md "root-level registry" intent — same set of
//   files, zero `../`, eager, SSR-resolved. Verified: all 10 stories / ~30
//   variants discovered with meta + every named export intact.
//
// If a future zfb regression breaks eager glob expansion, fall back to the
// codegen ladder rung #2 (zzmod's `scripts/generate-story-glob.mjs` pattern):
// a prebuild script that scans `packages/ui/**/*.stories.tsx` and emits a
// static-import module exposing the SAME `storyModules` shape. The consumer
// (`src/styleguide/data/registry.ts`) keys off the path→module map, so only
// THIS file would change.

import type { StoryModule } from "@zudo-sg/ui";

/**
 * Path → story module map. Keys are glob-relative (e.g.
 * `./ui/src/button/button.stories.tsx`). Each module is `{ default: meta, ...named Story exports }`.
 */
export const storyModules = import.meta.glob<StoryModule>(
  "./ui/**/*.stories.tsx",
  { eager: true },
);
