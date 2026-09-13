---
description: >-
  Release @takazudo/zudo-sg end-to-end — bump packages/styleguide/package.json,
  write an English changelog page, regenerate packages/styleguide/CHANGELOG.md,
  run the local quality gate, commit + push to main, wait for CI, push the v*
  tag (which triggers the npm publish workflow), watch it to success, then
  create the GitHub Release. STABLE-ONLY: this package has no `next`/prerelease
  channel at all — every release is a clean X.Y.Z on npm `latest`. Pre-1.0
  version judgement is Scheme B (breaking commit -> minor bump, everything else
  -> patch), not standard SemVer. The single human gate is the Step 3
  version-bump proposal; confirming it authorizes the whole flow through
  publish. Triggers on "bump version", "cut a release", "release zudo-sg",
  "make a release".
user-invocable: true
argument-description: >-
  Optional: major, minor, patch — force a direct bump at that level (Scheme B
  override). No argument — commit-judged bump against the last v* tag (breaking
  commit -> minor, else -> patch). No v* tag exists yet -> commits since the
  package's own first commit are analyzed (see Step 1). Or: cancel — abort a
  not-yet-published release.
---

# /l-make-release

End-to-end release orchestrator for `@takazudo/zudo-sg`, the styleguide engine
package at `packages/styleguide`. It bumps the version, writes an English
changelog page, regenerates `packages/styleguide/CHANGELOG.md`, runs the local
quality gate, commits + pushes to `main`, waits for CI, then **pushes the
`v<version>` tag** — which triggers `.github/workflows/publish-zudo-sg.yml`
(build + verify + `pnpm publish`) — watches that run to success, and creates
the GitHub Release. **One invocation takes the release all the way to npm.**

## What this package is

- **Single npm package**: `@takazudo/zudo-sg`, at `packages/styleguide/`.
  **Version source of truth is `packages/styleguide/package.json`**'s
  `version` field. The root `package.json` stays `private: true` and is
  **never** touched by this skill — the styleguide host site, `apps/demo`,
  `doc/`, and `packages/demo-ui` all have their own lifecycle and are not part of
  this release.
- **Stable only** (ADR `docs/adr/styleguide-engine.md` decision 12). There is
  **no `next` dist-tag, no prerelease suffix, no `next`/`stable` argument** for
  this package — unlike the zdtl/zudo-doc release skills this one is modeled
  on. `v*.*.*` always publishes to npm `latest`.
- **Pre-1.0 version judgement is Scheme B**, not standard SemVer conventional
  commits: a breaking-change commit bumps **minor** (not major — the major
  stays at `0` through the whole `0.x` line), everything else bumps **patch**.
  There is no `feat: -> minor` rule here.

## Invocation & confirmation

This skill is **model-invocable**: a rough natural-language request like "bump
version", "cut a release", or "release zudo-sg" may trigger it. It must never
mutate anything before the user explicitly confirms. Steps 1–2 are read-only
(preconditions, version computation + change analysis); the first mutation is
Step 3.

