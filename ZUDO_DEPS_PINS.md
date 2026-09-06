# ZUDO_DEPS_PINS

## create-zudo-doc

- repo: zudolab/zudo-doc
- what: generated doc-site scaffold (doc/), customized
- files: doc/tsconfig.json, doc/pages/, doc/src/styles/global.css, doc/package.json, doc/.zudo-doc.json
- source: packages/create-zudo-doc/templates/base/, packages/create-zudo-doc/src/scaffold.ts
- track: releases
- pinned: 325288eca0f2e0fe101228f147c601b1fe1ed4c5 (v5.18.2)
- updated: 2026-09-07
- sync: pnpm dlx create-zudo-doc@<ver> <scratch>/ref-doc --yes --pm pnpm --no-install …  # generate a reference, then three-way merge
- notes: local customizations to re-apply: `zfb.config.ts` site settings, `.htmlvalidate.json`, `wrangler.toml`, `DELETION_LEDGER.md`, the `check:html` script + `html-validate` devDep, `scripts/run-b4push.sh`, and `--strict-plain-css-imports` on the build script. All eight verified present after the 5.18.2 merge. No scaffold dependency required restoration at 5.18.2 either; the only dependency delta runs the other way — 5.16.1 shipped `@takazudo/zdtp` unconditionally, 5.18.2 ships it only when `designTokenPanel` is enabled (the 5.18.2 build fix). `doc/` keeps `@takazudo/zdtp` deliberately: dropping it is a dependency removal, not scaffold alignment, and it would churn the root lockfile for no behaviour change. `doc/tsconfig.json`, `doc/pages/`, and `doc/src/styles/global.css` are now byte-identical to the 5.18.2 reference scaffold.

## create-zudo-doc (setup-doc-skill.sh)

- repo: zudolab/zudo-doc
- what: generated doc skill setup script, customized
- files: doc/scripts/setup-doc-skill.sh
- source: packages/create-zudo-doc/templates/base/scripts/setup-doc-skill.sh
- track: releases
- pinned: unknown
- observed-head: 325288eca0f2e0fe101228f147c601b1fe1ed4c5 (recorded 2026-09-07)
- updated: 2026-09-07
- sync: pnpm dlx create-zudo-doc@<ver> <scratch>/ref-doc --yes --pm pnpm --no-install …  # inspect the generated script, then three-way merge
- notes: deliberately NOT synced, re-examined against the 5.18.2 generated script. Still-valid reasons: the host pins the stable "doc-wisdom" skill name (upstream derives `<projectName>-wisdom` from `@zudo-sg/doc`, which fails the script's own skill-name validation and would break user-level links), and upstream's config-driven locale map stays inert because `doc/zfb.config.ts` declares no `locales`. NO LONGER a divergence: the nested-workspace `REPO_ROOT` / `PROJECT_PREFIX` resolution is now identical upstream. Upstream-only at 5.18.2 and NOT adopted here: `...zudoDoc({})` spread-aware top-level setting detection, a "no explicit locale settings found" stderr note, and an `ensure_symlink` that refuses to delete a non-symlink instead of `rm -rf`-ing it. That last one is a real safety improvement — adopt as a follow-up, not in a dependency round.

## create-zudo-doc (claude skills)

- repo: zudolab/zudo-doc
- what: generated Claude Code skills, customized
- files: .claude/skills/zudo-doc-design-system/, .claude/skills/zudo-doc-translate/, .claude/skills/zudo-doc-version-bump/
- source: packages/create-zudo-doc/templates/features/claudeSkills/files/.claude/skills/
- track: releases
- pinned: unknown
- observed-head: 325288eca0f2e0fe101228f147c601b1fe1ed4c5 (recorded 2026-09-07)
- updated: 2026-09-07
- sync: pnpm dlx create-zudo-doc@<ver> <scratch>/ref-doc --yes --pm pnpm --no-install …  # inspect generated skills, then three-way merge
- notes: deliberately NOT synced, re-examined against the 5.18.2 generated skills — the three templates are byte-identical between 5.16.1 and 5.18.2, so there is nothing new upstream to merge. Confirmed project rules: design-system carries the two token worlds + accent budget; version-bump is adapted for no `scripts/version-bump.sh`, a single changelog `index.mdx`, and no JA locale (`locales: {}`) — that last clause was previously misattributed to translate. Flagged, NOT adopted: the host `zudo-doc-translate` copy is a stale pre-generalization upstream version that describes `src/content/docs-ja/` and `src/config/settings.ts`, neither of which exists here; upstream's current locale-agnostic text is the better base. Follow-up.
