# Dependency audit register

## ZFB 4.5.2 adopted; doc 7 and panel remedy held — 2026-10-15, #1009

Continued the inspected maintenance commit
`84204c873424365cd6d8f74ce3aa0f37cf3c05e4` in an isolated local checkout;
main remains `38be876104e4362379bdda112df0cb0020e83498`. The user subsequently
authorized commit, push, PR creation and its existing automatic preview
deployment. Release, publication and production integration remain excluded.
Public maintenance skill/resolver revision:
`Takazudo/claude-settings@27b340cdcb110ef699dc7dc8c175e68839eb7187`.
Verification uses Node 24.19.0 and repository-pinned pnpm 11.5.2.

The resolver scanned all 12 manifests: 34 candidate bumps, 10 current rows,
five non-registry skips, no tags/errors/channel warnings. Applied the 25
ZFB-family rows, preserving exact/caret styles, stable channels, local engine
versions, workspace links and fixture tarball contracts. Nine doc/history
rows remain deliberately held; the final scan has 35 current rows.

| Package | Maintenance input | Selected | Published latest |
| --- | --- | --- | --- |
| ZFB / runtime / MD WASM | 4.5.0 | 4.5.2 | 4.5.2 |
| zudo-doc / history-server | 6.2.0 | 6.2.0 | 7.0.0 |
| zdtp | 0.8.6 | 0.8.6 | 0.8.6 |
| mdx-formatter / design-token-lint | 1.3.0 / 2.1.0 | unchanged | unchanged |

### Published artifact assessment and preserved contracts

Compared old/new npm tarballs, exports, engines and peers. Verified ZFB release
refs `dcf1e9235882e365a63cee9d551c58c9f0c19107` and
`57f625a2e3fc4bf69eb526c7bb8ef2103d4669d6`; family npm metadata has no
`gitHead`. Source release notes and published binaries/WASM describe live
`public/assets/` serving, ready-banner ordering, compact MDX table fixes,
and symlink-aware Wind diagnostics. ZFB/runtime JavaScript payloads are
unchanged apart from package metadata; public exports and Node 22 support
remain. Runtime's exact ZFB peer moves with the family. All four published
WASM sizes/SHA-256 digests match `shipped-artifacts.json`.

Published zudo-doc 7.0.0 explicitly requires Node `>=24 <25` and KaTeX
`^0.18.2 || ^0.19.0`, whereas this task preserves Node 22 consumers and
existing third-party contracts. Holding doc/history at 6.2.0 is intentional;
this is not an all-latest claim. Adoption of 7 needs an explicitly scoped
runtime/peer migration. Exports are unchanged. The published 7.0.0 doc base
snapshot and all 29 create-zudo-doc templates are byte-identical to 6.2.0.
Reviewed all three provenance entries without falsely advancing their pins;
see `ZUDO_DEPS_PINS.md`. Local TS7/TS6 aliases, TS5.9 consumers, scaffold
customizations, optional features and disabled locales remain intact.

Only the shared `pnpm-lock.yaml` changes. Deployment-tool and negative-control
graphs are unchanged. First-party peer floors and exact release-age exemptions
follow 4.5.2. After a forced engine build, the starter was regenerated from
engine-host and installed ZFB metadata. Wind evidence was regenerated twice:
343 candidates/explanations are unchanged; only compiler identity and its
configuration fingerprint change. The compiler-version assertion advances
without reducing coverage. Preact stays owned by the widget/engine adapter;
the packed module proof confirms one Preact resolution.

### Published SG consumers confirm the Doc 7 hold

