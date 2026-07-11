# Adopting zudo-sg's patterns in another project

This is the **interim, manual-copy path**: a checklist for copying zudo-sg's
component-catalog architecture (story contract, registry codegen, catalog UI
chrome) into another zfb/zudo-doc-based project, by hand, out of this repo's
source tree.

There is no scaffolding CLI yet. [#179](https://github.com/Takazudo/zudo-sg/issues/179)
tracks a future `create-zudo-sg` npm initializer that would stamp out a fresh
project instead of asking an adopter to copy files — this document is
deliberately **not** that. Treat everything below as what the initializer
would eventually automate; when #179 ships, prefer it and treat this file as
superseded for new projects. Until then, this is the checklist.

Two independent things get adopted, and you can take either without the
other:

1. **The story-authoring contract + registry codegen** — the `*.stories.tsx`
   shape and the script that discovers story files and turns them into an
   explicit-import registry (§2 below, first four rows).
2. **The catalog UI chrome** — the pages/components that actually render that
   registry into a browsable styleguide (§2 below, `src/features/styleguide/*`
   and `src/styleguide/data/`).

You could, for example, adopt the story contract to standardize how your team
authors component variants without adopting this catalog's UI at all.

---

## 1. What to copy verbatim

| Source path | Purpose | Target location (in the adopting project) |
|---|---|---|
| [`packages/ui/src/stories/types.ts`](./packages/ui/src/stories/types.ts) | The story-authoring contract's TypeScript shapes: `StoryCategory`, `StoryMeta`, `Story<P>`, `StoryControl<P>`, `defineStory`. | Wherever the adopting project's shared component library lives, e.g. `<ui-package>/src/stories/types.ts`. |
| [`packages/ui/STORIES.md`](./packages/ui/STORIES.md) | The prose contract that `types.ts` implements — file location/discovery, module shape, controls convention, source extraction, browser/MSW rules, scaffolding. Keep it and `types.ts` in sync. | `<ui-package>/STORIES.md`. |
| [`scripts/gen-sg-registry.mjs`](./scripts/gen-sg-registry.mjs) | Codegen that globs `<components-root>/*/*.stories.tsx` on the filesystem and rewrites two explicit-import registries from it (story discovery can't be `import.meta.glob` — zfb doesn't statically inline that call, and the literal survives into the client islands bundle and throws in the browser). Needs the flag adaptations in §3 below. | `scripts/gen-sg-registry.mjs`. |
| `src/features/styleguide/*` (21 files across `chrome/`, `code-panel/`, `preview/`, `search/`, `token-tweak/`, plus a top-level `styles.css`) | The catalog UI itself: layout chrome + header toggles, the code panel (source display, copy button, CSS injection, CodeMirror setup), the preview iframe/route, the sidebar search/filter, and the design-token live-tweak panel. | `src/features/styleguide/` (or wherever the adopting project's app-level `src/` lives). |
| [`src/styleguide/data/`](./src/styleguide/data/) | The registry consumer: `sg-registry.ts` (codegen output), `registry.ts` (category grouping + variant ordering), `nav-nodes.ts`, `component-docs.ts`. | `src/styleguide/data/`. |
| [`scripts/new-component.mjs`](./scripts/new-component.mjs) + [`scripts/lib/component-scaffold.mjs`](./scripts/lib/component-scaffold.mjs) + [`scripts/lib/scaffold-config.mjs`](./scripts/lib/scaffold-config.mjs) | The `pnpm new:component` scaffolder — generates a component skeleton, stories file, test file, barrel export, and re-runs the registry codegen in one command. | `scripts/new-component.mjs`, `scripts/lib/component-scaffold.mjs`, `scripts/lib/scaffold-config.mjs`. |
| _(optional)_ [`scripts/gen-token-manifest.mjs`](./scripts/gen-token-manifest.mjs) + [`scripts/lib/ui-token-manifest.mjs`](./scripts/lib/ui-token-manifest.mjs) | Regenerates the shared UI package's design-token manifest (feeding the token-tweak panel) from `packages/ui/styles/tokens.css` / `colors.css` via a real CSS AST parse (postcss), rather than a hand-maintained copy. | `scripts/gen-token-manifest.mjs`, `scripts/lib/ui-token-manifest.mjs`. |
| _(optional)_ [`scripts/gen-z-index.mjs`](./scripts/gen-z-index.mjs) | Regenerates a Tailwind v4 `@theme` z-index block from a single `Z_INDEX_TIERS` source array, so z-index layers stay centrally defined. See the parsing caveat in §6. | `scripts/gen-z-index.mjs`. |

`src/features/styleguide/*` is **host-owned application code, not part of
`@zudo-sg/ui`** — the shared UI package (`packages/ui`) ships only the
components themselves (buttons, cards, etc.) and the story contract types.
Installing or vendoring `@zudo-sg/ui` alone does **not** bring the catalog
chrome along; that tree has to be copied separately, as listed above. This
was the concrete finding behind [#189](https://github.com/Takazudo/zudo-sg/issues/189)
(the requirements writeup this checklist turns into a document).

---

## 2. Adaptation points

These are the places the copied files bake in a `zudo-sg`-specific assumption
that a fork needs to change. Written against this repo's **current**
(post-cleanup) state — the file/line references below are accurate as of this
document, not as of the original adoption writeup.

### Components root, barrel file, package name

[`scripts/lib/scaffold-config.mjs`](./scripts/lib/scaffold-config.mjs) is the
single source of truth both `new-component.mjs` and `gen-sg-registry.mjs`
read from — edit these three exported constants for your project's layout:

- `COMPONENTS_ROOT` (default `"packages/ui/src"`) — the directory scanned for
  `<name>/<name>.stories.tsx`, one level deep.
- `BARREL_INDEX` (default `"packages/ui/src/index.ts"`) — the barrel file the
  scaffolder inserts an `export { … }` block into. Set to `null` for a
  project with no barrel-file convention; `new-component.mjs` then always
  skips the insert step (same as always passing `--skip-barrel`).
- `UI_PACKAGE_NAME` (default `"@zudo-sg/ui"`) — the npm package name used in
  generated `usage` snippets and in the package-scoped import specifiers
  `gen-sg-registry.mjs` emits. If `COMPONENTS_ROOT` moves, keep the UI
  package's `package.json` `exports` map wildcard matching the new root's
  basename — `gen-sg-registry.mjs` derives its import root from
  `UI_PACKAGE_NAME` + that basename.

### The `StoryCategory` set

`StoryCategory` is a closed union declared once in `packages/ui/src/stories/types.ts`
(`STORY_CATEGORIES`). Two other files need the same set as a **runtime**
array (a plain `.mjs` script can't import a `.ts` type), so
`pnpm gen:story-categories` (`scripts/gen-story-categories.mjs`) regex-parses
`STORY_CATEGORIES` out of `types.ts`'s source text and rewrites the
`GENERATED:STORY_CATEGORIES` marker blocks in:

- `src/styleguide/data/registry.ts` (`CATEGORY_ORDER`)
- `scripts/lib/component-scaffold.mjs` (`VALID_CATEGORIES`)

To add, remove, or rename a category in a fork: edit `STORY_CATEGORIES` in
`types.ts`, then run `pnpm gen:story-categories` and commit the regenerated
files. Never hand-edit between the marker comments — the next codegen run
overwrites it. (Adding a category also still needs a hand-added barrel
section header, `// ── <Category> ──`, in the UI package's story index —
that's intentionally out of scope for the codegen.)

### Branding / site identity

Site identity fields are grouped into one contiguous block in
[`src/config/settings.ts`](./src/config/settings.ts) (marked `Branding`):
`siteName`, `siteUrl`, `metaTags.twitterCreator`, `footer.copyright`. A fork
sets these four in one place rather than hunting through the whole settings
file. Note `metaTags.twitterCreator` and `footer.copyright` are typed by
`@takazudo/zudo-doc`'s `MetaTagsConfig`/`FooterConfig`, so they physically
live in those sub-objects rather than in the branding block itself — each
carries a comment pointing back to it. Leaving `siteUrl` empty is valid but
silently drops OGP absolute image URLs and the canonical `<link>` tag from
the build output; `settings.ts` prints a module-load (build-time) warning
when that happens, so it isn't silent in practice.

### The `@zudo-sg` package scope

The literal npm scope `@zudo-sg` appears in three GitHub Actions workflow
files — `.github/workflows/main-deploy.yml`, `.github/workflows/pr-checks.yml`,
`.github/workflows/preview-deploy.yml` — in `pnpm --filter @zudo-sg/<name>`
invocations, plus in each workspace package's own `package.json` `name`
field (`@zudo-sg/ui`, `@zudo-sg/demo`, `@zudo-sg/doc`). A fork renaming the
workspace scope needs to update the `pnpm --filter` targets in all three
workflow files (`grep -rn '@zudo-sg' .github/workflows/` to find every
occurrence) to match the renamed `package.json` `name` fields.

---

## 3. Deploy identity

Renaming the deployed Worker names / custom domains touches more files than
just the three `wrangler.toml`s — see **[DEPLOY.md § "Deploy identity — keeping
these files in sync"](./DEPLOY.md#deploy-identity--keeping-these-files-in-sync)**
for the full up-to-date file list and what's intentionally out of scope. That
section is the source of truth for this; it isn't duplicated here so the two
can't drift.

---

## 4. Host-owned vs. package-injected routes

Not every route in this repo is a plain file under `pages/`. `@takazudo/zudo-doc`
injects some routes (docs pages, 404, robots, sitemap) directly; others stay
host-owned pages that `pages/` defines itself (`/`, `/components/*`,
`/docs/versions`). Which is which is controlled by `settings.packageOwnedRoutes`
in `src/config/settings.ts` (see the comment directly above that field) and
described at the repo-structure level in this project's own
**[CLAUDE.md § "Monorepo Structure"](./CLAUDE.md#monorepo-structure)** and
**["Key Directories"](./CLAUDE.md#key-directories)** sections. Read those
rather than re-deriving the split here — this file links to them instead of
re-explaining route injection, to avoid the two documents drifting apart.

---

## 5. Known gaps you'll hit

These aren't blockers, but an adopter following this checklist will run into
each of them. Each is tracked by its own issue/epic upstream in this repo —
worth checking those for current status before working around them yourself:

- **Interactive / network-backed stories aren't sanctioned yet.** The story
  contract requires `render` to be pure and synchronous — no `useEffect`, no
  network calls, no MSW (see `STORIES.md` §6). There's no documented pattern
  yet for a component that genuinely needs live data (e.g. an async dialog
  flow) beyond "layer interactivity separately." Tracked by the
  [Interactive Story Pattern epic (#212)](https://github.com/Takazudo/zudo-sg/issues/212).
- **The root host's own token manifest is hand-maintained, not codegen'd.**
  `scripts/gen-token-manifest.mjs` regenerates the *shared UI package's*
  token manifest from real CSS, but `src/config/design-tokens-manifest.ts` —
  the **root host's** manifest, which mixes shared UI tokens, root-specific
  `@theme` overrides, and at least one non-token `clamp()` value — is still a
  hand-copy with nothing enforcing it stays correct. Tracked by the
  [Token Manifest Resolver epic (#208)](https://github.com/Takazudo/zudo-sg/issues/208).
- **`gen-z-index.mjs` and `gen-story-categories.mjs` parse TypeScript source
  as text, not via import.** Both are dependency-free `.mjs` scripts that
  can't resolve `.ts` imports, so they regex-parse the relevant array literal
  (`Z_INDEX_TIERS`, `STORY_CATEGORIES`) directly out of the source file's
  text, with a comment-stripping pass to reduce (not eliminate) sensitivity
  to reformatting. A source-shape change the parser doesn't anticipate (e.g.
  a new field inserted before the ones it looks for) can still silently
  mis-parse rather than fail loudly — check each generator's own header
  comment for exactly what shape it expects before reformatting the file it
  reads from.

---

## 6. Related issues

- [#179](https://github.com/Takazudo/zudo-sg/issues/179) — the deferred
  `create-zudo-sg` initializer this document stands in for.
- [#189](https://github.com/Takazudo/zudo-sg/issues/189) — the original
  adoption-effort writeup this checklist is derived from (closed; superseded
  by the epic below).
- [#190](https://github.com/Takazudo/zudo-sg/issues/190) — the Adoption
  Cleanups epic that fixed the issues #189 surfaced and produced this file.
  Its sub-issues, useful for archaeology on *why* each adaptation point in §2
  looks the way it does:
  - [#188](https://github.com/Takazudo/zudo-sg/issues/188) — scaffolder
    single-root + barrel-index assumptions (→ `scaffold-config.mjs`, §2).
  - [#187](https://github.com/Takazudo/zudo-sg/issues/187) — `check-links.mjs`
    false-positives on hrefs shown in the code panel's displayed source.
  - [#186](https://github.com/Takazudo/zudo-sg/issues/186) — `gen-z-index.mjs`
    regex fragility (→ §5's parsing note).
  - [#182](https://github.com/Takazudo/zudo-sg/issues/182) — `StoryCategory`
    duplicated with no drift guard (→ `gen-story-categories.mjs`, §2).
  - [#181](https://github.com/Takazudo/zudo-sg/issues/181) — deploy identity
    scattered with no single source (→ §3).
  - [#180](https://github.com/Takazudo/zudo-sg/issues/180) — branding config
    seam (→ §2).
  - [#184](https://github.com/Takazudo/zudo-sg/issues/184) — the
    `preset-generator.tsx` no-op stub.
- [#183](https://github.com/Takazudo/zudo-sg/issues/183) and
  [#185](https://github.com/Takazudo/zudo-sg/issues/185) — the original
  interactive-stories and token-manifest-resolver findings; superseded by the
  epics in §5 above (#212, #208).
