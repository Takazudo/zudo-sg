---
description: >-
  Release @takazudo/zudo-sg or create-zudo-sg end-to-end. The default engine
  path bumps packages/styleguide/package.json, writes an English changelog
  page, regenerates packages/styleguide/CHANGELOG.md, runs the local quality
  gate, commits + pushes to main, waits for CI, pushes the v* tag (which
  triggers the engine npm publish workflow), watches it to success, then
  creates the GitHub Release. An explicit create-zudo-sg/initializer request
  selects the initializer path in the "Releasing create-zudo-sg" section.
  Both packages are STABLE-ONLY: every release is a clean X.Y.Z on npm
  `latest`. The single human gate is the release proposal; confirming it
  authorizes the whole flow through publish. Triggers on "bump version", "cut
  a release", "release zudo-sg", "release create-zudo-sg", "release the
  initializer", and "make a release".
user-invocable: true
argument-description: >-
  Optional: major, minor, patch — force a direct bump at that level (Scheme B
  override). No argument — commit-judged bump against the last tag in the
  selected package's namespace (breaking commit -> minor, else -> patch). No
  tag exists yet for that package -> cold-start first release, normally 0.1.0,
  with the full proposal gate (see Steps 1–2).
  An explicit `create-zudo-sg` or `initializer` request selects that package's
  release path; otherwise the styleguide engine is selected. Or: cancel — abort
  a not-yet-published release.
---

# /l-make-release

