# Dependency audit register

## Removed on 2026-09-20: three obsolete root declarations and 117 packages

The root declarations for `mermaid`, `minisearch`, and
`remark-cjk-friendly` were removed after the integration checks deferred by
the 2026-09-15 audit. All three were scaffold-era declarations with no current
package import, peer contract, config-string resolution, script/CI use, or
consumer on cached remote branches.

| Removed declaration | Evidence and effect |
| --- | --- |
| `mermaid` | zudo-doc 5.25.0 renders diagrams through its own pinned `https://esm.sh/mermaid@11.15.0` dynamic import and explicitly has no package dependency. The unused local Mermaid 12 declaration removed 109 lockfile package records; it did not change the browser renderer or remove that separate CDN supply-chain surface. |
| `minisearch` | The current search widget explicitly uses its built-in fetch, substring matching, weighting, and ranking code. Neither first-party code nor zudo-doc imports MiniSearch. Removing the leaf declaration removed one package record. |
| `remark-cjk-friendly` | zudo-doc forwards `cjkFriendly` to zfb 2.20.0, whose native Markdown pipeline owns the CJK emphasis and autolink-boundary plugins. No JavaScript remark plugin is loaded. Removing the obsolete declaration removed seven package records while preserving `cjkFriendly: true`. |

Three independent adversarial checks covered hidden consumption, behavioral
fidelity, and value versus churn. All upheld every removal. No replacement
code was added.

Before the removals, `pnpm dedupe` also collapsed five stale compatible
resolutions. That normalization moved `dompurify` 3.4.11 to 3.4.15 and unified
older `tsx`, `postcss`, and `tinyexec` resolutions already permitted by their
manifest ranges. It reduced the lockfile package section from 683 to 678
entries. The three declaration removals then reduced it from 678 to 554: 117
records are attributable to their dependency closures, while the remaining
seven-record net reduction comes from lockfile normalization and shared graph
changes. The full change is 129 fewer package records than the untouched base.

Verification passed with a frozen install, the full workspace check, root,
doc, and demo production builds, the 135-file / 1,152-test root unit suite, and
the packed foreign-host installation proof. Emitted root HTML still contains
the generated search client and the pinned Mermaid runtime import; root builds
still emit 89 pages.

## Audited on 2026-09-15: two packages removed, runtime contracts preserved