Consolidated the published-consumer evidence in
[#1009's follow-up](https://github.com/Takazudo/zudo-sg/issues/1009#issuecomment-6196879481).
Registry recheck confirms published `@takazudo/zudo-sg@0.5.4` still requires
zudo-doc `^6.1.1`. Two isolated consumers use the real engine-host manifest
with its tarball reference replaced by published SG 0.5.4. On Node 24.19.0,
`pnpm install --strict-peer-dependencies --ignore-scripts` accepts ZFB 4.5.2,
Doc 6.2.0 and KaTeX 0.16.x. With Doc 7.0.0 and its compatible KaTeX 0.19.x,
the same command fails specifically on SG's Doc `^6.1.1` peer. Lifecycle
scripts were intentionally disabled for this resolution proof; it is not a
Doc 7 build/browser pass. This agrees with the separately reported successful
Pinsel upgrade to ZFB 4.5.2 / Doc 6.2.0.

The appropriate peer in this change remains `^6.2.0`, matching the validated
root pin and ADR §13. Widening it to `^6.2.0 || ^7.0.0` would contradict the
existing single-floor contract; replacing it with `^7.0.0` would require moving
the root/fixtures and dropping their preserved Node 22 support. Neither change
is justified by a successful Doc 6 consumer or byte-identical templates. No
peer gate or runtime contract is weakened to make latest install.

A future Doc 7 adoption needs a scoped Node 24/KaTeX migration, actual packed
Doc 7 host/build/browser verification and a compatible SG peer change. A
**subsequent published SG release** carrying that verified peer is required
before downstream registry consumers such as Pinsel can adopt Doc 7. Merging
source alone cannot change SG 0.5.4's published peer. This PR does not bump
release versions, tag or publish, and does not claim Doc 7 compatibility.

### Both original browser problems remain

Registry metadata still reports zdtp 0.8.6 (modified
2026-10-10T07:39:54.993Z). Upstream #1046 is closed after source integration,
but that is not a published remedy. Against the actual installed package,
the standalone deterministic UI-Close arm and the built host's persisted-state
reload/Open/UI-Close arm both reproduce populated at 248 ms -> empty with
stored open intent -> reopened after 250 ms recovery. Public `handle.close()`
stays closed; the genuine dead-open-root control recovers. No package-source
patch, runtime substitution, recovery delay change or consumer workaround was
introduced.

The unchanged packed module verifier again fails at seedless dev Counter with
a console 404 after its static/scenario browser stages pass. The identical
verifier on untouched main reproduces the same failure. This is the previously
reported implicit-favicon baseline; neither update claims to fix it. The
verifier stops there, so its later dev CSS-edit stages are not passed.

Pinned Playwright Chromium 1248 / Chrome 156.0.8078.4 download returns HTTP
403 `Domain forbidden`, including escalation. Browser diagnostics use system
Chromium 154.0.8037.57 explicitly. They do not replace the pinned-browser CI
gate or prove the timing race fixed. Non-TTY manual smoke is not a pass.

### Verification and hold decision

Clean/frozen shared-workspace install and generated-starter frozen install pass.
Peer floors, workspace/doc type checks, codegen, template consistency, package
shape/Wind checks, token lint, formatting, root/demo/doc builds and links,
and root/doc HTML validation pass. Units: 177 root files / 1,643 tests;
56 engine files / 760 tests; two initializer files / 14 tests.

`pnpm b4push` fails only its pinned-browser step: all 83 cases stop at missing
Chromium launch, not assertion results. The non-interactive manual step skips.
Two separate unchanged full selections on system Chromium pass 83/83:
default two workers, then the historical five-worker load with zero retries.
These passing schedules do not supersede the deterministic reopened-panel
failure or the earlier 82/1 result. Doc appearance, real sidebar filtering and
clearing, collapse/expand, navigation, Back/Forward and reload checks have zero
console/page/request errors.

Packed vanilla descriptor, React descriptor (both bases, real workers and
lifecycle), initializer and retained-Lezer diagnostic pass. The latter proves
reproduction and consumer dedupe recovery, not a remedy for #963. Module-mode
verification fails at the baseline seedless Counter 404 on both candidate and
untouched main. No test, timeout, retry policy or error filter was weakened.

HOLD: npm must publish the panel remedy before #1046 can be considered fixed
for this consumer. The seedless Counter baseline and authoritative pinned-browser
checks remain unresolved. Doc 7 is a separate Node 24/KaTeX migration decision.
A draft PR is authorized for review; no current-head CI pass or merge approval
is claimed. Refreshed workflows deploy previews on main-targeting PR
opened/synchronize/reopened events (including drafts), now explicitly approved.
All three production sites deploy on main pushes; production integration, tags,
releases and package publication remain outside this approval.
#1009 stays open; #963/#1001/#997 are unchanged.

## zudo-doc 6.2.0 / zfb 4.5.0 — 2026-10-14, #1009

Based on main `38be876104e4362379bdda112df0cb0020e83498`, using Node
**24.19.0** and repository-pinned pnpm **11.5.2**. The public maintenance
procedure/resolver was retrieved together at `Takazudo/claude-settings`
`f957ad2c293c297bdd8cfefd244f9c5ecf8ca4cb` and invoked from this checkout.
The read-only plan scanned all **12** real manifests: **34 bumps**, **10
up-to-date**, **5 non-registry skips**, **0 tags/errors/channel warnings**.
The initial npm lookups failed because the default cache path was unavailable;
using a session scratch cache restored normal registry resolution.

| Package | Actual installed old → selected published stable |
| --- | --- |
| `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` | **4.4.0 → 4.5.0** |
| `@takazudo/zudo-doc`, `@takazudo/zudo-doc-history-server` | **6.1.1 → 6.2.0** |
| `create-zudo-doc` reference | **6.1.1 → 6.2.0** |
| `@takazudo/zdtp` | **0.8.6**, unchanged |
| `@takazudo/mdx-formatter`, `@takazudo/zudo-design-token-lint` | **1.3.0 / 2.1.0**, unchanged |

Exact/caret styles and stable channels are preserved. The five skips are the
root/demo-ui `workspace:*` engine dependencies and the three fixture tarball
references. The generated engine pin remains derived from local engine
**0.5.4**; initializer **0.2.3** is unchanged. Engine/demo-ui peer floors are
exactly the corresponding root pin with a caret. Optional peer metadata and
the peer-floor validator are unchanged. History-server remains a root direct
consumer only; no optional feature or dependency was added to doc.

### Published impact and scaffold reconciliation

Version-specific npm metadata and old/new published tarballs were inspected.
ZFB-family npm metadata has no gitHead; matching release tags verify commits
`29377d1c0bfd607dea6d654557e46ff7bf536b2e` (4.4.0) and
`dcf1e9235882e365a63cee9d551c58c9f0c19107` (4.5.0). Doc, history-server
and initializer release tags verify `e37130018ee2ca0bf71e39a639e328a9621d4659`
and `6542b8300f4a554247563a3bac53e415a63ded51`; create-zudo-doc's npm
gitHead agrees. Tags establish source references, not byte equality between
source trees and published build output. No unpublished artifacts were used.

ZFB adds opt-in CSS compiler and ErrorBoundary APIs and corrects sibling radio
reset behavior. Existing exports and Node 22 support remain. Runtime fixes
same-path query Back/Forward ownership without a public API change. MD WASM
has no package-specific code/API change; its release-version bytes change.
zudo-doc raises all ZFB-family peers to `^4.5.0`, removes baseUrl, fixes
sidebar scroll/history and appearance behavior, adds optional scopeRoot, and
updates its Mermaid CDN URL. History-server's executable surface is unchanged.
The existing CSS CLI integration and JSX/runtime imports stay in place.

All **29** create-zudo-doc templates were compared. Only base tsconfig changes:
remove baseUrl and make the alias explicitly relative. Owned root/doc/React
snapshots already do this; options and boundaries are unchanged, with current
provenance comments. The new base blob is
`f052aebac2b57fd447455490f6d2122a0ba372e4`. The three pins-file entries were
reconciled: setup/skill templates are byte-identical; customized guidance,
doc-wisdom naming, disabled locales, safe symlinks, site settings, validators,
deployment configuration, deletion ledger and strict CSS imports remain.
MCP-only scaffold adapter/Wrangler changes do not apply. Compiler aliases stay
TypeScript 7 native / TypeScript 6 API; engine-host, descriptor-host and the
starter retain TypeScript 5.9.

Only the shared **pnpm-lock.yaml** changed (**471** resolution records).
Deployment tooling and retained negative controls are unchanged. Root/fixture
version-specific slugify/native exemptions follow 4.5.0. The starter generator
now includes installed ZFB's first-party regular dependencies, fixing its
missing slugify exemption; it retains exact-version validation and excludes
third-party dependencies. The foreign initializer proof validates all **12**
exact exemptions. The template was regenerated from engine-host, never hand-edited.
Forced engine build and actual Wind refresh retain **343** candidates and every
explanation; only compiler identity/provenance changes. Repeated refresh is
byte-identical. The coverage assertion follows the actual 4.5.0 compiler.

### Actual checks and remaining delivery gates

Baseline and final frozen installs pass. A clean checkout with the final
manifests/shared lock also installs frozen. Generated starter clean/frozen
installation passes. Root/doc types, peer floors, codegen, Wind/package shape,
template sync, token lint, format, root/demo/doc builds and links, and root HTML
validation pass. Final units: **177 files / 1,643 tests**; engine check:
**56 files / 760 tests**; initializer: **2 files / 14 tests**.

Packed descriptor, React descriptor (both bases, real workers/lifecycle),
initializer and retained-Lezer diagnostic pass. The latter still proves
reproduction/recovery, not a package-side fix for #963. Module-mode proof passes
static scenarios and panel/browser checks but fails its seedless dev Counter
probe on an implicit favicon 404 with system Chromium. The same command on
untouched main reproduces the identical failure. No assertion, error filter or fixture
favicon workaround was added.

Pinned Chromium download is blocked by destination policy, including escalation.
Local browser evidence uses system Chromium **154.0.8037.57**, with unchanged
suite assertions and no retries. The updated full suite reports **82 passed /
1 failed**: the token-dashboard persisted preview-panel test finds the panel
still visible after Close following reload. The exact case passes in isolation
on both base and updated code; untouched main's full suite passes **83/83**.
The initial report left the cause unresolved; follow-up diagnosis below
establishes an existing upstream race. The current-head browser gate remains
failed.
The first b4push also caught the obsolete compiler-version assertion, now fixed;
its original browser launch failures and non-TTY manual-smoke skip are not
browser passes. Required pinned-browser CI and the unfixed close failure
remain delivery gates. #963, #1001 and #997 stay outside this task.

### Close failure diagnosis — 2026-10-14 follow-up

The original full-run trace is retained. UI Close empties the panel root, then
it repopulates about 40 ms later; this was a reopen, not a missed click.
Matched instrumentation of 12 ordinary reload/edit/close sequences per tuple
did not reproduce the narrow timing window, so those passes are not used to
replace the failed full-suite result.

A standalone app installed published `@takazudo/zdtp@0.8.6` and
`preact@10.29.8`, bundled with esbuild 0.28.2, reproduces without ZFB,
zudo-doc or consumer code. A natural-time Close at 248 ms after Open
reproduced; clock-controlled scheduling reproduces the same transition
deterministically. At 248 ms UI Close changes children from 1 to 0 while
`-open` / `:visible` still contain `1`. The 250 ms open-recovery timer
interprets that intentional empty root as dead and remounts from stale stored
intent before the passive persistence effect clears it. The final state is
children 1 / open 1 / visible 1. Public `handle.close()` is the control: it
cancels recovery and clears intent synchronously, and remains 0 / null / 0.
No dependency source or Preact implementation was patched.

The same clock-controlled persisted-state reload/Open/UI-Close sequence
reproduces on both main's zfb 4.4.0/doc 6.1.1 tuple and the candidate's
4.5.0/6.2.0 tuple. The unchanged zdtp 0.8.6 dependency owns the defect; the
83/83 baseline full run simply missed its timing window. The exact natural
wall-time window depends on frame/effect scheduling.

Independent read-only review confirmed the diagnosis and control. After
duplicate/state checks against closed upstream #986, #1000 and #159, the
distinct race was reported as
[Takazudo/zudo-design-token-panel#1046](https://github.com/Takazudo/zudo-design-token-panel/issues/1046)
with the minimal public app, deterministic browser sequence, source permalinks
at release tag `183daa8edd4c460126763e9a7b6a45a6c7684e93`, and state
evidence. It remains open. No consumer workaround, speculative override,
assertion relaxation or passing full-suite retry was introduced. Browser
parity remains held for a published upstream remedy and unchanged verification.

Focused browser checks on root and doc pass appearance selection, sidebar
filtering, collapse/Restore, soft navigation, Back/Forward and reload with zero
console/page/request failures. A separate scope probe confirms Broaden reaches
the same forest as baseline.

Independent read-only review approved the dependency/contracts and the starter
fix/provenance. PR creation and merge remain held: same-repository PRs to main
(including drafts) automatically deploy previews, and merging deploys all three
production sites. Explicit deployment authorization and actual current-head CI,
required approvals and policy are still required. No PR CI pass is claimed.

## zfb 4.4.0 — 2026-10-13

Selected published tuple, rechecked against npm latest on 2026-10-13. The only
registry movement is the zfb family **4.3.3 → 4.4.0**. `@takazudo/zudo-doc`,
`@takazudo/zudo-doc-history-server`, `@takazudo/zdtp`, `@takazudo/mdx-formatter`,
`@takazudo/zudo-design-token-lint`, published `@takazudo/zudo-sg`, and
`create-zudo-doc` stay at the versions recorded below. No newer stable
correction was present. The resolver reported 25 bumps, 19 up-to-date rows,
5 non-registry skips (`workspace:*` and fixture `file:.tarball`), and 0 errors
across 12 manifests. That scan matches the checkout inventory: no nested git
checkout and no symlinked package manifest.

| Package | Installed |
| --- | --- |
| `@takazudo/zudo-doc` | **6.1.1** |
| `@takazudo/zudo-doc-history-server` | **6.1.1** (root only; `doc/` does not consume it) |
| `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` | **4.4.0** |
| `@takazudo/zdtp` | **0.8.6** |

Engine and demo-ui peer floors for zfb are `^4.4.0`. zudo-doc stays `^6.1.1`
and zdtp stays `^0.8.6`. Direct copies stay exact `4.4.0`. Published
`zfb-runtime@4.4.0` peers exact `zfb@4.4.0`. Published zudo-doc 6.1.1 still
peers zfb `^4.3.3`, which accepts 4.4.0. The workspace zod range is unchanged.
`tools/deploy` has no first-party dependency and its lockfile is unchanged.
Engine workspace references and fixture `file:.tarball` references are unchanged.
The starter still depends on `@takazudo/zudo-sg ^0.5.3`; this round does not
release the engine or the initializer.

Installed `@takazudo/zfb@4.4.0` depends on `@takazudo/zfb-slugify@4.4.0` and
optional native packages `@takazudo/zfb-darwin-arm64`,
`@takazudo/zfb-darwin-x64`, `@takazudo/zfb-linux-arm64-gnu`,
`@takazudo/zfb-linux-x64-gnu`, and `@takazudo/zfb-win32-x64-msvc`, each
`4.4.0`. Root release-age exclusions stay name-scoped except version-specific
slugify `4.4.0`. The three foreign fixtures keep version-specific native and
slugify exclusions, now at `4.4.0`. The React fixture keeps
`monaco-editor>dompurify: 3.4.16`.

`pnpm install` on pnpm **11.5.2** rewrote the shared root lockfile only.
Resolved `@takazudo/zfb*@4.3.3` entries are gone. The lock still records
zudo-doc 6.1.1's published peer range `^4.3.3`. `doc/` has no independent
lockfile.

Upstream release `v4.4.0` is commit `29377d1c0bfd607dea6d654557e46ff7bf536b2e`
(previous `v4.3.3` commit `badb68360ed8d28e807f0d3770709da9e9b49529`).
Runtime impact adopted here is the client-router fragment history fix:
A → browser-created A#fragment → soft navigation to B → Back restores A and
the fragment, and Forward is reported as `forward`. YAML frontmatter changes
are limited to explicit-tag handling and alias depth; no previously accepted
frontmatter changes value. md-wasm has no JavaScript export change. The root,
demo, and doc content builds are the check for those parser differences.

`pnpm build:styleguide` was forced after install. The real Wind refresh at
zfb **4.4.0** kept **343** candidates, the candidate-set hash, and the
explanation payload. `compilerVersion` is `4.4.0`. `windConfigSha256` changed
because compiler identity is part of the provenance document
(`fbb4e3253fc55c6b393f46f71082570a1a2dd9a49b20fd95f1246c8904739707` →
`c2e67397f4e5dd8123a97ef4a6d6ffed25b8241f09a4fd906a14123ec7087c2f`). A second
refresh wrote identical bytes.

Installed `@takazudo/zudo-doc@6.1.1` `tsconfig.base.json` git blob is still
`6c863a3ae09e10c187742b8f1461f061ce789adb` and still contains `baseUrl`.
Owned TypeScript snapshots were not changed. The three `create-zudo-doc`
pin entries stay at published 6.1.1; no scaffold resync was required.

## zudo-doc 6.1.1 / zfb 4.3.3 — 2026-10-13, #1000

Selected published tuple, rechecked against npm latest on 2026-10-13. No newer
stable correction was present. `@takazudo/zdtp` stays **0.8.6**.

| Package | Installed |
| --- | --- |
| `@takazudo/zudo-doc` | **6.1.1** |
| `@takazudo/zudo-doc-history-server` | **6.1.1** (root only; `doc/` does not consume it) |
| `@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` | **4.3.3** |
| `@takazudo/zdtp` | **0.8.6** |

Engine peer floors are zfb `^4.3.3`, zudo-doc `^6.1.1`, zdtp `^0.8.6`.
First-party peer floors follow the newest published release at every bump
round (ADR §13, 2026-10-13 amendment). The fixture install line uses doc
`^6.1.1` and zfb `^4.3.3`, matching the exact fixture pins.
`@zudo-sg/demo-ui` peers zfb `^4.3.3` and pins md-wasm and its zfb
devDependency to 4.3.3. Published zudo-doc 6.1.1 peers zfb `^4.3.3` and
zod `^4.3.6`; the workspace zod range `^4.6.5` already satisfies that peer. `tools/deploy` is unchanged.

`pnpm install` on pnpm **11.5.2** replaced seven lock entries and removed
seven. The lock contains no `@takazudo/zfb*@4.3.1` specifier.
`@takazudo/zfb-slugify` resolved at **4.3.3**. Root release-age exclusions
stay name-scoped except version-specific slugify `4.3.3`. Fixture native and
slugify exclusions are version-specific at `4.3.3`. The React fixture still
has no committed lock.

Installed `@takazudo/zudo-doc@6.1.1` `tsconfig.base.json` git blob is
`6c863a3ae09e10c187742b8f1461f061ce789adb`, the same blob as 6.0.0, and it
still contains `baseUrl`. Owned root, doc, and React-fixture configs were
not changed except for that reconciliation note.

`pnpm build:styleguide` was forced after install. The real Wind refresh at
zfb **4.3.3** kept **343** candidates, the candidate-set hash, and the
explanation payload. `compilerVersion` is `4.3.3`. `windConfigSha256` changed
because compiler identity is part of the provenance document. A second
refresh wrote identical bytes.

## TypeScript compiler coexistence — 2026-10-12, #990

Implementation is on `maintenance/typescript-990`, based on main
`65268a5df5b2c406c3579cde32b0b9ae71b313fc` (the #992 merge). This replaces
the plain TypeScript 7 bumps in [#982](https://github.com/Takazudo/zudo-sg/pull/982)
and [#988](https://github.com/Takazudo/zudo-sg/pull/988). Those PRs stay open
until this replacement is on main. [#963](https://github.com/Takazudo/zudo-sg/issues/963)
stays open: the migration does not change the retained-lock remedy.

### Compiler ownership

The six shared-workspace importers declare
`"typescript": "npm:@typescript/typescript6@^6.0.2"` and
`"@typescript/native": "npm:typescript@^7.0.2"`.
`fixtures/react-descriptor-host` uses the same aliases with exact versions
`6.0.2` and `7.0.2`, and still has no committed lockfile.
`fixtures/engine-host`, `fixtures/descriptor-host`, and the generated
default consumer stay on TypeScript `^5.9.0`.

Measured on Node **24.13.0** and pnpm **11.5.2**. For the repository root,
`apps/demo`, `doc`, `packages/create-zudo-sg`, `packages/demo-ui`, and
`packages/styleguide`:

- `node_modules/.bin/tsc` execs `@typescript/native/bin/tsc` from
  `typescript@7.0.2` and prints **Version 7.0.2**.
- `require("typescript")` resolves to `@typescript/typescript6@6.0.2`.
  `ts.version` is **6.0.3** because that package depends on
  `@typescript/old` (`npm:typescript@^6`), which this lock resolves as
  `typescript@6.0.3`. `createSourceFile` is a function.
- `@typescript/native/package.json` has name `typescript` and version
  **7.0.2**.

Native `tsc` is the direct alias. The 6.0.3 package is the compiler API,
not a fallback for `tsc`.

### Shared-lock delta

`pnpm install` regenerated the shared lock from the alias manifests.
`pnpm dedupe --check` then resolved **471** and passed.

Package and snapshot records: **449 → 471** (**+22**). Twenty-three
resolution keys were added and `typescript@5.9.3` was removed:

- `typescript@7.0.2`, the native compiler
- `@typescript/typescript6@6.0.2`, the `typescript` import
- `typescript@6.0.3`, the API package's `@typescript/old` dependency
- twenty optional `@typescript/typescript-<platform>@7.0.2` packages

No other package key was added or removed. Peer keys that named
`typescript@5.9.3` (Vitest, MSW, tsup, html-validate, jest-dom) now name
`@typescript/typescript6@6.0.2`.

### Audit after the shared-lock update

Fresh root `pnpm audit`: **2 low, zero moderate/high/critical**
([GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)
esbuild, [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7)
KaTeX). Audit metadata: **139** dependencies, **298** dev dependencies,
**134** optional dependencies, **471** total. `pnpm audit --prod
--audit-level=high` passed with the one production low. `pnpm audit
--audit-level=high` passed with both lows. No override or audit ignore was
added.

| Package | Installed | Disposition |
| --- | --- | --- |
| typescript native | **7.0.2** | KEEP. Owns each importer's `node_modules/.bin/tsc`. |
| typescript API | `@typescript/typescript6` **6.0.2**, resolved API **6.0.3** | KEEP. Live `import "typescript"` / `require("typescript")` consumers. |
| esbuild | **0.27.7** retained; tsx family **0.28.2** retained | HOLD, unchanged from #991. |
| katex | **0.16.47** retained | HOLD, unchanged from #991. |
| Node types | **22.20.5** | KEEP on the Node 22 line. |
| TypeScript 5.9 consumers | `^5.9.0` in the engine-host, descriptor-host, and generated template | KEEP outside this lock. The initializer's compiler is not the compiler a generated project installs. |

### Wind provenance

`pnpm exec tsx packages/demo-ui/scripts/refresh-authored-class-coverage.ts`
ran the real `zfb wind explain` compiler at zfb **4.3.1**. The candidate
set, candidate hash, and all **343** explanations are unchanged.
`candidateSetSha256` remains
`478478942a02c3aded0a7136427019391d5362c1808c095091ccbb46f33cfd2a`.
`windConfigSha256` changed from
`f578e57532ee8ededa741cc8c3c62e57cadad9d348f7593e46874b1ac82f7feb` to
`4253392b8fe9354132d2ceee052af79f8bc7c5674a48cbf11cff12206bab70fd`
because the generator hashes the entire root lockfile. The digest was not
written by hand.

### Independent React graph

The fixture was copied outside the workspace, packed against engine
**0.5.1**, and installed with pnpm **11.5.2** on Node **24.13.0**. No
fixture lockfile is committed. The temporary consumer lock has **204**
snapshot records, versus **182** on the #991 TypeScript 5.9.3 graph. The
added records are the same coexistence closure: `typescript@7.0.2`,
`@typescript/typescript6@6.0.2`, `typescript@6.0.3`, and the twenty
optional native platform packages. Exact alias resolution is
`typescript` → `@typescript/typescript6@6.0.2` and `@typescript/native` →
`typescript@7.0.2`. `node_modules/.bin/tsc` is **7.0.2**. The API package's
`ts.version` is **6.0.3**, and `createSourceFile` is present.

That install's full audit is **one low** KaTeX finding
([GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7)).
Audit metadata: **145** dependencies, **26** dev dependencies, **53**
optional dependencies, **204** total. `pnpm audit --prod --audit-level=high`
passed. esbuild stays at the fixture's exact **0.28.2** pin, so the
workspace esbuild advisory is not in this graph. After `preview:build` and
`zudo-sg gen-token-manifest`, both `tsc --noEmit -p tsconfig.json` and
`tsc --noEmit -p preview/tsconfig.json` passed with `baseUrl` absent.

## Supported dependency consolidation — 2026-10-12, #991

Implementation is on `maintenance/supported-deps-991`, based on main
`cb10fbb0f2b041f7279e88f6e9f07e1f4af125a2`. [#981](https://github.com/Takazudo/zudo-sg/pull/981)
is merged. Source PRs [#965](https://github.com/Takazudo/zudo-sg/pull/965)–[#968](https://github.com/Takazudo/zudo-sg/pull/968)
were closed unmerged on 2026-10-12 after that integration. TypeScript 7
PRs [#982](https://github.com/Takazudo/zudo-sg/pull/982) and
[#988](https://github.com/Takazudo/zudo-sg/pull/988) stay open under
[#990](https://github.com/Takazudo/zudo-sg/issues/990).
[#963](https://github.com/Takazudo/zudo-sg/issues/963) stays open: this
batch only reruns the existing retained-lock gate.

### Baseline before the edits

Measured locally on Node **24.13.0** and pnpm **11.5.2**.
`pnpm install --frozen-lockfile` passed. Supply-chain verification and
`pnpm dedupe --check` both reported **437** resolution entries, and the
nonmutating dedupe check passed, so no compatible normalization was
pending. Root `pnpm audit`: **2 low, zero moderate/high/critical**
([GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)
esbuild, [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7)
KaTeX). `pnpm audit --prod --audit-level=high` and
`pnpm audit --audit-level=high` passed. The production audit without that
floor exits nonzero only because of the KaTeX low.
`tools/deploy` frozen install passed with **91** supply-chain entries and
**zero** advisories on both the full and production audits.

The independent React fixture, still at exact Zod **4.3.6** and
`@types/node` **22.19.15**, installed **182** resolution entries in its
temporary consumer lock. Its full audit retained **one low** KaTeX finding
and `pnpm audit --prod --audit-level=high` passed. That install's version
assertion stopped on this Mac before the browser stages because
`os.tmpdir()` returned a `/var/folders` path whose `realpath` is
`/private/var/folders`; the audit above was taken from that retained
install. Main's merged #981 head had all 14 PR Checks green, and
Production Deploy on `cb10fbb` succeeded.

Wind provenance before the edit, from the committed fixture: zfb **4.3.1**,
**343** candidates (**310** resolved utilities, **31** ordinary classes,
**2** markers), `candidateSetSha256`
`478478942a02c3aded0a7136427019391d5362c1808c095091ccbb46f33cfd2a`,
`windConfigSha256`
`904487d61f6c65f338ca4af5e2d4be605a016393e3b8a2e10b8bcd2dc7a49a02`.

### Selected updates and decisions

| Source | Result | Ownership kept |
| --- | --- | --- |
| #983 | Zod **4.4.3 → 4.6.5** | caret ranges in root, apps/demo and doc |
| #984 | `@testing-library/jest-dom` **6.9.1 → 7.0.1** | caret in root and the engine; exact `7.0.1` in demo-ui |
| #985 | `@types/node` **22.19.21 → 22.20.5** | caret in all six shared-workspace importers |
| #986 | `@playwright/test` **1.63.0 → 1.64.0** | caret in the root manifest; lockfile `playwright` and `playwright-core` are both **1.64.0** |
| #987 | React fixture Zod **4.3.6 → 4.6.5** | exact pin; no committed fixture lockfile |
| #989 | React fixture `@types/node` **22.19.15 → 22.20.5** | exact pin; no committed fixture lockfile |

**Zero direct removals.** Zod, jest-dom, Node types and Playwright have
live consumers: the docs schema, Vitest setup in the root and the engine,
Playwright e2e and packed proofs, and TypeScript compilation. A package
was not dropped because another importer also installs it. No one-shot
unused-dependency detector was added, and no declaration was reclassified
as unused. The engine-host fixture and the generated initializer template
were left on their existing generation contract.

jest-dom **7.0.1** requires Node `>=22` and peer
`@testing-library/dom` `>=10 <11`. Its Vitest peer is optional and accepts
retained Vitest **4.1.11**. The shared lock resolves one
`@testing-library/dom@10.4.2` for the root, demo-ui and engine importers.
No direct DOM declaration was added.

### Graph delta

`pnpm install` regenerated the shared lock from the final manifests.
`pnpm dedupe --check` then exited **1**: `@types/set-cookie-parser`,
`@types/ws`, `buffer-image-size` and `happy-dom` still peered
`@types/node@22.19.21`. `pnpm dedupe` applied that compatible
normalization (`Packages: -1`). The following `pnpm dedupe --check`
passed, and `pnpm install --frozen-lockfile` was already up to date.
That dedupe is normalization of the types peer, separate from the version
upgrades.

Resolution entries: **437 → 449** (**+12**). The twelve additions are the
jest-dom 7 closure: `@testing-library/dom@10.4.2`,
`@babel/code-frame@7.29.7`, `@babel/helper-validator-identifier@7.29.7`,
`@babel/runtime@7.29.10`, `@types/aria-query@5.0.4`, `ansi-styles@5.2.0`,
`aria-query@5.3.0`, `dom-accessibility-api@0.5.16`, `js-tokens@4.0.0`,
`lz-string@1.5.0`, `pretty-format@27.5.1` and `react-is@17.0.2`.
Zod, `@types/node`, `@playwright/test`, `playwright` and `playwright-core`
replaced existing resolution entries. Workflows install Chromium with
`pnpm exec playwright install chromium --with-deps`. No Playwright Docker
image or image tag is present.

The installer reported Zod **4.6.6** as available. This lock resolves
**4.6.5**, the version selected by #983. `@types/node` **26.6.5** is a
major outside the Node 22 policy and was not installed.

### Holds and audit after the shared-lock update

Fresh root audit is unchanged: **2 low, zero moderate/high/critical**.
Deployment remains **zero**. Both high-level audit gates pass. No new
high or critical finding was introduced. No override or audit ignore was
added.

| Package | Installed | Disposition |
| --- | --- | --- |
| esbuild | **0.27.7** retained; tsx family **0.28.2** retained | HOLD. Vite **7.3.5** and tsup **8.5.1** both depend on `^0.27.0`. The advisory's patched floor is **0.28.1**, outside those ranges. Vite 8 is not a compatible substitute. |
| katex | **0.16.47** retained | HOLD. zudo-doc **6.0.0** peers `^0.16.0`. The patched floor **0.18.2** is outside that range. |
| typescript | **5.9.3** retained | HOLD for #990. The compiler-API migration is a separate batch. |
| Node types | **22.20.5** | KEEP on the Node 22 line. |

### Wind provenance

`pnpm exec tsx packages/demo-ui/scripts/refresh-authored-class-coverage.ts`
ran the real `zfb wind explain --json --stdin --project-root .` compiler
at zfb **4.3.1**. The candidate set, candidate hash and all **343**
explanations are unchanged: **310** resolved utilities, **31** ordinary
classes, **2** markers. `windConfigSha256` changed from
`904487d61f6c65f338ca4af5e2d4be605a016393e3b8a2e10b8bcd2dc7a49a02` to
`f578e57532ee8ededa741cc8c3c62e57cadad9d348f7593e46874b1ac82f7feb`
because the generator hashes the entire root lockfile together with the
unchanged engine manifest and Wind inputs. The hash inputs and the
coverage assertions were not edited, and the digest was not written by
hand.

The updated React fixture was packed and installed outside the workspace.
Exact pins resolved to Zod **4.6.5** and `@types/node` **22.20.5**, with
the retained first-party pins unchanged (zfb **4.3.1**, zudo-doc **6.0.0**,
zdtp **0.8.6**, esbuild **0.28.2**). The temporary consumer lock has **182**
resolution entries, the same count as the Zod 4.3.6 / `@types/node` 22.19.15
baseline. Its full audit remains **one low** KaTeX finding
([GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7));
the production high gate passes. The fixture still has no committed lockfile.

## Lock health follow-up — 2026-10-12, #977 / #978 / #979 / #980

Implementation: #981, based on main `b2c7cb8186d063516f4fddb68f291fb5480025b6`.
The original #963 remains open: compatible direct floors and a healthy root lock
are not a package-side guarantee for retained consumer locks.

### Consolidated updates and toolchain

Selected source changes: #965 jsdom **30.1.2** (root and demo-ui), #966
CodeMirror view **6.43.14**, #967 Lezer highlight **1.2.5**, and #968
html-validate **11.16.2** (root and doc). Source PRs #965–#968 were
closed unmerged on 2026-10-12 after #981 merged; they are not still open.
Node 22 consumer/type support, Node 24 CI, pnpm
**11.5.2**, first-party pins, Vite/Vitest, Happy DOM, Preact and esbuild/KaTeX
holds remain unchanged.

The initial install retained view 6.43.1 beside 6.43.14 and exposed incompatible
private EditorView types. Compatible pnpm dedupe normalizes the shared graph;
frozen installation and nonmutating dedupe now pass. The graph has **437
package/snapshot records** versus 438 on main; this is graph normalization and
upgraded dependency closures, not a package removal.

Registry metadata for html-validate 11.16.2 requires Node
`^22.22.0 || >=24.8.0`; its optional Vitest/@vitest/expect peers accept
`^3.2.0 || ^4.0.1 || ^5.0.0`, including retained Vitest 4.1.11.
These are development-tool requirements, not changed published consumer floors.
Local Node **24.19.0** passes root/doc types, fresh root/doc builds and both HTML
validations with their unchanged `element-permitted-content` rules.
The real zfb 4.3.1 Wind generator retains all **343 candidates** and every
explanation: **310 resolved utilities, 31 ordinary classes, two markers**.
Only generated input provenance changes. The 34 focused coverage, module identity,
highlighting and jsdom sanitizer checks pass; final integration evidence belongs
on #981 rather than substituting historical source-PR checks.

### Dependabot graph ownership and dispositions

| Graph | Before | After |
| --- | --- | --- |
| Shared root lock: root, apps/demo, doc, packages/create-zudo-sg, packages/demo-ui, packages/styleguide | `/` plus overlapping `/packages/*` and `/apps/*` | `/` owns all six importers, including doc |
| Independent deployment tools | `/tools/deploy` | `/tools/deploy` retained |
| Independent React proof | `/fixtures/react-descriptor-host` | `/fixtures/react-descriptor-host` retained |
| Workflow actions | `/` | `/` retained |
| Composite actions | `/.github/actions/*` | `/.github/actions/*` retained |

All npm directories retain `@takazudo/*` exclusions and ignore only
`@types/node` `version-update:semver-major`. Same-major Node 22 updates and
unrelated majors remain available. YAML/options validate against SchemaStore's
Dependabot v2 schema; all six actual lock importers were inspected. No hosted
updater preview is available here; schema parsing does not prove future updater
execution. #969's complete workspace proposal is the existing ownership evidence.

State refreshed before implementation: #969/#970/#971/#972/#973/#975 are closed
unmerged under Node 22 policy; #971 was green and was not closed for CI failure.
#974 is closed unmerged as the exact duplicate of #965. No duplicate closure
comments were posted. #965–#968 were closed unmerged on 2026-10-12 after
#981 merged into `cb10fbb`.

### Packed retained-lock browser evidence

`pnpm verify:retained-lezer-lock --keep` passes all seven stages with the real
packed engine **0.5.1**, outside the workspace, on Node **24.19.0**, pnpm
**11.5.2** and system Chromium **154.0.8037.57**. A separate clean-install
control precedes the intentionally valid retained lock; diagnostic assets are
created in temporary storage and never copied into the initializer template.
`--keep` retains stage reports, command logs, actual resolution graphs,
before/after locks and browser evidence; CI runs the same command without it.

Frozen and ordinary installations preserve the seeded lock byte-for-byte:
highlight resolves common **1.5.2** while language/parser paths resolve
**1.5.3**. Fresh Node processes inspect real package paths at every stage to
avoid cached resolutions across reinstalls. Both TSX source and editable CSS
lose syntax spans and emit two CodeMirror highlighter plugin errors. The packed
minifier renames `tags` to `s`, yielding `TypeError: s is not iterable` with
`HighlightStyle.style`, `highlightTags`, `HighlightBuilder.highlightRange`,
`highlightTree` and `TreeHighlighter.buildDeco` in the captured stack. The
negative assertion requires that specific failure path and rejects other errors.

| Browser stage | TSX spans | Edited CSS spans | Errors | Live CSS apply / clear | Host isolation |
| --- | --- | --- | --- | --- | --- |
| Clean packed control | 5 | 8 | 0 | pass / pass | pass |
| Retained split diagnostic | 0 | 0 | 2 expected highlighter failures | pass / pass | pass |
| After consumer dedupe | 5 | 8 | 0 | pass / pass | pass |

Every stage has zero failed asset requests. `pnpm dedupe --check` exits **1**
and names the common 1.5.2 → 1.5.3 repair without mutating the split lock.
`pnpm dedupe --ignore-scripts` recovers one real common identity; another frozen
install and nonmutating dedupe check pass. Removing generated `dist` and
`.zfb-build` before rebuilding prevents stale bundles from substituting for
recovery. The same browser assertions then verify actual syntax, CSS and errors.

Final local integration also passes 1,572 root unit tests, 740 engine tests,
82 existing browser cases, root/doc types, all three builds/link checks,
root/doc HTML validation, template checks, descriptor/React/initializer packed
proofs and actual Node **22.23.3** packed imports/types/build. Root audit retains
only the two low holds; deployment remains zero and React retains one low KaTeX
finding. Required final-head CI and independent review are recorded on #981.

Local pinned Playwright installation is blocked by destination policy; local
browser evidence uses the available system Chromium. The existing packed
styleguide proof passes static stages but its direct dev Counter probe logs an
implicit `/favicon.ico` 404 under that browser (CDP confirmed the URL while
Counter updates 3 → 4). Its assertions are unchanged; this local command is
reported as failed, not passed. CI's pinned-browser styleguide check passed on
the first implementation head, and the final combined head requires its own
complete gate. No local error was filtered out or starter template changed.

### Retained-lock remedy assessment

Current primary upstream guidance was inspected on 2026-10-12. CodeMirror author
Marijn Haverbeke recommends inspecting installed dependencies and avoiding
separate CodeMirror/Lezer copies, including private dependencies behind symlinks:
[upstream discussion](https://discuss.codemirror.net/t/help-resolving-dependency-conflicts-between-lezer-and-codemirror/9315).
[pnpm dedupe documentation](https://pnpm.io/cli/dedupe) describes compatible
lock normalization and the nonmutating, nonzero diagnostic `--check` result.
The documented recovery is verified specifically with pnpm 11.5.2; current
online documentation also describes later pnpm behavior, which is not claimed
as tested here.

Fresh primary npm metadata still permits common 1.5.2: highlight **1.2.5** uses
`^1.3.0`, lr **1.4.11** uses `^1.0.0`, language **6.13.1** uses `^1.5.0`,
CSS **1.3.9** and JavaScript **1.5.6** use `^1.2.0`; latest common is **1.5.3**.
The common 1.5.2 published source allocates NodeProp IDs within its own module,
so two compatible copies can interpret property IDs differently.
No supported compatible package-side remedy was established by the bounded
metadata/source/guidance investigation. No speculative pins, overrides,
editor replacement or release was added. #963 retains its original delivery
requirement; consumer deduplication and the bounded diagnostic child do not
redefine it as documentation-only.

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
`module-identity.test.ts` additionally pins this repository's graph to one
resolved instance each of `@lezer/common`, `@lezer/highlight`,
`@codemirror/language` and `@codemirror/state` across their consumers.

#916 updates retained tsx 4.23.13 → 4.23.15, replacing its esbuild 0.28.1/platform
family with 0.28.2. It does not introduce a third family. #917 updates DOMPurify
3.4.15 → 3.4.16. #920 remains the already-closed duplicate. #922's setup-node
7.1.0 pin now covers the shared action and both publish workflows, plus the new
deployment setup action; Dependabot's github-actions entry scans
`.github/actions/*` as well as the workflows, so composite-action pins are not
missed again. #923's download-artifact 8.0.2 pin covers all six sites;
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
