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
- files: doc/tsconfig.json, doc/pages/, doc/src/styles/global.css, doc/package.json, doc/.zudo-doc.json
- source: packages/create-zudo-doc/templates/base/, packages/create-zudo-doc/src/scaffold.ts
- track: releases
- pinned: 987b703057f5fb338068c1790399a184c8eebb93 (v5.19.1)
- updated: 2026-09-08
- sync: cd <scratch> && pnpm dlx create-zudo-doc@<ver> a<ver> …  # bare dir name, not a path; use the flag set in "Regenerating a create-zudo-doc reference" above for BOTH the old and the new pin, then three-way merge
- notes: local customizations to re-apply: `zfb.config.ts` site settings, `.htmlvalidate.json`, `wrangler.toml`, `DELETION_LEDGER.md`, the `check:html` script + `html-validate` devDep, `scripts/run-b4push.sh`, and `--strict-plain-css-imports` on the build script. All eight verified present after the 5.18.2 merge. No scaffold dependency required restoration at 5.18.2 either; the only dependency delta runs the other way — 5.16.1 shipped `@takazudo/zdtp` unconditionally, 5.18.2 ships it only when `designTokenPanel` is enabled, which `doc/` does not enable. `@takazudo/zdtp` and its now-dead `gen:z-index`/`check:z-index` scripts (wired to a `doc/src/config/z-index-tokens.ts` that never existed) were removed from `doc/package.json` and the root lockfile regenerated (`a88ec37`, #561/#565) — this was inert-dependency cleanup, not a scaffold-alignment merge. `doc/tsconfig.json`, `doc/pages/`, and `doc/src/styles/global.css` are now byte-identical to the 5.18.2 reference scaffold. At 5.19.0 there is nothing further to merge: `create-zudo-doc`'s published `templates/` tree is byte-identical to 5.18.2's (verified by diffing the two npm tarballs), and the release changes only CLI argument parsing — the positional argument became a destination path.

  At 5.19.1, only `src/scaffold.ts` dependency pins changed (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` 2.16.0, `@takazudo/zudo-doc` ^5.19.1, and `@takazudo/zdtp` 0.5.2 when Design Token Panel is enabled); the published `templates/` tree is byte-identical (verified by the 5.19.0/5.19.1 npm tarball diff), and `doc/package.json` already carries the 2.16.0 pins from this bump, so there is nothing to three-way merge.

## create-zudo-doc (setup-doc-skill.sh)

- repo: zudolab/zudo-doc
- what: generated doc skill setup script, customized
- files: doc/scripts/setup-doc-skill.sh
- source: packages/create-zudo-doc/templates/base/scripts/setup-doc-skill.sh
- track: releases
- pinned: unknown
- observed-head: 987b703057f5fb338068c1790399a184c8eebb93 (v5.19.1; recorded 2026-09-08)
- updated: 2026-09-08
- sync: cd <scratch> && pnpm dlx create-zudo-doc@<ver> a<ver> …  # same flag set as above; inspect the generated script, then three-way merge
- notes: deliberately NOT fully synced, re-examined against the 5.19.0 generated script. Still-valid reasons: the host pins the stable "doc-wisdom" skill name (upstream derives `<projectName>-wisdom` from `@zudo-sg/doc`, which fails the script's own skill-name validation and would break user-level links), and upstream's config-driven locale map stays inert because `doc/zfb.config.ts` declares no `locales`. NO LONGER a divergence: the nested-workspace `REPO_ROOT` / `PROJECT_PREFIX` resolution is now identical upstream (removed during #548). ADOPTED (#551/#565): `ensure_symlink` now matches upstream's non-destructive posture — it replaces its own prior symlink (including a broken one) but refuses and exits 1 rather than `rm -rf`-ing a real file or directory sitting at a link target. Verified against a temporary fixture with `HOME` overridden, never against the real global skills directory. Upstream-only at 5.19.0 and still NOT adopted here (lower-value, unrelated to safety): `...zudoDoc({})` spread-aware top-level setting detection, and a "no explicit locale settings found" stderr note. The published `templates/` tree is otherwise byte-identical to 5.18.2's, so no other divergence changed. These two remaining follow-ups stay open.

  At 5.19.1, only `src/scaffold.ts` dependency pins changed (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` 2.16.0, `@takazudo/zudo-doc` ^5.19.1, and `@takazudo/zdtp` 0.5.2 when Design Token Panel is enabled); the published `templates/` tree is byte-identical (verified by the 5.19.0/5.19.1 npm tarball diff), and `doc/package.json` already carries the 2.16.0 pins from this bump, so there is nothing to three-way merge.

## create-zudo-doc (claude skills)

5.19.1 notes for this entry: only `src/scaffold.ts` dependency pins changed (`@takazudo/zfb`, `@takazudo/zfb-runtime`, `@takazudo/zfb-md-wasm` 2.16.0, `@takazudo/zudo-doc` ^5.19.1, and `@takazudo/zdtp` 0.5.2 when Design Token Panel is enabled); the published `templates/` tree is byte-identical (verified by the 5.19.0/5.19.1 npm tarball diff), and `doc/package.json` already carries the 2.16.0 pins from this bump, so there is nothing to three-way merge.

- repo: zudolab/zudo-doc
- what: generated Claude Code skills, customized
- files: .claude/skills/zudo-doc-design-system/, .claude/skills/zudo-doc-version-bump/ (customized); .claude/skills/zudo-doc-translate/ (upstream-identical, tracked here only for completeness)
- source: packages/create-zudo-doc/templates/features/claudeSkills/files/.claude/skills/
- track: releases
- pinned: unknown
- observed-head: 987b703057f5fb338068c1790399a184c8eebb93 (v5.19.1; recorded 2026-09-08)
- updated: 2026-09-08
- sync: cd <scratch> && pnpm dlx create-zudo-doc@<ver> a<ver> …  # same flag set as above; inspect the generated skills, then three-way merge
- notes: only design-system and version-bump are deliberate forks; re-examined against the 5.19.0 generated skills — the three templates are byte-identical between 5.16.1 and 5.19.0, so there is nothing new upstream to merge into either. Confirmed project rules: design-system carries the two token worlds + accent budget; version-bump is adapted for no `scripts/version-bump.sh`, a single changelog `index.mdx`, and no JA locale (`locales: {}`). `zudo-doc-translate` is NO LONGER a fork (#562, `3501b62`): the stale pre-generalization copy that described `src/content/docs-ja/` and `src/config/settings.ts` (neither of which exists here) was replaced verbatim with the current upstream `create-zudo-doc@5.19.0` template, which is already locale-agnostic (reads the project's own `zfb.config.ts` `locales` map instead of assuming En/Ja) and needs no project-specific delta because this project has i18n fully disabled. It is now upstream-identical with zero customizations, so there is nothing to sync or merge for it going forward. One known gap is accepted rather than fixed: the template tells the reader to read `defaultLocale`, `locales`, and `docsDir` from the `zudoDoc({...})` call in `zfb.config.ts`, but this project has no `zudoDoc(` call at all (`zfb.config.ts` builds `zudoDocPreset({ settings: presetSettings })`) and keeps those keys in `src/config/settings.ts`. It stays inert while `locales` is `{}` — either file leads to "no locales configured, nothing to translate" — but the skill must be re-forked, or the pointer fixed upstream, before i18n is enabled here.