End-to-end release orchestrator for `@takazudo/zudo-sg`, the styleguide engine
package at `packages/styleguide`, or (when explicitly requested) the
`create-zudo-sg` initializer at `packages/create-zudo-sg`. The engine path
bumps the version, writes an English changelog page, regenerates
`packages/styleguide/CHANGELOG.md`, runs the local quality gate, commits +
pushes to `main`, waits for CI, then **pushes the `v<version>` tag** — which
triggers `.github/workflows/publish-zudo-sg.yml` (build + verify + `pnpm
publish`) — watches that run to success, and creates the GitHub Release. The
initializer path is documented in [Releasing create-zudo-sg](#releasing-create-zudo-sg).
**One invocation takes the selected release all the way to npm.**

## Selecting the package

The package is selected before Step 1 and the choice applies to the entire
invocation:

- An explicit `create-zudo-sg` or `initializer` request selects
  `packages/create-zudo-sg` and its `create-zudo-sg-vX.Y.Z` tag workflow.
- A generic release request, or a request naming `@takazudo/zudo-sg`, selects
  the styleguide engine and follows the existing `vX.Y.Z` flow below.
- If a request names both packages, stop at the proposal and ask which one to
  release; never mix their version sources, changelogs, tags, or workflows.

The selected package's version is the only version this skill bumps. The root
`package.json` is never a release version source.

## What the engine package is

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
flow — version + changelog, push, CI, tag, publish, and GitHub Release. Do not
add a second "push the tag now?" prompt. A **build/test/pack failure** (Step 4),
**CI failure** (Step 6), or **publish-workflow failure** (Step 8) must be
resolved before advancing — see [Failure Recovery](#failure-recovery).

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
succeeds, or after recovery verifies that the exact version reached npm
despite a failed run. The irreversible step is the **tag push**; confirming
the Step 2 proposal is what authorizes it.

## Boundaries

- The skill never runs `npm publish` / `pnpm publish` directly — the selected
  package's publish workflow does that after the tag push.
- npm cannot re-publish a version. If the publish workflow fails **after** the
  tag is pushed (Step 8), check the registry before deciding whether the
  unchanged run can be retried — see [Failure Recovery](#failure-recovery).
  Never move a pushed release tag to another commit.
- The engine path never mutates the root `package.json`, `apps/demo`, `doc/`,
  or `packages/demo-ui`; the explicitly selected initializer path additionally
  mutates only `packages/create-zudo-sg/package.json`, its changelog, and its
  release-generated artifacts.

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
6. Confirm the publish credentials with the operator at **npmjs.com**: the
   `NPM_TOKEN` repo secret must be a current **granular access token**, with
   **Read and write (publish and stage)** access covering `@takazudo` (and
   creation of `@takazudo/zudo-sg` for the first publish), and **Bypass 2FA**
   enabled. GitHub/CI cannot reveal a stored secret's value or token type;
   seeing its name in `gh secret list` is not proof of these settings. Check
   expiry and package publishing permissions too. Once the package exists,
   a configured **Trusted Publisher** may provide OIDC authentication
   instead; `id-token: write` and `--provenance` alone do not configure it.
   See `packages/styleguide/RELEASE.md` for the current token guidance and
   the post-first-publish migration.

### Select first release, normal bump, or resume candidate

A previous run may have committed the version bump without pushing the tag
(e.g. CI on the bump was still running when the prior run ended). **Check for
any `v*` tag before treating a missing current-version tag as a resume.** The
seeded `0.1.0` was introduced with the package; that commit is not a release.
Every path requires a clean tree: if `git status --porcelain` is non-empty,
stop and ask the user to commit, stash, or discard before re-running.

```bash
CUR=$(node -p "require('./packages/styleguide/package.json').version")
BASE_TAG=$(git tag -l 'v*' --sort=-v:refname | head -1)
if [ -z "$BASE_TAG" ]; then
  RELEASE_MODE=first
elif git show-ref --verify --quiet "refs/tags/v$CUR"; then
  RELEASE_MODE=bump
else
  RELEASE_MODE=resume-candidate
fi
```

- **`first` — no `v*` tag exists at all**: always go to **Step 2**, even if a
  previous attempt prepared a release commit. Analyze the package history,
  propose the first version, and wait for the normal confirmation. Never
  offer to tag the package-introduction commit or skip the changelog, quality
  gate, or release commit. Non-release tags such as `_attachments` do not
  change this decision.
- **`bump` — `v$CUR` exists**: proceed to Step 2 for a normal bump. If this is
  recovery from a failed publish, use [Failure Recovery](#failure-recovery)
  first; a tag alone does not prove the version reached npm.
- **`resume-candidate` — at least one `v*` tag exists, but `v$CUR` is absent**:
  identify the commit that introduced the current version (not necessarily
  `HEAD`):

  ```bash
  BUMP_SHA=$(git log -1 --format=%H -S"\"version\": \"$CUR\"" -- packages/styleguide/package.json)
  git show --stat "$BUMP_SHA"
  git show "$BUMP_SHA:packages/styleguide/package.json"
  git show "$BUMP_SHA:doc/src/content/docs/changelog/zudo-sg/$CUR.mdx"
  git show "$BUMP_SHA:packages/styleguide/CHANGELOG.md"
  ```

  Resume only if the commit is identifiable as this skill's completed
  preparation: subject `chore(release): @takazudo/zudo-sg v<current>`, the
  matching manifest version, a dated changelog page with no `unreleased`
  placeholder, and the generated CHANGELOG entry. If any evidence is missing,
  take Step 2's proposal path instead. Also check the exact version with
  `npm view "@takazudo/zudo-sg@$CUR" version --registry=https://registry.npmjs.org/`;
  a published version or an inconclusive query goes to Failure Recovery,
  never a new tag push.

  Present a resume proposal naming the version and `$BUMP_SHA` and require
  confirmation unless that exact resume is already authorized in this
  session. Re-run **Step 4** on that tree, ensure the selected commit is on
  `origin/main`, then continue at **Step 6**, tagging only the verified SHA.
  If `$BUMP_SHA` is not `HEAD`, surface the later commits and let the user
  choose the original release tree or a fresh proposal including them. Do
  not validate `HEAD` and then tag a different, unverified tree.

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
  Include that introduction commit itself in the first-release analysis
  (`git show "$BASE_SHA"`); `BASE_SHA..HEAD` otherwise omits it.

  Verify that the registry agrees this is a first release:

  ```bash
  npm view @takazudo/zudo-sg versions --json --registry=https://registry.npmjs.org/
  ```

  A confirmed package-not-found `E404` is expected. If versions already
  exist, stop and reconcile the missing tag history using Failure Recovery;
  do not publish a new "first" version. Authentication, network, or registry
  errors are inconclusive, not proof of absence.

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

**First release (`RELEASE_MODE=first`)** — normally propose **`0.1.0`**, the
seeded unreleased entry, even though `package.json` already says `0.1.0`.
Finalizing that version is a release; do not manufacture `0.1.1` just because
the initial manifest already has a version. Still analyze all the engine
history and show the proposal gate. A Scheme B breaking-change judgement may
propose `0.2.0`, but state the concrete reason in the proposal. An explicit
`major` / `minor` / `patch` argument overrides this default as below.

If a prior attempt already prepared another version with no `v*` tags, stay
on this cold-start path, explain whether that unpublished version is being
retained or increased, and obtain fresh confirmation. Never silently lower
it back to `0.1.0` or skip Steps 2–5.

**Later releases, no argument** — judge the level from the categorization above:

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
(`packages/styleguide/package.json`'s `version`) **except on the cold-start
first-release path**, where retaining the unpublished current version is
allowed. A lower version is never allowed. Show an error with both versions
if validation fails.

Before proposing any version, check it with
`npm view "@takazudo/zudo-sg@<proposed>" version --registry=https://registry.npmjs.org/`.
Only a confirmed not-found response permits publishing it. If it resolves,
the version is already live: use Failure Recovery and do not re-publish or
move a tag. If the query fails for any other reason, stop until its result
can be established.

### Present the proposal

```
Proposed release: @takazudo/zudo-sg <current> -> <new> (<first release|breaking|feature|fix|patch>, Scheme B)

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

For the default bootstrap, say `Proposed first release: @takazudo/zudo-sg
0.1.0 (retain seeded version; finalize the unreleased changelog)`. An unchanged
version number does not waive this gate.

## Step 3: Bump + changelog

### 3a. Bump the version

Update `version` in `packages/styleguide/package.json` to the confirmed new
version (no `v` prefix). For the default first release, retain `0.1.0` and
continue with the changelog and checks. The root `package.json` is NOT touched.

After changing the engine version, regenerate the committed initializer
template and keep that generated change in the same release commit:

```bash
pnpm sync:create-template
pnpm check:create-template
```

The sync writes the template dependency as the caret range `^<engine version>`.
That is a range, not an exact pin: a later compatible engine patch may resolve
from npm without another initializer release. Do not hand-edit it to remove
the caret. If the sync changes more than the expected generated template
files, stop and inspect the diff before continuing.

### 3b. Write the English changelog page

Create `doc/src/content/docs/changelog/zudo-sg/<version>.mdx`. On the **very
first real release**, finalize the seeded
`doc/src/content/docs/changelog/zudo-sg/0.1.0.mdx` placeholder in place (its
`Released: unreleased` line and the sentence "Finalized by `/l-make-release`
when the first version actually ships" both get replaced). If the confirmed
first version is different, rename that seed to `<version>.mdx`, update its
title and description, and retain `sidebar_position: 1`; do not leave a
fictional unreleased `0.1.0` entry behind. Stage both sides of the rename in
Step 5. On a restarted first attempt, edit the prepared page for that version
instead of duplicating it.

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
  highest value for a new release page (the first release keeps the seed's
  `1`, the second release is `2`, and so on). Note this is independent of
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
  doc/src/content/docs/changelog/zudo-sg/<version>.mdx \
  packages/create-zudo-sg/templates/default
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

If it fails, first run the exact-version registry check in
[Failure Recovery](#failure-recovery). The job may have failed after npm
accepted the version. Continue to Step 9 only after publication is confirmed;
otherwise inspect the logs and follow the applicable recovery path.

## Step 9: Create the GitHub Release

The publish succeeded, or Failure Recovery confirmed the exact version is
live. Keep the existing release tag; if it is missing or disagrees with the
published commit, stop and reconcile that history rather than re-tagging.
Check `gh release view "v<version>"` first and reuse an existing Release.
Otherwise extract the changelog body (everything after the frontmatter) as
release notes:

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
URL, the GitHub Release URL).

After the **first** successful publish, recommend configuring **Trusted
Publishing (OIDC)** for `Takazudo/zudo-sg` and `publish-zudo-sg.yml` in the
package's npm settings, allowing direct publishing for this workflow. It
already has `id-token: write` and `--provenance`; the npm-side trust still has
to be configured and verified before retiring `NPM_TOKEN`. Follow the
migration notes in `packages/styleguide/RELEASE.md`. This is a recommendation,
not an automatic account-setting change. Then **STOP**.

## Releasing create-zudo-sg

Use this path only when the request explicitly names `create-zudo-sg` or the
initializer. It is independent of the engine's `v*.*.*` release stream:

- The version source of truth is `packages/create-zudo-sg/package.json`.
  Bump that package only; do not bump the root manifest or
  `packages/styleguide/package.json`.
- The release changelog is `packages/create-zudo-sg/CHANGELOG.md`. Add the
  confirmed version's entry there before the release commit. On the first
  release, the seeded `0.1.0` may be retained and finalized rather than
  automatically becoming `0.1.1`; still use the proposal gate and create the
  changelog entry.
- This package is stable-only. Use a clean `X.Y.Z` and the exact tag
  `create-zudo-sg-vX.Y.Z`; there is no prerelease or `next` channel. The
  proposal considers initializer tags (`create-zudo-sg-v*`), not engine tags
  (`v*`).

For Steps 1–2, apply the same clean-tree, registry, Scheme B, and explicit
confirmation rules as the engine path, but substitute the initializer's
package and tag namespace throughout. Judge the release against commits that
touch `packages/create-zudo-sg/**`, the template sync/gate, or its publish
workflow. If no `create-zudo-sg-v*` tag exists, this is the initializer's first
release: normally propose the seeded `0.1.0` and finalize its changelog entry;
do not use an existing engine `v*` tag as the initializer's base. For a later
release, use the latest `create-zudo-sg-v*` tag and the same breaking-change
minor / otherwise patch judgement unless the user explicitly chooses a bump.

The template's engine dependency must remain the caret range `^X.Y.Z`, not an
exact pin. A create-zudo-sg release does not replace that range with the
initializer's version. Before committing, run the package check and both
initializer gates:

```bash
pnpm --filter create-zudo-sg check
pnpm check:create-template
pnpm verify:create-zudo-sg --published-engine
```

`check:create-template` proves the committed template matches the fixture and
that its shipped engine dependency is the intended caret range. The
`--published-engine` verifier packs the initializer, scaffolds an unmodified
template, installs that range from the npm registry, and builds the foreign
host. Do not replace it with the normal verifier's local engine tarball for a
release gate; if the registry cannot resolve the published engine, stop and
resolve that release dependency first.

After the proposal is confirmed and the local gates pass, commit the package
manifest and changelog, push `main`, and wait for CI on that commit. Push only
the verified commit as the package tag:

```bash
git tag "create-zudo-sg-v<version>" "$BUMP_SHA"
git push origin "create-zudo-sg-v<version>"
```

That tag triggers `.github/workflows/publish-create-zudo-sg.yml`. Watch the
run by workflow and the tagged commit, then wait for success before creating
or reusing the matching GitHub Release:

```bash
gh run list --workflow publish-create-zudo-sg.yml --limit 15 \
  --json databaseId,headSha
gh run watch <publish-run-id> --exit-status
```

The workflow is deliberately guarded: a manual dispatch must target an exact
`create-zudo-sg-vX.Y.Z` tag, and it validates that tag against
`packages/create-zudo-sg/package.json` before spending time on the build. If a
publish run fails after the tag is pushed, check the exact version first:

```bash
npm view "create-zudo-sg@<version>" version --registry=https://registry.npmjs.org/
```

If npm returns that version, treat it as published: never re-tag, delete the
tag, or re-run the publish job. If npm confirms the version is absent and the
failure is transient or credential-only, correct the cause and retry the
unchanged tag through the guarded manual dispatch:

```bash
gh workflow run publish-create-zudo-sg.yml --ref "create-zudo-sg-v<version>"
```

The workflow's dispatch guard must reject branch refs; do not bypass it. A
code fix requires a new initializer version through the proposal gate, never
moving an existing release tag. Registry/network errors that do not establish
absence are inconclusive, so stop and recheck rather than retrying blindly.

After the first successful `create-zudo-sg` publish, perform the one-time
follow-up from #739: remove the documentation note that the initializer is
“available from the first release.” Keep that docs chore separate from this
release workflow and do not repeat it on later releases.

## Cancelling a release

Use this for `/l-make-release cancel` or a mid-release problem. The tag push
(Step 7) is the irreversible boundary. For an initializer release, substitute
the `create-zudo-sg-v<version>` tag and initializer package/changelog files in
the cancellation steps below; never cancel it by touching an engine `v*` tag.

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
re-publish a live version. If the publish failed, check the registry and
follow [Failure Recovery](#failure-recovery). If it succeeded and needs
retracting, that's a manual `npm unpublish` / `npm deprecate` decision for
the user, outside this skill.

## Failure Recovery

**First, for any failure after tagging, check whether npm accepted the version:**

```bash
npm view "@takazudo/zudo-sg@<version>" version --registry=https://registry.npmjs.org/
```

- **Resolves to `<version>`** — the version is live, even if the workflow is
  red. Never re-tag, delete its tag, re-publish, or re-run its publish job.
  Keep the published commit and continue at **Step 9** to finish or reuse the
  GitHub Release, then verify/report in Step 10. A missing or mismatched tag
  requires reconciliation before creating the Release.
- **Confirmed not found (`E404`, including no matching version)** — inspect
  `gh run view "$PUBLISH_RUN" --log-failed` and use the unpublished recovery
  paths below. Repeat the registry check immediately before any retry.
- **Authentication/network/registry error or ambiguous output** — publication
  status is unknown. Stop and recheck when the registry is reachable; never
  infer "unpublished" from a failed command or a failed Actions job.

- **Build/test/pack failure (Step 4)** — stop and report. Do not commit. Fix
  and re-run. Nothing reached the remote.
- **CI fails on the bump commit (Step 6)** — fix, commit, push, re-watch. Do
  not push the tag until CI is green.
- **Wrong version proposed** — caught at the Step 2 gate. If already committed
  but the tag was NOT pushed, use [Cancelling a release](#cancelling-a-release)
  to revert and re-run.
- **Publish workflow fails and the version is confirmed absent (Step 8)**:
  - **Transient** (registry hiccup, runner eviction) — retry the unchanged
    workflow at the same tag: `gh run rerun "$PUBLISH_RUN"`, then return to
    Step 8. Retry only while the version is still confirmed absent.
  - **Needs a code fix** — leave the pushed tag on its original commit. Fix
    the code on `main`, then re-run `/l-make-release` for a **new version**
    through the proposal gate. Never delete/recreate a release tag to point
    it at different content.
  - **OTP / `EOTP` / 2FA or token-permission error** — check the granular
    token's expiry, publish rights covering `@takazudo`, and **Bypass 2FA**
    setting at npmjs.com (or the configured Trusted Publisher). Correct the
    credential and update `NPM_TOKEN` if needed; this alone does not need a
    code change or a moved tag. Recheck npm, then retry the unchanged run
    only if the version remains absent.

See `packages/styleguide/RELEASE.md` for the same recovery paths without the
skill's step numbering — useful when recovering by hand.
