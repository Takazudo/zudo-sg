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

Several independent things can be adopted, and you can take any of them
without the others:

1. **The story-authoring contract + registry codegen** — the `*.stories.tsx`
   shape and the script that discovers story files and turns them into an
   explicit-import registry (§2 below, first four rows).
2. **The catalog UI chrome** — the pages/components that actually render that
   registry into a browsable styleguide (§2 below, `src/features/styleguide/*`
   and `src/styleguide/data/`).
3. **The component provider boundary** — typed `*.composer.tsx` sidecars, the
   generated pack, explicit provider CSS, and exact package-only Git handoff
   described in §6 below.

You could, for example, adopt the story contract to standardize how your team
authors component variants without adopting this catalog's UI at all.

Composer and Sitemapper are no longer zudo-sg adoption targets. Their product
source, routes, storage, and deployment belong to
[zudo-composer](https://github.com/Takazudo/zudo-composer); see §7.

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
| _(optional)_ [`scripts/gen-z-index.mjs`](./scripts/gen-z-index.mjs) | Regenerates a Tailwind v4 `@theme` z-index block from a single `Z_INDEX_TIERS` source array, so z-index layers stay centrally defined. See the parsing caveat in §5. | `scripts/gen-z-index.mjs`. |

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

## 6. Adopting the component provider

The provider contract is independent from the story catalog. zudo-sg owns the
real components and publishes their Composer-facing definitions through
`@zudo-sg/ui`; the standalone zudo-composer application consumes the pack.
An adopter can use the story system, the provider pack, both, or neither.

### Public package boundary

| Source path | Purpose |
|---|---|
| [`packages/ui/src/**/*.composer.tsx`](./packages/ui/src) | Co-located typed component definitions authored with `defineComponent`. |
| [`packages/ui/src/composer-pack.ts`](./packages/ui/src/composer-pack.ts) | Generated trusted pack, serializable manifest, and runtime registry. |
| [`packages/ui/styles/composer.css`](./packages/ui/styles/composer.css) | Explicit Tailwind/provider CSS entry required when rendering the pack. |
| [`packages/ui/package.json`](./packages/ui/package.json) | Public `./composer-pack` and `./styles/composer.css` exports plus peer contracts. |
| [`ui-provider-handoff.json`](./ui-provider-handoff.json) | Exact package-only UI and component-contract Git coordinates. |

Consumers import the executable/data boundary and CSS explicitly:

```ts
import {
  componentPack,
  componentPackManifest,
  componentRuntimeRegistry,
} from "@zudo-sg/ui/composer-pack";
import "@zudo-sg/ui/styles/composer.css";
```

The manifest is JSON-safe. The runtime registry retains trusted Preact
components plus optional render/inline-editor adapters. Neither value imports a
story module.

### Permanent authoring rule

1. Add `<name>.composer.tsx` beside the real component.
2. Call `defineComponent` from `@zudo-composer/component-contract` against the
   real component props.
3. Assign explicit stable persisted keys: component `id`, `schemaVersion`,
   every field `prop`, and each slot `id` plus real component `prop`.
4. Publish source metadata from the package root:
   `{ module: "@zudo-sg/ui", exportKind, exportName }`. Private
   `@zudo-sg/ui/src/*` source paths are forbidden.
5. Export one display object containing `title`, `category`, and
   `description`. The story imports and spreads it so display data stays
   single-sourced; the story does not contain a provider definition.
6. From the zudo-sg source repository root, run `pnpm gen:composer-pack` and
   commit the generated pack. Run `pnpm check:composer-pack` there to reject
   discovery or generation drift.

See [`packages/ui/STORIES.md` §10](./packages/ui/STORIES.md#10-composer-component-sidecars)
for fields, slots, inline editing, persisted-key invariants, and the generated
boundary.

### Exact package-only handoff

The external install is a package-root Git commit, not a monorepo subdirectory
selector. Finish every `packages/ui` code and documentation change before
advancing `package/ui-v1`. The package commit's root tree must exactly equal
`HEAD:packages/ui`, and `ui-provider-handoff.json` must record that tree,
commit, literal Git spec, and the exact component-contract package commit.

Never use Git `path:` syntax, `workspace:`, `file:`, `link:`, or sibling
repository paths in an external consumer. Verify the finished handoff from the
zudo-sg source repository root with:

```sh
pnpm check:composer-pack
pnpm check:ui-provider-boundary
pnpm test:ui-provider-package
pnpm verify:ui-provider-install -- --exact
```

Do not pre-write the eventual source `main` SHA or a green CI URL. Those are
recorded only after the source merge and remote checks exist.

There are currently zero users and zero production Composer/Sitemapper data.
The provider and consuming product therefore have no backward-compatibility,
migration, redirect, alias, old-name, or old-storage obligation. A clean current
schema may replace earlier prototypes destructively.

---

## 7. Composer and Sitemapper ownership

Composer and Sitemapper are products of the standalone
[zudo-composer](https://github.com/Takazudo/zudo-composer) repository. That
repository owns their headless domains, application UI, routes, preview
protocol, persistence providers, clean database identities, CI, and deployment.
zudo-sg supplies components only through the installed component pack boundary.

The former `src/composer`, `src/sitemapper`, `src/features/composer`,
`src/features/sitemapper`, `pages/composer`, and `pages/sitemapper` trees have
been deleted from this repository. They are not adoption inputs, and zudo-sg
does not provide aliases, redirects, migrations, or compatibility shims for
their removed routes or storage identities.

For a new Composer/Sitemapper deployment, start from zudo-composer and inject a
validated `@zudo-composer/component-contract` pack. For a new component system,
implement the provider boundary in §6. Stories remain a styleguide concern and
are never required inputs to Composer or Sitemapper.

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