There is **one gate**: the Step 2 proposal. Confirming it authorizes the whole
flow — bump, push, CI, tag, publish, and GitHub Release. Do not add a second
"push the tag now?" prompt. The only things that can halt the flow after
confirmation are a **build/test/pack failure** (Step 5, before anything is
pushed) or a **publish-workflow failure** (Step 9, after the tag is pushed) —
see [Failure Recovery](#failure-recovery).

**Cancel mode.** `/l-make-release cancel` (or "cancel/abort the release") does
NOT bump anything — it jumps straight to
[Cancelling a release](#cancelling-a-release) to undo a not-yet-published
release.

## How publishing works (read before changing anything)

```
/l-make-release  ->  confirm bump (Step 2)  ->  bump + changelog + commit + push main  ->  CI green
                                                                                            │
                                                    skill pushes:  git push origin v<version>
                                                                                            │
                                                    .github/workflows/publish-zudo-sg.yml fires
                                                                                            │
                                                    builds + verifies + `pnpm publish`  ->  npm
                                                                                            │
                                                    skill watches the run, then creates the GitHub Release
```

The publish workflow triggers on a pushed `v*.*.*` tag — NOT on a GitHub
Release. The skill creates the GitHub Release **after** the publish run
succeeds, so a failed publish leaves no orphaned Release. The irreversible
step is the **tag push**; confirming the Step 2 proposal is what authorizes
it.

## Boundaries

- The skill never runs `npm publish` / `pnpm publish` directly — that is
  `publish-zudo-sg.yml`'s job, triggered by the tag push.
- npm cannot re-publish a version. If the publish workflow fails **after** the
  tag is pushed (Step 9), the fix is to cut a **new** version, not retry the
  same one — see [Failure Recovery](#failure-recovery).
- This skill never mutates the root `package.json`, `apps/demo`, `doc/`, or
  `packages/demo-ui` — the styleguide engine is the only release surface here.

## Step 1: Preconditions

Verify ALL of the following. If any check fails, stop with a clear message.

1. Current branch is `main` (`git branch --show-current`).
2. `gh` CLI is authenticated (`gh auth status`).
3. Local `main` is up to date with `origin/main` (`git fetch origin && git status -sb`). If behind, pull first.
4. Fetch tags so the changelog base is correct: `git fetch --tags origin`.
5. Latest CI on `main` is green — this repo has no single "test" workflow that
   runs on push to `main`; check every workflow run at the current `main` HEAD:

   ```bash
   gh run list --branch main --limit 5 --json name,status,conclusion,headSha
   ```

   All runs at the current head SHA must show `conclusion: success` (most
   commonly `Production Deploy`, `main-deploy.yml`). If anything is still
   `in_progress` or non-success, stop and report it rather than releasing
   against unverified `main`.

### Resume detection (run before requiring a clean tree)

A previous run may have committed the version bump without pushing the tag
(e.g. CI on the bump was still running when the prior run ended). Detect this
before assuming a cold start:

```bash
git fetch --tags origin
CUR=$(node -p "require('./packages/styleguide/package.json').version")
git tag -l "v$CUR"   # empty output = no tag yet for the current version
```

- **If `v$CUR` does NOT exist**: the current version is un-tagged. Check the
  working tree first:
  - **Dirty** (`git status --porcelain` non-empty) -> **STOP**. Ask the user
    to commit, stash, or discard before re-running; do NOT resume or bump
    over a dirty tree.
  - **Clean** -> this is a RESUME. Find the commit that introduced the current
    version (do NOT assume it is `HEAD`):

    ```bash
    BUMP_SHA=$(git log -1 --format=%H -S"\"version\": \"$CUR\"" -- packages/styleguide/package.json)
    ```

    Offer to RESUME from `$BUMP_SHA` — this skips Steps 2–4 (bump / changelog /
    commit) and continues from **Step 6** (CI wait) onward, tagging `$BUMP_SHA`.
    If `$BUMP_SHA` is not `HEAD`, later commits landed on top — surface that and
    let the user choose: tag `$BUMP_SHA` as-is, or abort and cut a fresh bump
    that includes the newer commits.
- **If `v$CUR` already exists**: the current version is released. Proceed with
  a normal cold-start bump (Steps 2–4). Require a clean working tree here too.

## Step 2: Determine the next version and propose — THE GATE

### Find the changelog base

```bash
git tag -l 'v*' --sort=-v:refname | head -1
```

- **A `v*` tag exists** -> base = that tag. Normal case.
- **No `v*` tag exists at all** -> this is the **first release**. There is no
  bootstrap tag to fall back to (unlike the zdtl model, which assumes an
  initial `v1.0.0` was created by hand — this repo does not: the stray
  `v0.1.0` tag was deliberately deleted, see #179). Instead, the base is the
  commit that introduced the package itself:

  ```bash
  BASE_SHA=$(git log --diff-filter=A --format=%H --follow -- packages/styleguide/package.json | tail -1)
  ```

  This finds the first commit that ever added
  `packages/styleguide/package.json` — i.e. "all of history since the engine
  was born" — with no dependency on knowing which PR merged the epic.

### Analyze commits since the base

```bash
git log "${BASE_TAG:-$BASE_SHA}..HEAD" --oneline   # human-readable proposal list (subject + hash)
git log "${BASE_TAG:-$BASE_SHA}..HEAD"             # full form, read commit bodies too — a
                                                    # `BREAKING CHANGE:` footer can appear under a
                                                    # plain `feat:`/`fix:` subject with no `!`
```

Categorize each commit (read both subject and body — do not rely on
`--oneline` alone):

- **Breaking Changes**: `!` before the colon (`feat!:`, `fix(scope)!:`) OR a
  `BREAKING CHANGE` footer in the body.
- **Features**: `feat:` prefix (including `feat(scope):`).
- **Bug Fixes**: `fix:` prefix (including `fix(scope):`).
- **Other Changes**: everything else (`docs:`, `chore:`, `refactor:`, `ci:`,
  `test:`, `style:`, `perf:`, …).

Only commits that touch `packages/styleguide/**`, `.github/workflows/publish-zudo-sg.yml`,
or other engine-relevant paths are release-worthy for this package's own
changelog entry — but the **version-level judgement below still runs over the
full commit range** (a breaking commit anywhere in that range is a signal
worth surfacing even if narrowly scoped; use judgement when a change is
obviously unrelated to the engine, e.g. a pure `apps/demo` or `doc/` content
commit, and exclude it from both the level judgement and the changelog draft).

### Determine the version (Scheme B, pre-1.0)

Every argument sets **which component bumps**; there is no channel argument at
all — everything lands on `latest`.

**No argument** — judge the level from the categorization above:

- any **Breaking Change** -> **minor** bump (`0.Y.Z` -> `0.(Y+1).0`) — the
  major stays at `0`, per Scheme B; a breaking `0.x` change does NOT jump to
  `1.0.0`.
- else (any `feat:`, `fix:`, or only `Other Changes`) -> **patch** bump
  (`0.Y.Z` -> `0.Y.(Z+1)`).
- **No-qualifying-commits case**: if the range has nothing above
  `docs:`/`chore:`/`refactor:`/`ci:`/`test:`/etc. (no `feat:`, `fix:`, or
  breaking commit at all), the "else -> patch" rule still applies, but flag it
  explicitly at the proposal: "No feat:/fix:/breaking commits found since
  `<base>` — proposing a patch bump. Confirm this is intended."

**`major` / `minor` / `patch` argument** — force that exact bump on the
current version's triple, ignoring the commit judgement:

- `major`: `{X+1}.0.0` — the explicit escape hatch for a deliberate jump to
  `1.0.0` (or any other major), since Scheme B's auto-judgement never proposes
  one on its own.
- `minor`: `X.{Y+1}.0`
- `patch`: `X.Y.{Z+1}`

There is no `next`, `stable`, or any other argument — this package has no
prerelease channel to opt into.

### Validation

The computed version must be strictly greater than the current version
(`packages/styleguide/package.json`'s `version`). If not, stop with an error
showing both versions.

### Present the proposal

```
Proposed bump: @takazudo/zudo-sg <current> -> <new> (<breaking|feature|fix|patch>, Scheme B)

Breaking Changes:
- description (hash)

Features:
- description (hash)

Bug Fixes:
- description (hash)

Other Changes:
- description (hash)
```

Only show sections with entries. **Wait for explicit user confirmation before
proceeding to Step 3.** Confirming here authorizes the full flow through
`pnpm publish` and the GitHub Release.

## Step 3: Bump + changelog

### 3a. Bump the version

Update `version` in `packages/styleguide/package.json` to the confirmed new
version (no `v` prefix). The root `package.json` is NOT touched.

### 3b. Write the English changelog page

Create `doc/src/content/docs/changelog/zudo-sg/<version>.mdx`. On the **very
first real release**, this is the seeded `doc/src/content/docs/changelog/zudo-sg/0.1.0.mdx`
placeholder — finalize it in place rather than creating a second file (its
`Released: unreleased` placeholder line and the sentence "Finalized by
`/l-make-release` when the first version actually ships" both get replaced).

Frontmatter (match the existing file's shape):

```mdx
---
title: <version>
description: <one-line summary of the release>
sidebar_position: <computed — see below>
pagination_next: null
---

Released: <YYYY-MM-DD>

<one or two sentence intro>

### Features        ← omit section if empty

- entry

### Bug Fixes       ← omit section if empty

- entry
```

- `sidebar_position`: standard ascending order (root `CLAUDE.md`: "Sidebar
  order is driven by `sidebar_position`") — read every existing file under
  `doc/src/content/docs/changelog/zudo-sg/` and use one past the current
  highest value (the seeded `0.1.0.mdx` starts at `1`, so the first real
  second release is `2`, and so on). Note this is independent of
  `packages/styleguide/CHANGELOG.md`'s own ordering — that file is generated
  by sorting the `title` fields as semver, newest first, regardless of
  `sidebar_position` (`doc/src/content/docs/changelog/zudo-sg/*.mdx` ->
  the `changelog` build plugin), so getting `sidebar_position` slightly wrong
  would only affect the doc site's sidebar, not the generated CHANGELOG.
- **Avoid bare `<Uppercase...>` generics in prose** — the MDX sanitizer strips
  them even inside inline code (e.g. write "a Preact component", not
  `<Component>`, unless it's inside a real fenced code block).
- Prose only needs Features / Bug Fixes sections that actually contain
  engine-relevant entries from Step 2's categorization; drop `Breaking
  Changes` / `Other Changes` headings if nothing landed there for this
  package specifically.

### 3c. Regenerate `packages/styleguide/CHANGELOG.md`

No dedicated `pnpm gen:changelog` script exists in this repo — the changelog
is a postBuild side effect of the doc site's build (`doc/zfb.config.ts`'s
`changelogs` entry, `sourceDir: "src/content/docs/changelog/zudo-sg"` ->
`outputFile: "../packages/styleguide/CHANGELOG.md"`):

```bash
pnpm build:doc
```

Confirm `packages/styleguide/CHANGELOG.md` now contains the new version's
entry before proceeding.

## Step 4: Local quality gate

```bash
pnpm b4push
```

This runs the full local gate (format, lint:tokens, codegen drift, typecheck,
unit tests, build, demo build, link check, HTML validate, Playwright smoke,
and the doc site — see `scripts/run-b4push.sh`). If anything fails, stop and
tell the user. Do not commit. This is the last halt point before anything
reaches the remote.

Also run the release-specific artifact gate directly, since `b4push` does not
include it:

```bash
pnpm --filter @takazudo/zudo-sg check
pnpm verify:styleguide-install
bash scripts/check-pack.sh
```

## Step 5: Commit + push

```bash
git add packages/styleguide/package.json \
  packages/styleguide/CHANGELOG.md \
  doc/src/content/docs/changelog/zudo-sg/<version>.mdx
git commit -m "chore(release): @takazudo/zudo-sg v<version>"
git push origin main
BUMP_SHA=$(git rev-parse HEAD)
```

## Step 6: Wait for CI on the bump commit

```bash
gh run list --branch main --limit 5 --json name,status,conclusion,headSha
```

Poll until every run at `headSha == $BUMP_SHA` reports `conclusion: success`.
If CI fails, fix, commit, push, and re-watch — **refresh `BUMP_SHA` to the
commit whose CI actually passed** before tagging:

```bash
BUMP_SHA=$(git rev-parse HEAD)   # only after CI on THIS commit is green
```

Do not advance to the tag push until CI on the bump commit is green.

## Step 7: Push the tag (triggers the publish)

```bash
git tag "v<version>" "$BUMP_SHA"
git push origin "v<version>"
```

This fires `.github/workflows/publish-zudo-sg.yml`. Do NOT ask "push the tag
now?" — the Step 2 confirmation already authorized this.

## Step 8: Watch the publish workflow

Match the run by its **head commit**, not `headBranch` (often empty for tag
events):

```bash
PUBLISH_RUN=""
for i in $(seq 1 12); do
  PUBLISH_RUN=$(gh run list --workflow publish-zudo-sg.yml --limit 15 \
    --json databaseId,headSha \
    -q "[.[] | select(.headSha==\"$BUMP_SHA\")][0].databaseId")
  [ -n "$PUBLISH_RUN" ] && break
  sleep 5
done
if [ -z "$PUBLISH_RUN" ]; then
  echo "ERROR: could not find the publish-zudo-sg.yml run for v<version> (commit $BUMP_SHA)." >&2
  exit 1
fi
gh run watch "$PUBLISH_RUN" --exit-status
```

If it fails, surface the failing logs (`gh run view "$PUBLISH_RUN" --log-failed`)
and **stop** — do NOT create the GitHub Release. See
[Failure Recovery](#failure-recovery).

## Step 9: Create the GitHub Release

The publish succeeded. Extract the changelog body (everything after the
frontmatter) as release notes:

```bash
awk 'f; /^---$/{c++; if(c==2) f=1}' doc/src/content/docs/changelog/zudo-sg/<version>.mdx > /tmp/zudo-sg-release-notes.md
gh release create "v<version>" --verify-tag --title "@takazudo/zudo-sg <version>" \
  --notes-file /tmp/zudo-sg-release-notes.md
```

No `--prerelease` flag ever applies — this package has no prerelease channel.

## Step 10: Verify + report, then STOP

```bash
npm view "@takazudo/zudo-sg@<version>" version
npm dist-tag ls @takazudo/zudo-sg
```

`<version>` should show under **`latest`**. There is no `next` dist-tag to
check for staleness — this package never publishes one. Print a final report
(published version, npm package URL
`https://www.npmjs.com/package/@takazudo/zudo-sg`, the publish workflow run
URL, the GitHub Release URL), then **STOP**.

## Cancelling a release

Use this for `/l-make-release cancel` or a mid-release problem. The tag push
(Step 7) is the irreversible boundary.

### The tag has NOT been pushed yet (before Step 7)

1. Delete a local, unpushed tag if one was minted by mistake:
   `git tag -d v<version>`.
2. Decide whether to undo the bump commit:
   ```bash
   git rev-list --count <BUMP_SHA>..HEAD
   ```
   - `0` (bump is still HEAD) -> revert it (one commit reverts the version
     bump, `CHANGELOG.md`, and the changelog MDX page together):

     ```bash
     git revert --no-edit <BUMP_SHA>
     git push origin main
     ```
   - `>0` (buried under later commits) -> leave it. The stale version number
     is harmless; the next release simply supersedes it.

### The tag HAS been pushed (Step 7 done)

Treat the version as live. Do NOT delete the remote tag and do NOT attempt to
re-publish that version. If the publish failed, recover by cutting a **new**
version — see [Failure Recovery](#failure-recovery). If it succeeded and needs
retracting, that's a manual `npm unpublish` / `npm deprecate` decision for the
user, outside this skill.

## Failure Recovery

- **Build/test/pack failure (Step 4)** — stop and report. Do not commit. Fix
  and re-run. Nothing reached the remote.
- **CI fails on the bump commit (Step 6)** — fix, commit, push, re-watch. Do
  not push the tag until CI is green.
- **Wrong version proposed** — caught at the Step 2 gate. If already committed
  but the tag was NOT pushed, use [Cancelling a release](#cancelling-a-release)
  to revert and re-run.
- **Publish workflow fails after the tag was pushed (Step 8)** — the tag
  exists on the remote but the npm publish did not complete. Inspect
  `gh run view "$PUBLISH_RUN" --log-failed`.
  - **Transient** (registry hiccup, runner eviction) — re-run the same
    workflow: `gh run rerun "$PUBLISH_RUN"`. The version was never published,
    so a clean re-run can still succeed under the same tag.
  - **Needs a code fix** — the tag must move to a new commit; npm will not
    accept the same version twice:

    ```bash
    git push origin :refs/tags/v<version>
    git tag -d v<version>
    ```

    Fix the code, then re-run `/l-make-release` — resume detection picks the
    un-tagged bump back up.
- **OTP / `EOTP` / 2FA error in the publish step** — `NPM_TOKEN` is not an
  Automation-type token. Regenerate it as Automation at npmjs.com, update the
  repo secret (`gh secret set NPM_TOKEN`), then recover per the "code change"
  path above.

See `packages/styleguide/RELEASE.md` for the same recovery paths without the
skill's step numbering — useful when recovering by hand.
