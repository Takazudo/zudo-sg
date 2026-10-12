# ZUDO_DEPS_PINS

## Regenerating a create-zudo-doc reference

Every entry below is synced by generating a reference scaffold and three-way merging it
against `doc/`. These properties of that generator are not recoverable from this repo:

- **The destination may be a path from 5.19.0 onward, but not before.** 5.19.0 made the
  positional argument a destination and derives the project name from its final segment, so
  `<scratch>/ref-doc` works; 5.18.2 and earlier reject it with "Project name must start with a
  lowercase letter or digit…", so `cd` into the scratch directory first whenever the OLD pin is
  the older CLI. Either way the final segment must itself be a valid package name — `refDoc`
  fails on the uppercase letter.
- **Prefer diffing the published `templates/` tree over generating two scaffolds.** Running the
  generator in a non-TTY agent shell is unreliable: `@clack/prompts` opens a TTY and aborts with
  `SystemError [ERR_TTY_INIT_FAILED]: uv_tty_init returned EINVAL` on some stdio shapes, which
  looks exactly like a bad flag but is not. The template delta — the only thing this entry
  tracks — is recoverable straight from npm and is exact:

  ```sh
  for v in <old> <new>; do
    mkdir -p "p$v" && (cd "p$v" && curl -sL "$(npm view create-zudo-doc@$v dist.tarball)" | tar xz)
  done
  diff -r "p<old>/package/templates" "p<new>/package/templates"
  ```

  Fall back to generating scaffolds only when a *rendered* difference (one the templates express
  conditionally on flags) is actually in question.
- **Generate the OLD pin and the NEW pin with the same explicit flag set, mirroring
  `doc/`'s actual feature set — never bare `--yes` for both.** The bare `--yes` defaults
  move between releases (5.18.2 turns on docHistory, assetViewer, llmsTxt, sidebarResizer,
  sidebarToggle and tocToggle, which 5.16.1 left off), so a default-vs-default diff invents
  a `doc-history-server` dependency, `run-parallel` dev scripts and a `DocHistory` chrome
  binding that have nothing to do with the version delta. The CLI flag surface itself was
  identical across 5.16.1 → 5.18.2 (verified by diffing `--help`), which is what makes the
  flag-matched comparison valid. 5.19.0's `--help` diff is confined to the destination
  argument — `[project-name]` became `[destination]`, `--name` is now documented as an
  override of the name derived from the final segment — so every feature flag still matches
  and the comparison stays valid across that boundary too.

Run once per version, then diff `a<old>` against `a<new>` to isolate the template delta:

```sh
cd <scratch>
pnpm dlx create-zudo-doc@<ver> a<ver> --yes --pm pnpm --no-install --no-git \
  --lang en --search --sidebar-filter --claude-resources --claude-skills \
  --skill-symlinker --llms-txt --image-enlarge --dynamic-page-transition \
  --no-codex-resources --no-claude-skills-writing --no-design-token-panel \
  --no-theme-pack-switcher --no-sidebar-resizer --no-sidebar-toggle \
  --no-toc-toggle --no-versioning --no-doc-history --no-body-foot-util \
  --no-tauri --no-tauri-dev --no-footer-nav-group --no-asset-viewer \
  --no-footer-copyright --no-changelog --no-tag-governance --no-doc-tags \
  --no-footer-taglist --no-noindex --no-i18n
```

## create-zudo-doc

