# Dependency audit register

## Current audit — 2026-10-11, sweep #950 / maintenance #951 / React proof #952

This section supersedes the historical decisions below. The zfb migration is
already shipped by #949/#924; this sweep completes #921's remaining dependency
register obligation. Starting main: `429ac055b98c44c68ab6c0722c0b567a6024e5c8`.
Use Node 24 for CI and pnpm **11.5.2**; retain the Node 22 consumer floor,
zfb **4.3.1**, zudo-doc **6.0.0**, zdtp **0.8.6**, Vite **7.3.5** and Vitest **4.1.11**.

### Scope, ownership, and decisions

All ten original manifests were inspected: root, doc, apps/demo, demo-ui, engine,
initializer, its unit fixture, both foreign-install hosts, and the generated
initializer template. Scripts, hooks, workflows, CSS, peers, package exports and
foreign installs supplement import scanning. The new deployment-tool workspace
is an eleventh manifest with its own lock and audit. The React proof fixture
introduced by #960 is a twelfth manifest and has a separately installed and
audited graph; neither the root nor deployment audit covers it.

**Zero npm dependency removals or replacements.** Deliberate KEEP: engine Preact
for the opaque zdtp adapter; CodeMirror and Lezer for real editors; PostCSS for
CSS parsing and authored-class coverage; DOMPurify and jsdom for real sanitizer
behavior; Happy DOM for island tests; Culori and its types for independent color
checks; tsx for contrast and provenance scripts; formatters, native build tools,
MSW's browser worker, history-server and required/optional framework peers.
`docHistory: true` and `bundleZdtp: true` still have consumers even where their UI
switches are disabled. No replacement code or abandon-rule exception was needed.

Demo-ui now directly declares development PostCSS `^8.5.28`, resolving to 8.5.29.
The three workspace Happy DOM declarations pin 20.14.6, matching the verified
engine-host/template family. No unsafe evaluation defaults were enabled; the
jsdom sanitizer tests and runtime sanitizer probe remain intact.

Configuration hygiene removed only the five exact formatter `1.3.0-next.5`
release-age exceptions and apps/demo's ignored `pnpm.onlyBuiltDependencies` block.
These remove **zero packages**. Root `allowBuilds` still permits esbuild, Lefthook
and MSW. The independent deployment workspace has its own explicit native policy.

### Application audit dispositions

Fresh baseline audit: **34 advisory records: 1 critical, 15 high, 13 moderate,
5 low**. The maintained lock has **2 low, zero moderate/high/critical** records.
`pnpm audit --prod --audit-level=high` passes. These counts describe dependency
findings, not demonstrated browser exploits. Compatible transitive updates use
published parent ranges; no cross-range overrides or audit ignores were added.