Audited on 2026-09-15 for [#700](https://github.com/Takazudo/zudo-sg/issues/700),
against post-#696 commit `ca7ea11da65b83281f212d2d22e45f4ec4f4dca2`.
The scope was the root, `doc`, `apps/demo`, `packages/demo-ui`, and
`packages/styleguide` manifests. `fixtures/engine-host` was excluded.

The decision rule is used versus unused. A direct import needs a direct
declaration even when another package already installs it. Uncertain removals
stay KEEP. Knip 6.35.1 supplied candidates; source, config, scripts, installed
framework output, and cached remote branches supplied the verdicts.

## Removed: one declaration and five obsolete files

| Removed item | Evidence and effect |
| --- | --- |
| Root `remark-directive` | No source, config, script, MDX, installed zudo-doc runtime, or zfb native-binary reference. `zfb.config.ts` supplies a directive vocabulary to zudo-doc's preset, which passes it to zfb's native Markdown features. No JavaScript remark plugin is configured. |
| `src/utils/content-files.ts` | None of its file-path or exported-symbol references has a current consumer. The current collection/navigation flow uses `zfb/content` and package route context. |
| `src/utils/smart-break.tsx` | No current consumer of its path or exports. Installed zudo-doc chrome and content components import the package's own `smart-break/index.js`. |
| `src/components/preset-generator.tsx` | An unreferenced component returning `null`; its former `pages/lib/_preset-generator` import chain is absent. |
| `src/config/frontmatter-preview-defaults.ts` | No consumer of the file or `DEFAULT_FRONTMATTER_IGNORE_KEYS`; root frontmatter preview is disabled. |
| `scripts/migrate-hex-to-oklch.mjs` | Completed one-time palette migration, with no script, hook, workflow, documentation, or source caller. The live contrast tools still use Culori. |

The lockfile was regenerated once from the final manifests. Its `packages`
section changed from **673 to 671** entries: `remark-directive@3.0.1` and
`micromark-extension-directive@3.0.2` disappeared. No retained package version
changed. `mdast-util-directive` stays because `@takazudo/zfb-md-wasm` uses it.
The source deletions do not remove any additional packages.

Each removal was challenged for hidden consumers, behavioral changes, and
value versus maintenance cost. These are deletions, with no replacement parser,
color conversion, or rendering implementation. Searches covered aliases,
exported symbols, dynamic imports, script commands, package-generated imports,
and cached origin branches. An old Dependabot actions/cache branch still has a
pre-migration sidebar importing `smart-break`; its branch delta changes only
the workflow, with no change to that caller or utility since its merge base.
It introduces no incoming source consumer.

## Added: dependencies now belong to their consumers

| Declaration | Evidence |
| --- | --- |
| `apps/demo` dev dependency `vitest` | Seven demo test files import it; the demo typecheck includes those tests. Root Vitest remains the test runner. |
| `apps/demo` dev dependency `@testing-library/preact` | `pages/__tests__/_mdx-image.test.tsx` imports `render` and `screen`. |
| `packages/styleguide` dev dependency `@types/culori` | The strict TypeScript token-manifest test imports Culori, which ships no types. The root declaration previously supplied those types through ancestor resolution. |

All three additions reuse existing locked versions and add **zero packages**.
The reverse import audit found no missing npm runtime dependency in
`packages/styleguide/src`: its CodeMirror modules, renderer, PostCSS, Tailwind
compiler/scanner, Preact, zfb, zudo-doc, and zdtp are declared dependencies or
required peers. `virtual:*` modules come from the configured plugins;
`zfb/content` and `zfb/config` are framework modules, not an undeclared npm
package named `zfb`. CSS imports were checked too: doc's Tailwind imports are
handled by zfb 2.17's embedded Tailwind stylesheet resolver.

## Considered and kept: detector warnings are not removal instructions

| Dependency or group | Verdict and evidence |
| --- | --- |
| `preact-render-to-string` in root and `doc` | KEEP conservatively. The native zfb executable contains its Preact adapter and renderer, so an import scan cannot establish the host resolution contract. The adoption instructions still list the host declaration. Removing it has no package-count payoff while demo tests and the engine import it directly; host build verification is required before revisiting it. |
| `preact-render-to-string` in `apps/demo`, `packages/demo-ui`, and `packages/styleguide` | KEEP: direct imports in demo layout tests, story source-drift tests, and engine `catalog/component-thumb.tsx`, respectively. The engine's declaration remains a runtime dependency. |
| `mermaid` | KEEP under #700's protected scope. The old undeclared-peer rationale no longer describes the inspected zudo-doc 5.24 output: `dist/code-syntax/mermaid-init-script.js` loads pinned `https://esm.sh/mermaid@11.15.0`. Local necessity is unproven; revisit with explicit feature/build validation. |
| `minisearch` | KEEP under #700's protected scope. There is no current bare import in first-party or installed zudo-doc runtime code, and `_search-widget-script.ts` explicitly describes its built-in search. The historical undeclared-peer verdict is not fresh proof of usage. Search behavior verification is needed before a later removal. |
| `remark-cjk-friendly` | KEEP under #700's protected scope. Root `cjkFriendly` remains enabled; zudo-doc passes it to zfb's Markdown settings, and the inspected package output has no bare import. Preserve it until a later audit verifies the CJK rendering contract without it. |
| `diff`, `katex`, `zod` | KEEP in root and doc. zudo-doc's installed manifest declares these peers; its runtime imports `diff` from `dist/doc-history/index.js`, `katex` from `dist/math-block/index.js`, and `zod` from `dist/preset.js` and schema modules. Optional feature peers can still be reached by static package routes. Root/demo schema code also imports Zod directly. |
| `@tailwindcss/vite`, `tailwindcss` | KEEP existing host declarations: root and demo enable Tailwind in config and directly import its CSS. Demo-ui exposes Tailwind tokens and declares a Tailwind peer plus a matching development copy. Config/framework integration and CSS are outside a plain JavaScript import detector's view. |
| `msw` | KEEP: the contact-form demo dynamically imports `msw` and `msw/browser`. `msw.workerDirectory`, the allowed postinstall, and the documented `bundle.mainFields` setting preserve the worker and resolver contract. |
| `@takazudo/mdx-formatter` | KEEP: Lefthook and `scripts/run-b4push.sh` invoke its `mdx-formatter` binary through `pnpm exec`. |
| `@takazudo/zudo-design-token-lint` | KEEP: root `lint:tokens` resolves and runs its installed `dist/cli.js`. Knip's separate `realpath` warning is the system utility used by that script. |
| `tsup` | KEEP: the engine build script invokes it, and `tsup.config.ts` imports it. Its build callback copies routes/types and generates the package safelist. |
| `culori`, `@types/culori` | KEEP: root contrast utilities and `scripts/ui-contrast-pairs.ts` use its color conversions; the engine token-manifest tests use it as an independent color oracle. Deleting the migration script does not retire these consumers. |
| `happy-dom`, `jsdom` | KEEP: root/demo-ui Vitest config and engine test annotations select happy-dom. The root suite also runs demo-ui's explicit jsdom sanitizer tests; those tests document that happy-dom 16 does not exercise DOMPurify faithfully. These are deliberately different test environments. |
| `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` | KEEP the aligned 2.20.3 host pins. They provide the CLI, collection/config modules, router, and Markdown runtime. Demo-ui dynamically imports the WASM renderer. Required zudo-doc peers also explain declarations with no local imports. |
| `@takazudo/zudo-doc`, `@takazudo/zudo-doc-history-server`, `@takazudo/zdtp` | KEEP: preset/routes/chrome use zudo-doc; enabled root history consumes its history-server peer; the engine runtime and the host's preview token panel use zdtp, and the injected `/tokens` route needs it at build time. The engine's zfb/zudo-doc/zdtp/Preact peers remain required after #696. |
| Workspace packages, `dompurify`, CodeMirror packages, `postcss`, `@tailwindcss/node`, `@tailwindcss/oxide` | KEEP: component/story imports, the live Markdown sanitizer, code-panel editor setup, CSS parsers, and preview stylesheet compilation all have direct consumers. Publishable-package runtime dependencies were not modified. |
| Preact, TypeScript, Node types, Testing Library, Vitest, Playwright, `html-validate`, `lefthook`, `tsx` | KEEP: JSX/runtime imports, compiler configuration, test imports and setup, existing check/test commands, git hooks, and `contrast:audit` own these declarations. Each workspace retains the declarations needed by its own sources and scripts. |

The 2026-09-24 Dependabot proposals to raise `@types/node` from 22 to 26
were declined. The published packages declare Node 22 as their minimum runtime,
and the Node 22 type range keeps that compatibility visible to TypeScript. The
CI build uses Node 24; that alone does not raise the consumer runtime floor.

## Kept: remaining file warnings have explicit scope or consumers

The audit-only Knip config supplies zfb pages, stories, CSS, and package build
scripts as entrypoints. Its Playwright plugin is disabled because evaluating
`playwright.config.ts` requires production `dist`; the config and e2e files
remain real test entrypoints. The unconfigured scan's route/island warnings
were therefore not treated as dead files.

`src/config/z-index-tokens.ts` is read as text by `scripts/gen-z-index.mjs`.
The additional candidates `src/types/heading.ts`,
`src/config/frontmatter-preview-renderers.tsx`, and the three files under
`src/components/content/` were inspected but retained: they are outside the
five-file deletion scope, contain types or former customization adapters, and
produce no additional dependency removal. They are not claimed to have a
current reachable route consumer.

## Kept: duplicate versions and repeated workspace declarations are deliberate

`pnpm dedupe --check` passed on the untouched post-#696 base. The remaining
version families include esbuild 0.27.7/0.28.1 (tsup versus zudo-doc/tsx),
`@types/unist` 2/3 (different Markdown dependencies), and
`dom-accessibility-api` 0.5/0.6 (Testing Library DOM versus jest-dom).
Other retained families include Commander, Chalk, d3/layout internals,
happy-dom/jsdom support libraries, and platform-specific tool binaries.
This audit does not force incompatible upstream ranges to one version.

The same Preact, framework, test-tool, and Tailwind declarations occur in
multiple workspaces because each consumer owns its dependency contract.
The engine pairs required peer ranges with development pins so it can build
and test locally without treating the root host as its installation contract.

## Explicit non-goals: preserve behavior and use integration checks for full builds

- No dependency replacement was written. The 40-line/one-correction abandon
  rule was never approached; renderer, color, DOM, and process-tool rewrites
  are not part of this audit.
- No Knip CI gate was added. Package-injected routes, native framework modules,
  optional peers, CSS, and script callbacks make a generic gate noisy here.
  The existing checks remain the regression gates.
- Deploy workflows keep their explicitly pinned `npx wrangler@4.85.0` commands.
  No unpinned package fetch was found in the active script/hook/deploy chain.
  `TESTING.md` still shows a historical interactive formatter `dlx` example;
  the actual hook and b4push commands use the installed formatter.
- Full root/demo/doc production builds, root asset-fingerprint comparison,
  the 88-HTML-route assertion, browser checks, e2e, and foreign-install checks
  belong to release integration for this run. They were not executed by this
  child audit; no claim of unchanged root `dist` output is made here.

## Verified: frozen installation and existing checks pass

The untouched baseline and final tree both passed
`pnpm install --frozen-lockfile`, `pnpm check` (including the engine build and
346 engine tests), and `pnpm --filter @zudo-sg/doc check`. The final root unit
suite passed **135 files / 1,152 tests**. Markdown formatting and
`git diff --check` also passed.

All 123 emitted engine files retained their baseline names and content hashes.
The SHA-256 of the path-to-content-hash map remained
`5585d5cb14e9e324df1d519df2442035d17079e986a2b12d6b2441a55c32c3da`.
This covers `packages/styleguide/dist`, not the deferred root production build.
