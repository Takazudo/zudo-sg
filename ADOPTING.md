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
| [`scripts/gen-sg-registry.mjs`](./scripts/gen-sg-registry.mjs) | Codegen that globs `<components-root>/**/*.stories.tsx` (any depth — covers both the one-level and category-nested layouts) on the filesystem and rewrites two explicit-import registries from it (story discovery can't be `import.meta.glob` — zfb doesn't statically inline that call, and the literal survives into the client islands bundle and throws in the browser). Needs the flag adaptations in §3 below. | `scripts/gen-sg-registry.mjs`. |
| `src/features/styleguide/*` (21 files across `chrome/`, `code-panel/`, `preview/`, `search/`, `token-tweak/`, plus a top-level `styles.css`) | The catalog UI itself: layout chrome + header toggles, the code panel (source display, copy button, CSS injection, CodeMirror setup), the preview iframe/route, the sidebar search/filter, and the design-token live-tweak panel. | `src/features/styleguide/` (or wherever the adopting project's app-level `src/` lives). |
| [`src/styleguide/data/`](./src/styleguide/data/) | The registry consumer: `sg-registry.ts` (codegen output), `registry.ts` (category grouping + variant ordering), `nav-nodes.ts`, `component-docs.ts`. | `src/styleguide/data/`. |
| [`scripts/new-component.mjs`](./scripts/new-component.mjs) + [`scripts/lib/component-scaffold.mjs`](./scripts/lib/component-scaffold.mjs) + [`scripts/lib/scaffold-config.mjs`](./scripts/lib/scaffold-config.mjs) | The `pnpm new:component` scaffolder — generates a component skeleton, stories file, test file, barrel export, and re-runs the registry codegen in one command. | `scripts/new-component.mjs`, `scripts/lib/component-scaffold.mjs`, `scripts/lib/scaffold-config.mjs`. |
| _(optional)_ [`scripts/gen-token-manifest.mjs`](./scripts/gen-token-manifest.mjs) + [`scripts/lib/ui-token-manifest.mjs`](./scripts/lib/ui-token-manifest.mjs) | Regenerates the shared UI package's design-token manifest (feeding the token-tweak panel) from `packages/ui/styles/tokens.css` / `colors.css` via a real CSS AST parse (postcss), rather than a hand-maintained copy. | `scripts/gen-token-manifest.mjs`, `scripts/lib/ui-token-manifest.mjs`. |
| _(optional)_ [`scripts/gen-root-token-manifest.mjs`](./scripts/gen-root-token-manifest.mjs) + [`scripts/lib/root-token-manifest.mjs`](./scripts/lib/root-token-manifest.mjs) + [`scripts/lib/css-var-resolver.mjs`](./scripts/lib/css-var-resolver.mjs) | Regenerates the **root host's own** design-token manifest (`src/config/design-tokens-manifest.ts`) from `src/styles/global.css` plus the two shared `@zudo-sg/ui` files it `@import`s, via a cross-file CSS custom-property resolver — needed because the root manifest mixes shared-package tokens, root-specific `@theme` overrides, and `var()` indirection across files, which `gen-token-manifest.mjs`'s single-file parse can't follow (see #208/#209/#210/#211). | `scripts/gen-root-token-manifest.mjs`, `scripts/lib/root-token-manifest.mjs`, `scripts/lib/css-var-resolver.mjs`, `scripts/lib/css-var-parser.mjs`. |
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

- `COMPONENTS_ROOT` (default `"packages/ui/src"`) — the directory scanned at
  any depth for `*.stories.tsx`. Every component in this repo now lives in
  the **category-nested** layout, `<COMPONENTS_ROOT>/<category-slug>/<name>/`
  (e.g. `packages/ui/src/cards/card/card.stories.tsx`) — the original
  one-level `<COMPONENTS_ROOT>/<name>/` layout the scaffolder still supports
  (omit `--nested`) has no components left using it in this repo; a fork
  starting fresh should treat `--nested` as the only path worth adopting.
  `<category-slug>` is the lowercase, hyphenated form of the component's
  `StoryCategory` (§below), e.g. `"Data Display"` → `data-display`.
- `BARREL_INDEX` (default `"packages/ui/src/index.ts"`) — the barrel file the
  scaffolder inserts an `export { … }` block into. Set to `null` for a
  project with no barrel-file convention; `new-component.mjs` then always
  skips the insert step (same as always passing `--skip-barrel`). Note a
  `--nested` scaffold never touches the barrel regardless of this setting —
  the registry (`sg-registry.ts`) imports every story via its package
  subpath, never the barrel, so a nested component is catalog-visible
  without a barrel export at all; only add one by hand if the component
  should also be reachable from `@zudo-sg/ui`'s top-level import.
- `UI_PACKAGE_NAME` (default `"@zudo-sg/ui"`) — the npm package name used in
  generated `usage` snippets and in the package-scoped import specifiers
  `gen-sg-registry.mjs` emits. If `COMPONENTS_ROOT` moves, keep the UI
  package's `package.json` `exports` map wildcard matching the new root's
  basename — `gen-sg-registry.mjs` derives its import root from
  `UI_PACKAGE_NAME` + that basename.

### The `StoryCategory` set

`StoryCategory` is a closed union of 12 members (`Actions`, `Typography`,
`Layout`, `Data Display`, `Forms`, `Navigation`, `Content`, `Landing`,
`News`, `Search`, `Feedback`, `Media`), declared once in
`packages/ui/src/stories/types.ts` (`STORY_CATEGORIES`). This is the
**sidebar-grouping taxonomy** the catalog sorts stories into — it is
independent of, and larger than, the 9 on-disk category-nested directories
(`cards/ chrome/ content/ forms/ landing/ media/ news/ search/ shared/`): a
single directory can hold components from several `StoryCategory` values
(e.g. `shared/` spans `Actions`, `Layout`, `Navigation`, and `Content`). Two
other files need the same set as a **runtime** array (a plain `.mjs` script
can't import a `.ts` type), so `pnpm gen:story-categories`
(`scripts/gen-story-categories.mjs`) regex-parses `STORY_CATEGORIES` out of
`types.ts`'s source text and rewrites the `GENERATED:STORY_CATEGORIES`
marker blocks in:

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

## 7. Adopting the Composer

The Composer (`/composer`) is a second, independent thing this repo's
architecture can hand off, on top of the catalog covered in §1-§5: a
document-model-driven authoring surface that assembles instances of the
catalog's own components into a composition, backed by a revision-aware save
queue and rendered live through a sandboxed preview iframe. It follows the
same "two independent things get adopted" framing from the top of this
document, but with an added constraint: **the Composer depends on the
story-authoring contract** — specifically the optional `composer` property
`defineComposer<P>` adds to `StoryMeta` (see
[`packages/ui/STORIES.md` §10](./packages/ui/STORIES.md#10-composer-contract-optional-opt-in)) —
so an adopter can take the catalog without the Composer, but cannot take the
Composer without first having adopted the story contract from §1/§2. This
section does not duplicate that contract; read STORIES.md §10 for the
authoring side.

### Minimum viable subset

Per [#349](https://github.com/Takazudo/zudo-sg/issues/349), the smallest
adoptable core is five named pieces: **model + commands + codec/recovery +
save-queue + preview protocol** — i.e. `src/composer/model/` (document model,
commands, codec, recovery) plus `src/composer/persistence/` (the save queue)
plus the preview protocol (`src/features/composer/preview/protocol.ts` +
`bridge.ts` + `client.ts`, see the table below for the full file set). Note
`src/composer/persistence/save-queue.ts` itself imports its record/ref/outcome
types from `src/composer/library/types.ts`, so that one file (not the rest of
`library/`) travels with the minimal cut too — the store/lifecycle
*implementation* the rest of `library/` provides is still an editor-level
addition, not part of the five-item minimum. To get a working editor rather
than just the domain model, add that store/lifecycle contract in full
(`src/composer/library/`), the `generate-jsx` emitter
(`src/composer/source/generate-jsx.ts`), and one storage provider (see
"Environment glue" below). Everything else — reuse, the dev filesystem
transport, the rest of the app UI — is additive.

### What to copy verbatim

Portable domain logic — environment-agnostic, with the same caveat as §1:
even these still need their `@zudo-sg/ui` imports repointed to the fork's own
UI package scope.

| Source path | Purpose | Target location (in the adopting project) |
|---|---|---|
| [`packages/ui/src/composer/types.ts`](./packages/ui/src/composer/types.ts) | The Composer authoring contract: `defineComposer<P>`, scalar-field and structural-slot descriptors — the Composer analog of `stories/types.ts`. | `<ui-package>/src/composer/types.ts`. |
| [`src/composer/model/`](./src/composer/model/) | Document model + commands (tree-mutation operations) + codec (lossless v1→v2 decoder) + recovery (future-schema quarantine). | `src/composer/model/`. |
| [`src/composer/library/`](./src/composer/library/) | Store/lifecycle contract — `CompositionStore` / `CompositionLifecycleStore` / provider descriptors — the seam a storage provider implements against. | `src/composer/library/`. |
| [`src/composer/persistence/`](./src/composer/persistence/) | The revision-aware save queue. | `src/composer/persistence/`. |
| [`src/composer/source/generate-jsx.ts`](./src/composer/source/generate-jsx.ts) | The deterministic emitter — turns a document into exportable JSX source. Copy this file alone, **not** the whole `source/` directory: its sibling `plan-linked-jsx.ts` pulls in `src/composer/reuse/` (materialize/resolver), which is product-specific glue (see below), not core doc-model behavior. | `src/composer/source/generate-jsx.ts`. |
| [`src/features/composer/preview/protocol.ts`](./src/features/composer/preview/protocol.ts) + [`bridge.ts`](./src/features/composer/preview/bridge.ts) + [`client.ts`](./src/features/composer/preview/client.ts) + [`snapshot-store.ts`](./src/features/composer/preview/snapshot-store.ts) | The **preview protocol** — a transport-agnostic, zod-validated postMessage contract between the editor and the preview iframe, plus `snapshot-store.ts`'s DOM-free revision guard that `client.ts` applies inbound messages through. Despite living under `src/features/composer/`, this quartet has no filesystem/IndexedDB/dev-transport coupling, so it is portable domain logic, not host glue. | `src/features/composer/preview/{protocol,bridge,client,snapshot-store}.ts` (or wherever the fork's preview host lives). |

Three loose ends when actually copying the protocol quartet, since none of
them are self-contained in this repo's current tree:

- `protocol.ts` imports `jsonValueSchema` from
  [`src/styleguide/data/composer-schema.ts`](./src/styleguide/data/composer-schema.ts)
  — a small, generic recursive JSON-value zod schema, but it currently lives
  inside that host-owned schema file (see "Environment glue" below, which
  otherwise classifies that file as glue). Extract just that one schema; the
  rest of `composer-schema.ts` is this repo's own registry validation.
- `bridge.ts` imports the route path/title constants from
  [`route.ts`](./src/features/composer/preview/route.ts) (trivial to copy or
  redefine against the fork's own preview route) and, more importantly, calls
  `withBase()` from [`src/utils/base.ts`](./src/utils/base.ts) to build the
  iframe URL — a genuine dependency on this repo's zfb site config (base path
  / trailing slash / locale), not portable as-is. A fork needs its own
  base-path helper here, or a hardcoded path if it has none.
- All four files import shared types through the `@/composer` barrel
  (`src/composer/index.ts`), which just re-exports `model/` — already in this
  table — so that import needs repointing to wherever `model/` lands, not a
  new file to copy.

`src/composer/library/types.ts` also isn't purely environment-agnostic:
`CompositionProviderId` is a closed union over this repo's own two providers
(`indexeddb`, `files`), and `COMPOSITION_PROVIDERS` hardcodes the
project-specific `storageLabel` string `"IndexedDB: zudo-sg-composer"`. Treat
that one file as an adaptation point — add/remove provider ids and edit the
labels for whatever storage backend(s) the fork ships — rather than assuming
the whole `library/` directory needs no changes.

The preview *host* UI that mounts around the protocol — the canvas host,
iframe mounting, `renderer.ts`, `preview-app.ts` — is host-owned chrome (see
"Environment glue" below), not part of this table.

### Sample to re-derive

[`src/composer/sample/`](./src/composer/sample/) is **not** copy-verbatim.
It's this repo's native production sample composition, and it hardcodes this
repo's own `ui.*` component ids, props, and slots — a fork has to re-derive
its own sample document against whatever components it has registered, using
this one only as a worked example of the shape.

### Environment glue you must re-implement or drop

- `src/composer/storage/indexeddb/` — browser IndexedDB storage provider.
- `src/composer/storage/filesystem/` — `node:fs` store with TOCTOU-safe write
  machinery (dev-authoring only, not for a deployed app).
- `src/composer/storage/file-provider/` +
  `plugins/composer-file-provider-plugin.mjs` +
  `scripts/run-composer-file-e2e-server.mjs` — the dev filesystem transport
  that wires the filesystem provider into the local dev server.
- `src/composer/reuse/` — global-template reuse; product-specific, not core
  document-model behavior.
- `src/features/composer/*` **except** `preview/protocol.ts` + `bridge.ts` +
  `client.ts` + `snapshot-store.ts` (portable — see the table above) — the
  rest is host-owned app chrome: canvas host, toolbar, inspector, tree,
  menus, routing, the `chrome/` controller.
- [`pages/composer/*`](./pages/composer/) — the routed pages that mount the
  app.
- [`src/styleguide/data/composer-registry.ts`](./src/styleguide/data/composer-registry.ts) /
  [`composer-schema.ts`](./src/styleguide/data/composer-schema.ts) — the
  host's zod-validated runtime registry, parallel to
  `src/styleguide/data/sg-registry.ts` in §1.

This parallels the `src/features/styleguide/*` host-owned carve-out from §1 —
the shared package ships only the components and their story/composer
contracts, never the app chrome around them.

### Known gaps you'll hit

- **No scaffolding CLI.** Same as §5 above and tracked by the same
  [#179](https://github.com/Takazudo/zudo-sg/issues/179) initializer — there's
  no `pnpm new:composition`-style generator; a fork wires a storage provider
  and the sample by hand.
- **Reuse is product-specific.** `src/composer/reuse/` (global-template reuse)
  is this product's own feature, not core document-model behavior — treat it
  as a pattern to reference, not a module to copy.
- **The dev filesystem transport is authoring-only.**
  `src/composer/storage/filesystem/` and its plugin/server glue exist so this
  repo's own contributors can author the sample composition against real
  files in dev; it is not a deployed-app storage strategy and shouldn't be
  adopted as one.

---

## 8. Related issues

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