| Package | Installed change | Disposition | Exact baseline advisory records |
| --- | --- | --- | --- |
| `brace-expansion` | 5.0.6 → 5.0.12 | RESOLVED | [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) (high), [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) (high), [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) (high), [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) (moderate), [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) (high), [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) (high) |
| `dompurify` | 3.4.15 → 3.4.16 | RESOLVED | [GHSA-p98j-92pf-mc4p](https://github.com/advisories/GHSA-p98j-92pf-mc4p) (low), [GHSA-6688-9rhm-gjv2](https://github.com/advisories/GHSA-6688-9rhm-gjv2) (low) |
| `esbuild` | 0.27.7 retained; separate 0.28.1 → 0.28.2 | HOLD — compatible upstream update required | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) (low) |
| `fast-uri` | 3.1.2 → 3.1.8 | RESOLVED | [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx) (high), [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) (high), [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc) (high), [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf) (high), [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp) (high), [GHSA-4c8g-83qw-93j6](https://github.com/advisories/GHSA-4c8g-83qw-93j6) (high), [GHSA-qw65-cvwx-89v3](https://github.com/advisories/GHSA-qw65-cvwx-89v3) (high), [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) (moderate) |
| `happy-dom` | 16.8.1 → 20.14.6 | RESOLVED | [GHSA-37j7-fg3j-429f](https://github.com/advisories/GHSA-37j7-fg3j-429f) (critical), [GHSA-w4gp-fjgq-3q4g](https://github.com/advisories/GHSA-w4gp-fjgq-3q4g) (high), [GHSA-6q6h-j7hj-3r64](https://github.com/advisories/GHSA-6q6h-j7hj-3r64) (high) |
| `hono` | 4.12.26 → 4.13.13 | RESOLVED | [GHSA-xgm2-5f3f-mvvc](https://github.com/advisories/GHSA-xgm2-5f3f-mvvc) (moderate), [GHSA-hvrm-45r6-mjfj](https://github.com/advisories/GHSA-hvrm-45r6-mjfj) (moderate), [GHSA-w62v-xxxg-mg59](https://github.com/advisories/GHSA-w62v-xxxg-mg59) (moderate), [GHSA-8j4g-w8fx-2239](https://github.com/advisories/GHSA-8j4g-w8fx-2239) (moderate), [GHSA-f23p-vx2j-j53r](https://github.com/advisories/GHSA-f23p-vx2j-j53r) (moderate), [GHSA-79qm-7rj5-m7r9](https://github.com/advisories/GHSA-79qm-7rj5-m7r9) (low), [GHSA-54fx-42gc-7vw4](https://github.com/advisories/GHSA-54fx-42gc-7vw4) (moderate), [GHSA-gqvv-2mrq-wpjv](https://github.com/advisories/GHSA-gqvv-2mrq-wpjv) (moderate), [GHSA-g6gw-c38x-mqfc](https://github.com/advisories/GHSA-g6gw-c38x-mqfc) (moderate), [GHSA-crvj-82cr-hjcx](https://github.com/advisories/GHSA-crvj-82cr-hjcx) (moderate), [GHSA-hxh3-vqpv-xpqv](https://github.com/advisories/GHSA-hxh3-vqpv-xpqv) (moderate) |
| `katex` | 0.16.47 retained | HOLD — compatible upstream update required | [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7) (low) |
| `smol-toml` | 1.8.0 → 1.9.1 | RESOLVED | [GHSA-r4xh-jqrq-34v2](https://github.com/advisories/GHSA-r4xh-jqrq-34v2) (moderate) |
| `source-map-js` | 1.2.1 → 1.2.2 | RESOLVED | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) (high) |

The esbuild hold is the 0.27.7 family required by Vite 7.3.5 and tsup 8.5.1
(`^0.27.0`); the patched floor is 0.28.1. The separate tsx family is patched.
Wait for a compatible Vite 7/tsup update or upstream backport, then rerun the
zudo-react transform and packed-host checks. Vite 8 is not a compatible substitute.
KaTeX's patched floor 0.18.2 falls outside zudo-doc 6.0.0's `^0.16.0` peer;
request a supported upstream peer update and verify math output before adopting it.
Both are explicit low-severity holds, not a zero-audit claim. smol-toml 1.8.1 is
not published; 1.9.1 is available, patched and inside zudo-doc's `^1.8.0` range.

### Source PR reconciliation and CodeMirror regression

#915/#918/#919 are implemented as a compatible tuple: language 6.13.1,
commands 6.11.1, state 6.7.6, view 6.43.1, highlight 1.2.3, lr 1.4.11 and one
common 1.5.3 identity. Commands requires state `^6.7.0`. At #915's exact head
`44d1215d45c349840ad8d303043405cbfff07f7e`, common 1.5.2/1.5.3 split NodeProp
identities: both allocate property 8, letting highlighting read language data as
a highlighting rule. Independent reproduction captured `tags is not iterable`
and absent TSX/CSS highlighting while the six old editor tests still passed.
Two new regression tests fail there and pass on this tuple. A real browser test
also edits and clears Live CSS, checks iframe computed styles and host isolation,
and retains console/page error assertions. No production editor workaround was added.

#916 updates retained tsx 4.23.13 → 4.23.15, replacing its esbuild 0.28.1/platform
family with 0.28.2. It does not introduce a third family. #917 updates DOMPurify
3.4.15 → 3.4.16. #920 remains the already-closed duplicate. #922's setup-node
7.1.0 pin now covers the shared action and both publish workflows, plus the new
deployment setup action. #923's download-artifact 8.0.2 pin covers all six sites;
artifact names, tar extraction, destinations and authorization conditions remain.
Source PRs stay open until their verified replacement reaches main. This register
does not itself authorize closing #908 or any incomplete parent.

#### Consumer lock compatibility follow-up: #963 remains open

The tuple above proves this repository's graph and the freshly installed packed
consumers; it does not guarantee a single Lezer identity in an existing consumer
lock. A separate foreign probe used the exact compiled editor modules with all
seven direct dependencies already at the tested versions: commands 6.11.1,
lang-css 6.3.1, lang-javascript 6.2.5, language 6.13.1, state 6.7.6,
view 6.43.1 and highlight 1.2.3. Its deliberately seeded, valid lock retained
highlight → common 1.5.2 while the other parser paths used common 1.5.3,
matching the historical split in #915. Frozen and normal pnpm 11.5.2 installs
preserved it. All four TSX/CSS editable/read-only probes logged
`tags is not iterable` and lost highlighting, even though construction and edits
did not throw. This is an isolated compiled-editor probe with Happy DOM, not a
complete packed-host browser proof.

In that consumer, `pnpm dedupe --check` detected the split;
`pnpm dedupe --ignore-scripts`
unified common at 1.5.3, after which the same four probes highlighted correctly
without plugin errors. Baseline `429ac055` already allowed every direct version
in this graph and has the same editor implementation. This is a pre-existing
consumer-lock constraint, not a newly introduced React-preview regression.

Raising the remaining direct floors, adding a direct common dependency, or
checking only the root lock does not establish a universal fix. Inspected
published metadata still permits common 1.5.2: highlight 1.2.5 uses `^1.3.0`,
lr 1.4.11 uses `^1.0.0`, language 6.13.1 uses `^1.5.0`, and the latest inspected
CSS/JavaScript parsers 1.3.9/1.5.6 use `^1.2.0`. No speculative pin, override,
or editor replacement was added. Affected consumers should deduplicate their
own graph and verify actual source highlighting and Live CSS editing. Keep
#963 open for retained-lock packed-host coverage and upstream shared-identity
guidance; fresh-install success alone does not close it.

### Counts separated by cause

| Phase | Packages / snapshots | Meaning |
| --- | --- | --- |
| Refreshed baseline | 433 / 433, six importers | Frozen install and nonmutating dedupe check pass; no baseline dedupe saving established |
| Security/ownership commit `613ce8f` | 439 / 439 | Net +4 Happy DOM support records; +2 temporary PostCSS/nanoid duplicates after the ownership declaration |
| npm reconciliation `68dc86b` | 438 / 438 | +1 CodeMirror streamparser; dedupe removes the two superseded PostCSS/nanoid records; version-family replacements otherwise net zero |
| Package removals | 0 | No runtime dependency deleted or rewritten |
| Deployment tooling, separate lock | 91 / 91, one importer | New dev/operations cost, not application reduction |
| React consumer proof, separate installed lock | 182 / 182, one importer | New private fixture cost; no React dependency added to the engine, root workspace or default initializer |

The maintained application graph is five records larger than baseline. At
maintenance integration, root/demo builds emit 89/74 pages; the root HTML
inventory is exactly the same 88 routes. Root emitted files remain 378 and
standalone preview CSS is byte-identical in that scoped maintenance comparison.
HTML asset references change with the upgraded bundles;
no claim of byte-identical application output is made for dependency upgrades.
The real authored-class generator still reports zfb 4.3.1, 343 candidates:
310 resolved utilities, 31 ordinary classes and two markers. Only its declared
input provenance changes; its expected hash was never manually repaired.

### Independent deployment graph

`tools/deploy` starts from the requested Wrangler 4.85.0 proposal, whose isolated
audit found **10 high, 11 moderate, 6 low** findings across 89 records. It is
therefore replaced with tested same-major **4.149.0**, pinned with a committed
lock. Both full and production audits now find **zero** advisories across 91
records (31 dependencies and 60 optional platform entries). Frozen install and
version checks pass. Native approvals cover esbuild, workerd and Sharp; fsevents
is explicitly denied. Initial 4.85.0 installation also exposed Sharp's required
build-policy classification; the final strict install succeeds.

| Package in rejected 4.85.0 graph | Final disposition | Status | Exact initial advisory records |
| --- | --- | --- | --- |
| `esbuild` | Resolved in the locked Wrangler 4.149.0 graph | RESOLVED | [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) (low) |
| `sharp` | Resolved in the locked Wrangler 4.149.0 graph | RESOLVED | [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) (high), [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) (high), [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) (high) |
| `undici` | Resolved in the locked Wrangler 4.149.0 graph | RESOLVED | [GHSA-vmh5-mc38-953g](https://github.com/advisories/GHSA-vmh5-mc38-953g) (high), [GHSA-p88m-4jfj-68fv](https://github.com/advisories/GHSA-p88m-4jfj-68fv) (moderate), [GHSA-vxpw-j846-p89q](https://github.com/advisories/GHSA-vxpw-j846-p89q) (high), [GHSA-hm92-r4w5-c3mj](https://github.com/advisories/GHSA-hm92-r4w5-c3mj) (high), [GHSA-g8m3-5g58-fq7m](https://github.com/advisories/GHSA-g8m3-5g58-fq7m) (low), [GHSA-pr7r-676h-xcf6](https://github.com/advisories/GHSA-pr7r-676h-xcf6) (moderate), [GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524) (moderate), [GHSA-4cwx-7wf7-3272](https://github.com/advisories/GHSA-4cwx-7wf7-3272) (high), [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5) (moderate), [GHSA-jr45-8vmc-qm54](https://github.com/advisories/GHSA-jr45-8vmc-qm54) (moderate), [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm) (moderate), [GHSA-35p6-xmwp-9g52](https://github.com/advisories/GHSA-35p6-xmwp-9g52) (low), [GHSA-pmjh-fq2x-6v4x](https://github.com/advisories/GHSA-pmjh-fq2x-6v4x) (moderate), [GHSA-r53p-7pc4-xj5r](https://github.com/advisories/GHSA-r53p-7pc4-xj5r) (low), [GHSA-rfgv-xxqx-mfg5](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5) (high), [GHSA-3xpg-4rpp-hhhm](https://github.com/advisories/GHSA-3xpg-4rpp-hhhm) (moderate), [GHSA-2jfj-6hjv-fm6j](https://github.com/advisories/GHSA-2jfj-6hjv-fm6j) (moderate), [GHSA-2gqq-gqf2-x968](https://github.com/advisories/GHSA-2gqq-gqf2-x968) (low), [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3) (high), [GHSA-8436-99hf-9mmv](https://github.com/advisories/GHSA-8436-99hf-9mmv) (low), [GHSA-rx4f-c7p8-82vq](https://github.com/advisories/GHSA-rx4f-c7p8-82vq) (moderate) |
| `ws` | Resolved in the locked Wrangler 4.149.0 graph | RESOLVED | [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx) (moderate), [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) (high) |

The local-binary wrapper resolves from this isolated install and fixes its cwd
to the repository root. Root/demo dry runs, invocation from another cwd, and a
missing-install failure check pass. No fallback package download, publication or
real deployment was used for validation. See DEPLOY.md for all three site dry
runs. Dependabot covers `/tools/deploy`; `doc/` belongs to the root shared lock,
so no overlapping independent update entry is added. Standalone consumer hosts
are maintained by their packed verifiers; generated templates are synchronized
from engine-host, not independently updated by Dependabot.

### Independent React consumer graph

`fixtures/react-descriptor-host` pins React and ReactDOM **19.3.0**, matching
React types **19.3.0**, Monaco **0.57.0**, DOMPurify **3.4.16**, esbuild **0.28.2**
and TypeScript **5.9.3**. Its zfb 4.3.1, zudo-doc 6.0.0 and zdtp 0.8.6 contracts
match the application. React belongs only to the host-owned external preview;
the catalog and engine remain on zudo-react.

The actual foreign install has **182 package/snapshot records**, one importer,
and **one low** advisory, KaTeX 0.16.47 / GHSA-238p-pmpm-9mq7, under the same
zudo-doc peer constraint described above. There are **zero moderate, high or
critical** findings; its separate production high-severity audit passes. The
audit metadata divides the graph into 145 dependencies, four development
dependencies and 33 optional platform entries. These records are a separate
proof cost, not application dependency removals or additions.

Monaco includes both a package dependency and a vendored DOMPurify 3.4.15 ESM
copy. The fixture's scoped `monaco-editor>dompurify: 3.4.16` override handles the
installed package, while its exact esbuild resolver substitutes the patched
3.4.16 ESM module for Monaco's vendored import. The emitted preview metafile
must contain the patched module and exclude the vendored file; an audit of
package metadata alone cannot prove that browser fix. This disposition addresses
GHSA-p98j-92pf-mc4p and GHSA-6688-9rhm-gjv2 without changing engine dependencies.

The documented `pnpm verify:react-descriptor-host-install` command ensures the
engine build is current before packing. The verifier installs that artifact
outside the workspace, records installed versions and audits that actual graph. As with the
existing packed hosts, it generates a fresh foreign lock instead of committing
a lock tied to a changing local tarball integrity. Direct fixture versions are
pinned; transitive resolutions are audited on each verification run. `--keep`
retains the installed lock and audit evidence for diagnosis. This policy differs
from `tools/deploy`, whose committed lock is always installed frozen. Dependabot
covers the React fixture manifest; its build outputs and captures stay local.

### Verification evidence and integration gate

Newly executed baseline at `429ac055`: frozen install, `pnpm dedupe --check`,
root/demo builds, and 168 unit files / 1,448 tests pass. Knip 6.41.0 initially
could not load Playwright until both baseline builds existed; after both builds
it reports only the live token-lint declaration and the system `realpath` binary.
Those detector warnings are KEEP, not removal instructions.

Happy DOM 20.14.6 passes all 1,448 tests. M1's final generated graph passes 79
focused tests and frozen install. M2 passes 62 dependency/editor/sanitizer tests,
the remaining editor contract tests, all 13 preview-token-panel browser cases,
and the additional real Live CSS browser test. Scoped root/demo builds pass.
Independent review approved M1/M2, with its requested browser gap addressed in
`50e6fd1`. Final maintenance-head integration commands, packed consumer results,
doc dry run and current-head CI/review evidence are recorded on the implementation
PR before any merge. Historical migration evidence below is not relabeled as a
new test run. #921 closes only after the completed register reaches main.

## Historical audits

The following dated records describe their original revisions, including obsolete
Tailwind and Preact-host decisions. They are retained as history, not current guidance.

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
| `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` | KEEP the aligned 2.21.1 host pins. They provide the CLI, collection/config modules, router, and Markdown runtime. Demo-ui dynamically imports the WASM renderer. Required zudo-doc peers also explain declarations with no local imports. |
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
