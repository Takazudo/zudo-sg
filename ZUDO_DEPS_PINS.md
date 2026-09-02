# ZUDO_DEPS_PINS

## create-zudo-doc

- repo: zudolab/zudo-doc
- what: generated doc-site scaffold (doc/), customized
- files: doc/tsconfig.json, doc/pages/, doc/src/styles/global.css, doc/package.json, doc/.zudo-doc.json
- source: packages/create-zudo-doc/templates/base/, packages/create-zudo-doc/src/scaffold.ts
- track: releases
- pinned: 82811a8b7e6030fa759d823bd739307bca1480c3 (v5.16.1)
- updated: 2026-09-02
- sync: pnpm dlx create-zudo-doc@<ver> <scratch>/ref-doc --yes --pm pnpm --no-install …  # generate a reference, then three-way merge
- notes: local customizations to re-apply (`zfb.config.ts` site settings, `.htmlvalidate.json`, `wrangler.toml`, `DELETION_LEDGER.md`, `check:html` script + `html-validate` devDep, `scripts/run-b4push.sh`, `--strict-plain-css-imports` on the build script if step 5 landed, plus anything step 4 had to restore).

## create-zudo-doc (setup-doc-skill.sh)

- repo: zudolab/zudo-doc
- what: generated doc skill setup script, customized
- files: doc/scripts/setup-doc-skill.sh
- source: packages/create-zudo-doc/templates/base/scripts/setup-doc-skill.sh
- track: releases
- pinned: unknown
- observed-head: 82811a8b7e6030fa759d823bd739307bca1480c3 (recorded 2026-09-02)
- updated: 2026-09-02
- sync: pnpm dlx create-zudo-doc@<ver> <scratch>/ref-doc --yes --pm pnpm --no-install …  # inspect the generated script, then three-way merge
- notes: deliberately NOT synced at 5.16.1 — host pins the stable "doc-wisdom" skill name (the scoped @zudo-sg/doc name would produce an invalid dir and break user-level links) and resolves REPO_ROOT for the nested workspace; upstream's config-driven locale map is inert with locales: {}.

## create-zudo-doc (claude skills)

- repo: zudolab/zudo-doc
- what: generated Claude Code skills, customized
- files: .claude/skills/zudo-doc-design-system/, .claude/skills/zudo-doc-translate/, .claude/skills/zudo-doc-version-bump/
- source: packages/create-zudo-doc/templates/features/claudeSkills/files/.claude/skills/
- track: releases
- pinned: unknown
- observed-head: 82811a8b7e6030fa759d823bd739307bca1480c3 (recorded 2026-09-02)
- updated: 2026-09-02
- sync: pnpm dlx create-zudo-doc@<ver> <scratch>/ref-doc --yes --pm pnpm --no-install …  # inspect generated skills, then three-way merge
- notes: deliberately NOT synced — host copies carry project rules (design-system: two token worlds + accent budget; translate: no JA locale; version-bump: adapted for no scripts/version-bump.sh and a single changelog index.mdx).