- repo: zudolab/zudo-doc
- what: generated doc-site scaffold (doc/), customized
- files: doc/tsconfig.json, doc/pages/, doc/src/styles/global.css, doc/package.json, doc/.zudo-doc.json, doc/.gitignore
- source: packages/create-zudo-doc/templates/base/, packages/create-zudo-doc/src/scaffold.ts
- track: releases
- pinned: 6.1.1
- observed-head: create-zudo-doc 6.1.1
- updated: 2026-10-13
- sync: cd <scratch> && pnpm dlx create-zudo-doc@<ver> a<ver> …  # bare dir name, not a path; use the flag set in "Regenerating a create-zudo-doc reference" above for BOTH the old and the new pin, then three-way merge
- notes: local customizations to re-apply: `zfb.config.ts` site settings, `.htmlvalidate.json`, `wrangler.toml`, `DELETION_LEDGER.md`, the `check:html` script + `html-validate` devDep, `scripts/run-b4push.sh`, and `--strict-plain-css-imports` on the build script. All eight verified present after the 5.18.2 merge. No scaffold dependency required restoration at 5.18.2 either; the only dependency delta runs the other way — 5.16.1 shipped `@takazudo/zdtp` unconditionally, 5.18.2 ships it only when `designTokenPanel` is enabled, which `doc/` does not enable. `@takazudo/zdtp` and its now-dead `gen:z-index`/`check:z-index` scripts (wired to a `doc/src/config/z-index-tokens.ts` that never existed) were removed from `doc/package.json` and the root lockfile regenerated (`a88ec37`, #561/#565) — this was inert-dependency cleanup, not a scaffold-alignment merge. `doc/tsconfig.json`, `doc/pages/`, and `doc/src/styles/global.css` are now byte-identical to the 5.18.2 reference scaffold. At 5.19.0 there is nothing further to merge: `create-zudo-doc`'s published `templates/` tree is byte-identical to 5.18.2's (verified by diffing the two npm tarballs), and the release changes only CLI argument parsing — the positional argument became a destination path.

  At 5.19.1, only `src/scaffold.ts` dependency pins changed (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` 2.16.0, `@takazudo/zudo-doc` ^5.19.1, and `@takazudo/zdtp` 0.5.2 when Design Token Panel is enabled); the published `templates/` tree is byte-identical (verified by the 5.19.0/5.19.1 npm tarball diff), and `doc/package.json` already carries the 2.16.0 pins from this bump, so there is nothing to three-way merge.

  At 5.21.0, the published 5.19.1 → 5.21.0 `templates/` diff changes only `scripts/check-links.js` and `scripts/setup-doc-skill.sh`. The link checker is not vendored here; the root owns `scripts/check-links.mjs`. Adopted the zudo-doc 5.21.0 dependency pin in `doc/package.json`. No setup-script delta applies to the local fork (see its entry below), and no other scaffold template changed.

  At 5.22.0, the published `templates/` tree is byte-identical to 5.21.0's (verified by diffing the two npm tarballs); only `src/scaffold.ts`'s `@takazudo/zudo-doc-history-server` pin moved to `^5.22.0`. Nothing to three-way merge.

  At 5.24.0, the published `templates/` tree remains byte-identical to 5.22.0's (re-verified by diffing the two npm tarballs). `dist/scaffold.js` only moves pins (`ZUDO_DOC_PIN ^5.24.0`, zdtp 0.8.0, and history-server `^5.24.0`) and adds a `check:images` script, which is adopted in `doc/package.json`.

  At 5.25.0, the published `templates/` tree changes only `scripts/check-links.js` — see the "check-links.mjs" judgement call below. `dist/scaffold.js` (no `src/scaffold.ts` in this tarball; compared the built file directly) moves pins (`ZUDO_DOC_PIN ^5.25.0`, zfb family `2.18.0`, history-server `^5.25.0`) and drops `katex`/`diff` from the unconditional base-deps block — `katex` is gone entirely (zudo-doc now loads it via a rejection-handled dynamic import, #4206/#4209, so a scaffold no longer needs to carry it even though `math` isn't a create-zudo-doc feature) and `diff` moves from unconditional to gated on `docHistory` alone (the doc-history Compare view's `import("diff")` is now rejection-handled too, so an `assetViewer`-only or `docHistory`-off project no longer needs it). `doc/` does not enable `docHistory`, `assetViewer`, or `math`, so neither dep was ever installed here — no `doc/package.json` change follows from this. Also drops the `.zudo-doc/` line from the scaffold's generated `.gitignore` block; #708 owns applying that removal to the repo's own `doc/.gitignore`, this entry only records that the scaffold source changed. `doc/package.json` already carries the 5.25.0 zfb-family/zudo-doc pins from the sibling deps-bump commit (`b317a58`), so nothing further to adopt here.
  `siteTreeNavSecondary` is adopted in `doc/` only (the root home is custom and does not read it); zfb-free asset-viewer subpaths are deliberately not adopted because there is no consumer, and `assetViewer` is off on both hosts.

  At 5.26.0, the published `templates/` tree is byte-identical to 5.25.0's. `dist/scaffold.js` only updates zudo-doc/history-server to 5.26.0 and the zfb family to 2.19.0. The workspace already uses zfb 2.19.0; the zudo-doc dependency update is adopted in `doc/package.json`. No template merge is needed, and local customizations remain intact. Root/doc checks and builds passed.

  At 5.26.2, the published `templates/` tree is byte-identical to 5.26.0's. `dist/scaffold.js` only updates zudo-doc/history-server to 5.26.2 and the zfb family to 2.20.0. Those dependency pins are adopted across the workspace and starter template; no scaffold merge is needed, and local customizations remain intact. The full pre-push gate and packed-initializer foreign-host verification passed.

  **check-links.mjs judgement call (5.25.0, #709):** the template's `scripts/check-links.js`
  5.25.0 fix addresses an MDX id-scan defect — an escaped `\<` in prose could start a fake tag
  whose `MDX_ID_ATTRIBUTE_RUN` then let a prose apostrophe be read as a quoted attribute value
  that crossed a blank line and swallowed a later element's real `id="…"`, so a valid anchor got
  reported broken. This root's `scripts/check-links.mjs` does **not** share the defect, verified
  with a fixture rather than by inspection alone: `dist/index.html` was written with the exact
  upstream failure shape (`<p>… an escaped \<em&gt; that must not start a fake tag.</p>`, a blank
  line, then `<div id="target-id">` and `<a href="#target-id">`), run through the real
  `scripts/check-links.mjs` (`node scripts/check-links.mjs` in a throwaway sandbox with only that
  file under `dist/`), and it exited 0 / "No broken internal links found." Root cause of the
  non-reproduction: upstream's checker runs a second pass over raw `.mdx`/`.md` source
  (`checkMdxLinks` → `extractStaticMdxIds`) that builds a set of valid static ids to validate
  `href="#…"` fragments against; this root's scanner has no such pass at all — it only scans
  built `dist/**/*.html` for `href`/`src` targets and resolves them to files
  (`extractInternalLinks` / `resolveDistPath`), and explicitly skips every `#`-prefixed href
  before resolution (`scripts/check-links.mjs:113`, also covered by the existing
  "skips external, mailto, data, and fragment links" test in
  `scripts/__tests__/check-links.test.ts`). With no MDX-id-scanning code path and no fragment
  validation of any kind, the precondition for the upstream defect does not exist here. Verdict:
  **no-op — no code changed**, and no new regression test was added since there is no reachable
  defect to guard against (the existing fragment-skip test already covers the relevant boundary).

  At 5.27.0, the published `scripts/check-links.js` now uses
  `extractAllHeadingIds`; it does not apply to this repo's HTML-only
  `scripts/check-links.mjs`. zudo-doc now stages installed route sources under
  `.zudo-doc/routes-src`, so the generated ignore is restored in the root,
  docs host, and foreign fixture. No optional scaffold features were enabled.

  At 5.28.0, the published `templates/` tree is byte-identical to 5.27.0's (verified by diffing
  the two npm tarballs). `dist/scaffold.js` only moves pins (`ZUDO_DOC_PIN ^5.28.0`, zfb family
  `2.21.1`, zdtp `0.8.5`, history-server `^5.28.0`); the workspace already carries the zfb/zdtp
  pins, and the zudo-doc/history-server 5.28.0 pins are adopted. Nothing to three-way merge.

  At 6.0.0, the 5.28.0 → 6.0.0 `templates/` diff changes five files: base `tsconfig.json`
  paths, base `src/styles/global.css`, base and i18n `[[...slug]].tsx`, and the
  `zudo-doc-design-system` skill template (the local merge is recorded in the
  "create-zudo-doc (claude skills)" entry below). The
  `setup-doc-skill.sh` template and other skill templates are unchanged. Scaffold dependencies
  now use zfb 4.3.1 and zudo-doc `^6.0.0`, with no Preact dependency.

  At 6.1.1, all 29 published template files are byte-identical to 6.0.0.
  Scaffold dependency logic moves the emitted doc and history-server pins to
  `^6.1.1` and the zfb family pins to 4.3.3. `doc/package.json` adopts
  zudo-doc 6.1.1 and zfb, zfb-runtime, and zfb-md-wasm 4.3.3. `doc/` still
  does not enable doc history, so history-server is not added. Local
  customizations stay in place.

## create-zudo-doc (setup-doc-skill.sh)

- repo: zudolab/zudo-doc
- what: generated doc skill setup script, customized
- files: doc/scripts/setup-doc-skill.sh
- source: packages/create-zudo-doc/templates/base/scripts/setup-doc-skill.sh
- track: releases
- pinned: 6.1.1
- observed-head: create-zudo-doc 6.1.1
- updated: 2026-10-13
- sync: cd <scratch> && pnpm dlx create-zudo-doc@<ver> a<ver> …  # same flag set as above; inspect the generated script, then three-way merge
- notes: deliberately NOT fully synced, re-examined against the 5.19.0 generated script. Still-valid reasons: the host pins the stable "doc-wisdom" skill name (upstream derives `<projectName>-wisdom` from `@zudo-sg/doc`, which fails the script's own skill-name validation and would break user-level links), and upstream's config-driven locale map stays inert because `doc/zfb.config.ts` declares no `locales`. NO LONGER a divergence: the nested-workspace `REPO_ROOT` / `PROJECT_PREFIX` resolution is now identical upstream (removed during #548). ADOPTED (#551/#565): `ensure_symlink` now matches upstream's non-destructive posture — it replaces its own prior symlink (including a broken one) but refuses and exits 1 rather than `rm -rf`-ing a real file or directory sitting at a link target. Verified against a temporary fixture with `HOME` overridden, never against the real global skills directory. Upstream-only at 5.19.0 and still NOT adopted here (lower-value, unrelated to safety): `...zudoDoc({})` spread-aware top-level setting detection, and a "no explicit locale settings found" stderr note. The published `templates/` tree is otherwise byte-identical to 5.18.2's, so no other divergence changed. These two remaining follow-ups stay open.

  At 5.19.1, only `src/scaffold.ts` dependency pins changed (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` 2.16.0, `@takazudo/zudo-doc` ^5.19.1, and `@takazudo/zdtp` 0.5.2 when Design Token Panel is enabled); the published `templates/` tree is byte-identical (verified by the 5.19.0/5.19.1 npm tarball diff), and `doc/package.json` already carries the 2.16.0 pins from this bump, so there is nothing to three-way merge.

  At 5.21.0, the published 5.19.1 → 5.21.0 `templates/` diff changes only `scripts/check-links.js` (not vendored; root owns `scripts/check-links.mjs`) and `scripts/setup-doc-skill.sh`. No new script changes were adopted: moving `REPO_DOCS_DIR` after config parsing and wrapping the node heredoc in a function do not apply because this fork has no config parser; the locale-array guards and locale-directory guidance checks do not apply because it has no locale-map arrays. Existing legacy-array loops already have length guards. Retained the stable `doc-wisdom` name, inert locale map, fixed docs path, and non-destructive `ensure_symlink`. Validation uses the local bash test suite; bash 3.2 compatibility is not claimed.

  At 5.22.0, the published `templates/` tree is byte-identical to 5.21.0's (verified by diffing the two npm tarballs); only `src/scaffold.ts`'s `@takazudo/zudo-doc-history-server` pin moved to `^5.22.0`. Nothing to three-way merge.

  At 5.24.0, the published `templates/` tree remains byte-identical to 5.22.0's (re-verified by diffing the two npm tarballs). `dist/scaffold.js` only moves pins (`ZUDO_DOC_PIN ^5.24.0`, zdtp 0.8.0, and history-server `^5.24.0`) and adds a `check:images` script, which is adopted in `doc/package.json`.

  At 5.25.0, the published 5.24.0 → 5.25.0 `templates/` diff touches only `scripts/check-links.js` (not vendored; root owns `scripts/check-links.mjs` — see its entry above for the judgement call). `scripts/setup-doc-skill.sh` is unchanged, so no new script delta to adopt or reject.

  At 5.26.0, the published setup-script template is unchanged from 5.25.0. No merge is needed; the documented customizations and unknown original provenance remain unchanged.

  At 5.26.2, the published setup-script template is unchanged from 5.26.0. No merge is needed; the documented customizations and unknown original provenance remain unchanged.

  At 5.27.0, the published setup-script template is unchanged; the documented
  project-specific edits remain intact.

  At 5.28.0, the published setup-script template is unchanged from 5.27.0. No merge is needed.

  At 6.1.1, the published setup-script template is byte-identical to 6.0.0.
  No merge is needed. The scaffold's emitted dependency pins move; this script
  does not.

## create-zudo-doc (claude skills)

- repo: zudolab/zudo-doc
- what: generated Claude Code skills, customized
- files: .claude/skills/zudo-doc-design-system/, .claude/skills/zudo-doc-version-bump/ (customized); .claude/skills/zudo-doc-translate/ (upstream-identical, tracked here only for completeness)
- source: packages/create-zudo-doc/templates/features/claudeSkills/files/.claude/skills/
- track: releases
- pinned: 6.1.1
- observed-head: create-zudo-doc 6.1.1
- updated: 2026-10-13
- sync: cd <scratch> && pnpm dlx create-zudo-doc@<ver> a<ver> …  # same flag set as above; inspect the generated skills, then three-way merge
- notes: only design-system and version-bump are deliberate forks; re-examined against the 5.19.0 generated skills — the three templates are byte-identical between 5.16.1 and 5.19.0, so there is nothing new upstream to merge into either. Confirmed project rules: design-system carries the two token worlds + accent budget; version-bump is adapted for no `scripts/version-bump.sh`, a single changelog `index.mdx`, and no JA locale (`locales: {}`). `zudo-doc-translate` is NO LONGER a fork (#562, `3501b62`): the stale pre-generalization copy that described `src/content/docs-ja/` and `src/config/settings.ts` (neither of which exists here) was replaced verbatim with the current upstream `create-zudo-doc@5.19.0` template, which is already locale-agnostic (reads the project's own `zfb.config.ts` `locales` map instead of assuming En/Ja) and needs no project-specific delta because this project has i18n fully disabled. It is now upstream-identical with zero customizations, so there is nothing to sync or merge for it going forward. One known gap is accepted rather than fixed: the template tells the reader to read `defaultLocale`, `locales`, and `docsDir` from the `zudoDoc({...})` call in `zfb.config.ts`, but this project has no `zudoDoc(` call at all (`zfb.config.ts` builds `zudoDocPreset({ settings: presetSettings })`) and keeps those keys in `src/config/settings.ts`. It stays inert while `locales` is `{}` — either file leads to "no locales configured, nothing to translate" — but the skill must be re-forked, or the pointer fixed upstream, before i18n is enabled here.
  At 5.19.1, only `src/scaffold.ts` dependency pins changed (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` 2.16.0, `@takazudo/zudo-doc` ^5.19.1, and `@takazudo/zdtp` 0.5.2 when Design Token Panel is enabled); the published `templates/` tree is byte-identical (verified by the 5.19.0/5.19.1 npm tarball diff), and `doc/package.json` already carries the 2.16.0 pins from this bump, so there is nothing to three-way merge.

  At 5.21.0, the published 5.19.1 → 5.21.0 `templates/` diff changes only `scripts/check-links.js` (not vendored; root owns `scripts/check-links.mjs`) and `scripts/setup-doc-skill.sh`. The Claude skill templates are unchanged, so there are no skill deltas to adopt. The setup-script changes are not applicable to the local fork: no config parser or locale-map arrays, with legacy-array guards already present (see its entry above). Existing skill customizations remain in place.

  At 5.22.0, the published `templates/` tree is byte-identical to 5.21.0's (verified by diffing the two npm tarballs); only `src/scaffold.ts`'s `@takazudo/zudo-doc-history-server` pin moved to `^5.22.0`. Nothing to three-way merge.

  At 5.24.0, the published `templates/` tree remains byte-identical to 5.22.0's (re-verified by diffing the two npm tarballs). `dist/scaffold.js` only moves pins (`ZUDO_DOC_PIN ^5.24.0`, zdtp 0.8.0, and history-server `^5.24.0`) and adds a `check:images` script, which is adopted in `doc/package.json`.

  At 5.25.0, the published 5.24.0 → 5.25.0 `templates/` diff touches only `scripts/check-links.js` (not vendored; root owns `scripts/check-links.mjs`). The Claude skill templates are unchanged, so there are no skill deltas to adopt.

  At 5.26.0, the published Claude skill templates are unchanged from 5.25.0. No merge is needed; the documented customizations and unknown original provenance remain unchanged.

  At 5.26.2, the published Claude skill templates are unchanged from 5.26.0. No merge is needed; the documented customizations and unknown original provenance remain unchanged.

  At 5.27.0, the published Claude skill templates are unchanged from 5.26.2. No merge is needed; the documented customizations and unknown original provenance remain unchanged.

  At 5.28.0, the published Claude skill templates are unchanged from 5.27.0. No merge is needed.

  At 6.0.0, the published `zudo-doc-design-system` template changes utility
  terminology to zudo-wind, reads token values from `:root` properties, adds a
  CSS pipeline section for `@layer zw-reset, zd-flow` and top-level `wind`
  configuration, and changes its component runtime guidance to zudo-react.
  Three-way merged those hunks into this project fork: the local two-token-world
  model, accent budget, border ladder, and component-specific rules remain, while
  root utility mappings now point to `zfb.config.ts` and CSS properties to
  `src/styles/global.css`. No changes were needed to the version-bump or
  translation skill templates.

  At 6.1.1, all 29 published template files, including the three Claude skill
  templates, are byte-identical to 6.0.0. No skill merge is needed.

## TypeScript compiler configuration

The six shared-workspace importers and `fixtures/react-descriptor-host` use
TypeScript 7's `tsc` through the `@typescript/native` alias
(`npm:typescript@^7.0.2`, exact `7.0.2` in the React fixture) and the
TypeScript 6 compiler API through the `typescript` import name
(`npm:@typescript/typescript6@^6.0.2`, exact `6.0.2` in the React fixture).
`@typescript/typescript6@6.0.2` publishes `tsc6` and re-exports the
programmatic API. It depends on `@typescript/old` (`npm:typescript@^6`),
which is not the compiler that owns `node_modules/.bin/tsc`. Native `tsc`
must come from each importer's direct `@typescript/native` dependency.
Published stable versions checked on 2026-10-12: `typescript` latest
**7.0.2** (bin `tsc` only, no peer dependencies) and
`@typescript/typescript6` latest **6.0.2** (bin `tsc6` only, no peer
dependencies).

`fixtures/engine-host`, `fixtures/descriptor-host`, and the generated
default consumer stay on TypeScript `^5.9.0` and still extend the published
`@takazudo/zudo-doc/tsconfig.base.json`. The initializer package's compiler
is not the compiler installed into a project it generates.

### Pinned zudo-doc base snapshot

Upstream file: `@takazudo/zudo-doc@6.0.0`
`packages/zudo-doc/tsconfig.base.json`, commit
`b4f974598b27064a092eeadb5b2e5559078a8bb9`. The same blob is
`6c863a3ae09e10c187742b8f1461f061ce789adb`. A later zudo-doc package version
is not evidence that this file changed; compare the blob.

6.1.1 republishes that file. Compared on 2026-10-13 from the installed
`@takazudo/zudo-doc@6.1.1` package: `git hash-object` is still
`6c863a3ae09e10c187742b8f1461f061ce789adb`, and the file still contains
`baseUrl: "."`. Reconciliation against the owned root, doc, and
React-fixture snapshots is a no-op. Those snapshots still omit `baseUrl`.
They do not set `baseUrl: null` and they do not restore `extends`.

The base sets `baseUrl: "."`, `jsx` / `jsxImportSource` to
`@takazudo/zfb/zudo-react`, and
`files: ["./zfb-config-shim.d.ts", "./virtual-modules.d.ts"]`. TypeScript 7
rejects `baseUrl` (`TS5102`). Setting `baseUrl` to `null` is not a fix:
`tsc` can clear it while zfb's config reader keeps the inherited value, so
path aliases stop resolving in the product build.

These importers therefore own the base options instead of extending the
published file:

- repository root `tsconfig.json`
- `doc/tsconfig.json`
- `fixtures/react-descriptor-host/tsconfig.json`

Each copy omits `baseUrl`, keeps the zudo-react JSX settings, and points
`files` at that project's own
`node_modules/@takazudo/zudo-doc/zfb-config-shim.d.ts` and
`virtual-modules.d.ts`. Root and doc keep `@/*` as `./src/*`. The React
fixture keeps `checkJs` and `skipLibCheck: false`. Local include/exclude
boundaries stay in the importer. `apps/demo` and `packages/demo-ui` never
extended the base; they only drop their own `baseUrl`.
`packages/create-zudo-sg` sets `types: ["node"]` because TypeScript 7 no
longer loads `@types/*` automatically.

On the next `@takazudo/zudo-doc` bump, diff the new
`node_modules/@takazudo/zudo-doc/tsconfig.base.json` against these three
snapshots. Carry new `compilerOptions` and any new `files` entry, still
omit `baseUrl`, and rebase each new relative file from the package root
into the importer's `node_modules/@takazudo/zudo-doc/` path. Do not copy an
older Preact JSX setting back in. Re-run `pnpm check`,
`pnpm --filter @zudo-sg/doc check`, and a zfb build of each host that uses
`paths` before accepting the snapshot.
