# Release runbook — `@takazudo/zudo-sg` and `create-zudo-sg`

This file is the **canonical release procedure** for both published packages.
Agent entry points are thin adapters over it and must not restate or override
its rules:

- Claude Code: `/l-make-release` (`.claude/skills/l-make-release/SKILL.md`)
- Codex (local or Cloud): `$zudo-sg-release` (`.agents/skills/zudo-sg-release/SKILL.md`)

Mechanical checks live in `scripts/release/release.mjs` (decision logic in
`scripts/release/release-lib.mjs`, tested by `scripts/__tests__/release.test.ts`).
Everything works from a fresh clone: no personal/global skills, no
home-directory paths, no npm login.

## Package contract

| | Engine | Initializer |
| --- | --- | --- |
| npm package | `@takazudo/zudo-sg` | `create-zudo-sg` |
| `--package` key | `engine` | `create-zudo-sg` (alias `initializer`) |
| Version source | `packages/styleguide/package.json` | `packages/create-zudo-sg/package.json` |
| Tag | `vX.Y.Z` | `create-zudo-sg-vX.Y.Z` |
| Publisher workflow | `.github/workflows/publish-zudo-sg.yml` | `.github/workflows/publish-create-zudo-sg.yml` |
| Changelog source (= Release notes) | `doc/src/content/docs/changelog/zudo-sg/X.Y.Z.mdx` (body after frontmatter) | `packages/create-zudo-sg/CHANGELOG.md` `## [X.Y.Z] - date` section |
| Generated changelog | `packages/styleguide/CHANGELOG.md` (via `pnpm build:doc`) | — |

The root `package.json` is private and never bumped. `apps/demo`, `doc/` and
`packages/demo-ui` have their own lifecycle and are not part of a release.

**Stable only** (ADR `docs/adr/styleguide-engine.md` decision 12). Every
release is a clean `X.Y.Z` on npm `latest`. There is no `next` dist-tag,
prerelease suffix, staged publish, or dist-tag cleanup. The publish workflows
enforce this in Actions, not only here.

## Authentication — npm Trusted Publishing only

Both publishers authenticate to npm **only** through npm Trusted Publishing
(GitHub OIDC). No workflow reads an npm token: there is no `NPM_TOKEN`,
`NODE_AUTH_TOKEN`, `registry-url` `.npmrc`, local `npm login`, or personal
PAT anywhere in the release path. The `publish` job alone holds
`id-token: write`.

pnpm (the repo's `packageManager`, 11.5.2) publishes natively and performs
the GitHub OIDC → npm token exchange itself; the exchanged token takes
precedence over any configured credential. (An npm CLI upgrade would not
change pnpm's behaviour.) Publication keeps `pnpm publish`, so `workspace:`
ranges are still rewritten, and `--provenance` stays explicit.

### Owner setup (npmjs.com, once per package)

Package → **Settings** → **Trusted publishing** → GitHub Actions:

| Field | `@takazudo/zudo-sg` | `create-zudo-sg` |
| --- | --- | --- |
| Organization or user | `Takazudo` | `Takazudo` |
| Repository | `zudo-sg` | `zudo-sg` |
| Workflow filename | `publish-zudo-sg.yml` | `publish-create-zudo-sg.yml` |
| Environment name | leave **blank** (the job uses no GitHub environment) | leave **blank** |
| Allowed actions | `npm publish` (direct publishing) | `npm publish` (direct publishing) |

Do **not** allow `npm dist-tag`: no workflow manages dist-tags. Fields are
case-sensitive and npm does not validate them until a publish runs.
`repository.url` in both manifests already matches
`https://github.com/Takazudo/zudo-sg`.

### Retiring the old credentials (owner, after each package's first OIDC publish)

Only after **both** packages have published through OIDC (see "Proving a
cutover" below):

1. Find every consumer of the npm token before revoking it — other
   repositories or secrets that reuse the same npm token. Migrate or
   deliberately keep those; do not leave a hidden fallback here.
2. Delete the repository secret: `gh secret delete NPM_TOKEN -R Takazudo/zudo-sg`
   (and any org/environment copy that reaches this repo).
3. Revoke the obsolete npm granular write token(s) at npmjs.com → Access Tokens.
4. For each package: **Settings → Publishing access → "Require two-factor
   authentication and disallow tokens"**. Trusted publishing keeps working.

### Proving a cutover

Use the package's next legitimate release; never cut a release only to prove
OIDC. Record, separately from public registry reads, dry-runs and
existing-version skips:

- the publish run ID and its `Publish package` step log (no `Skipped OIDC`
  warning; a successful `+ <name>@<version>`),
- the registry's publisher metadata for that version
  (`npm view <name>@<version> _npmUser --json`),
- the provenance attestation's tag and commit
  (`node scripts/release/release.mjs status --package <key> --version <version>`
  reports `identity=match`).

If the step fails with `Skipped OIDC: …` followed by an auth/`E404`/`ENEEDAUTH`
error, the trusted-publisher entry is missing or mismatched. Fix it on
npmjs.com and retry the same tag (see Recovery); no code change or new
version is needed.

## The procedure

There is **one release decision**: the operator invoking a release (or, with
Claude's `--confirm`, confirming its proposal). After it, run to completion
without further routine prompts. Releases normally run engine first, then
initializer.

### 1. Preconditions and resume point

```sh
git fetch origin --tags --prune
pnpm install --frozen-lockfile
node scripts/release/release.mjs preflight      # which GitHub/registry access this shell has
node scripts/release/release.mjs status --package engine
node scripts/release/release.mjs status --package create-zudo-sg
```

`status` derives the next stage only from durable state — manifest on
`origin/main`, the tag, the registry and the GitHub Release — so an
interrupted run resumes at the first missing stage:

| `stage` | Meaning | Continue at |
| --- | --- | --- |
| `prepare` | nothing release-specific on `main` yet | step 2 |
| `tag` | release commit on `main`, no tag | step 5 (needs `--sha`) |
| `publish` | tag exists, version not on npm | Recovery → retry the exact tag |
| `finalize` | published (provenance matches), no Release | Recovery → finalization |
| `done` | published and Release exists | nothing to do |
| `stop` | uncertain registry, foreign/unverifiable published version, or a tag at another commit | resolve by hand; never move a tag |

Pass `--version X.Y.Z` (and `--sha`) to inspect a specific release.
`status` needs read access to GitHub (`GH_TOKEN`/`GITHUB_TOKEN`, or `gh auth`).
Registry reads are public.

The working tree must be clean before preparing. Only an HTTP 404 (or a
readable packument without the version) counts as **not published**; network,
auth and server errors are **uncertain** and stop the run.

### 2. Select packages and versions

A combined run (no package named) judges both packages and releases each one
that has something to ship:

- **Engine** ships when commits since its last `v*` tag touch engine-relevant
  paths (`packages/styleguide/**`, its publish workflow, release helpers it
  depends on). Pure `apps/demo` / `doc/` content commits do not count.
- **Initializer** ships when there is no `create-zudo-sg-v*` tag yet; when
  commits since its last tag touch `packages/create-zudo-sg/**`, the template
  sync/gate scripts or its publish workflow (not counting an engine release's
  generated template-range rewrite); or when this run's engine bump is minor
  or major — the template's `^0.Y.Z` range cannot reach a new minor line. An
  engine patch alone does not need an initializer release.
- If neither has anything to ship, stop and say so.

**Version (Scheme B, pre-1.0)** per package, against that package's own tag
namespace (never the other package's tags):

- any breaking change (`!` before the colon, or a `BREAKING CHANGE` footer —
  read commit bodies, not just subjects) → **minor** (`0.Y.Z` → `0.(Y+1).0`);
- anything else → **patch**; if there are no `feat:`/`fix:`/breaking commits,
  say so explicitly in the proposal;
- an explicit `major` / `minor` / `patch` or an explicit `X.Y.Z` overrides the
  judgement (a jump to `1.0.0` is only ever explicit);
- with no tag in the namespace (first release), propose the seeded version and
  finalize its changelog entry rather than inventing a bump.

The version must be greater than the last released version and confirmed
**not found** on npm. Print the proposal (per package: `current → new`, the
level and why, commits grouped as Breaking / Features / Bug Fixes / Other,
and `Order: engine first, then create-zudo-sg`).

### 3. Prepare the release commit

```sh
node scripts/release/release.mjs prepare --package <key> --version X.Y.Z
```

`prepare` refuses a non-increasing or already-published version, writes the
manifest version and — for the engine — runs `pnpm sync:create-template` +
`pnpm check:create-template` so the generated initializer template's
`^X.Y.Z` engine range moves in the same commit. Never hand-edit the generated
template or remove the caret.

Then write the changelog source:

- **Engine** — `doc/src/content/docs/changelog/zudo-sg/X.Y.Z.mdx`, matching the
  previous page's shape (`title`, one-line `description`, `sidebar_position`
  one past the highest existing page, `pagination_next: null`), then
  `Released: YYYY-MM-DD`, a one/two-sentence intro, and only the non-empty
  `###` sections (`Breaking Changes`, `Features`, `Bug Fixes`, `Other
  Changes`). Avoid bare `<Uppercase…>` generics in prose (the MDX sanitizer
  strips them). Regenerate `packages/styleguide/CHANGELOG.md` with
  `pnpm build:doc`.
- **Initializer** — a `## [X.Y.Z] - YYYY-MM-DD` entry at the top of
  `packages/create-zudo-sg/CHANGELOG.md` (Keep a Changelog sections).

These sources become the GitHub Release notes verbatim. Check:

```sh
node scripts/release/release.mjs verify-prepared --package <key> --version X.Y.Z
```

### 4. Local gates

Engine:

```sh
pnpm b4push
pnpm --filter @takazudo/zudo-sg check
pnpm verify:styleguide-install
bash scripts/check-pack.sh
```

Initializer (only after the engine version its template references is live
on npm):

```sh
pnpm --filter create-zudo-sg check
pnpm check:create-template
pnpm verify:create-zudo-sg --published-engine
```

The publish workflows re-run the release gates in Actions before publishing
(engine: check, `verify:styleguide-install`, `verify:descriptor-host-install`,
`verify:react-descriptor-host-install`, `scripts/check-pack.sh`; initializer:
check, `check:create-template`, `verify:create-zudo-sg --published-engine`).
An environment that cannot run a heavy local gate must say so in its report;
it never skips the hosted gates.

### 5. Integrate the release commit into `main`

Commit only the release files:

```sh
# engine
git add packages/styleguide/package.json packages/styleguide/CHANGELOG.md \
  doc/src/content/docs/changelog/zudo-sg/X.Y.Z.mdx packages/create-zudo-sg/templates/default
git commit -m "chore(release): @takazudo/zudo-sg vX.Y.Z"
# initializer
git add packages/create-zudo-sg/package.json packages/create-zudo-sg/CHANGELOG.md
git commit -m "chore(release): create-zudo-sg vX.Y.Z"
```

Either route is permitted:

- **Direct**: `git push origin HEAD:main` (where the session may push `main`).
- **PR**: push `release/<tag>` (a new branch name each time), open a PR to
  `main`, wait for PR checks, merge it with a regular merge commit.

The **release candidate** is the exact commit on `main` that contains the
release files — the pushed commit, or the PR's merge commit. Wait until its
push CI (`Production Deploy`, `main-deploy.yml`) is green; the guards require
success of that exact SHA, not of a later or earlier `main`.

**Pin it.** For a new release, the candidate is `main`'s HEAD once its push CI
is green:

```sh
node scripts/release/release.mjs pick-candidate --package <key> --wait-ci 600
# → sha=<40-char main HEAD> version=X.Y.Z tag=<tag>
```

Without a working `GH_TOKEN`/`gh`, read `origin/main`'s SHA with git and
confirm its `main-deploy.yml` push run succeeded through the GitHub MCP tools
(`actions_list` → `list_workflow_runs`, `resource_id: main-deploy.yml`); the
coordinator's dry run (step 6) then re-checks it authoritatively.
`pick-candidate` never falls back to an older green commit: if HEAD's CI is
red or HEAD does not declare the version, there is no candidate. From here on
the SHA is fixed. If `main` moves before the dispatch, the coordinator keeps
the pinned SHA and says so (a `main advanced …` notice); it refuses when
`main` now declares a different version for the package, or when commits after
the candidate changed the package's release files (its package directory, or
the engine's changelog page) — then the candidate is superseded: re-pin
`main`'s HEAD, never tag an old commit by accident. The tag job re-applies
this rule just before it writes. A
resume — the tag exists or the version is on npm — always keeps the original
SHA. (A zdtp release from an older SHA once failed with a 403 whose cause is
not established; pinning the current green HEAD avoids that shape rather than
explaining it.)

### 6. Dry run (optional, non-publishing)

```sh
gh workflow run release.yml --ref main \
  -f package=<key> -f version=X.Y.Z -f sha=<candidate-sha> -f dry_run=true
```

or locally `node scripts/release/release.mjs verify-candidate --package <key>
--version X.Y.Z --sha <candidate-sha> --dry-run`. A dry run only runs the
read-only verify job: it cannot create tags, start the publisher, publish, or
create Releases. It reports whether the version would be published or is
already published with matching provenance.

### 7. Release

Preferred — the hosted coordinator (works from any environment that can
dispatch workflows; see "Dispatch routes" below):

```sh
gh workflow run release.yml --ref main \
  -f package=<key> -f version=X.Y.Z -f sha=<candidate-sha> -f dry_run=false
```

`release.yml` has three jobs, each holding only the permission it needs:

| Job | Permission | What it does |
| --- | --- | --- |
| `verify` | `contents: read`, `actions: read` | candidate on main, manifest/notes, tag absent or at this SHA, exact push CI green (waits up to 10 minutes for a pending run), registry decision, candidate not superseded; for the initializer, the template's `^X.Y.Z` engine is on npm (engine first) |
| `tag` | `contents: write` | `release.mjs create-tag`: re-reads the tag, main ancestry and the registry **immediately before the write**; same tag at the same SHA = success (resend), at another SHA = refused; after a 422 or an ambiguous answer (network/5xx) it reads the ref back instead of guessing |
| `dispatch` | `contents: read`, `actions: write` | `release.mjs dispatch-publisher`: reuses a publisher run for the tag that is in progress or succeeded; otherwise dispatches the publisher at the tag and records the **exact run id/URL** (from the dispatch answer, or a readback that must find exactly one new run) |

`id-token: write` exists only in the publishers' `publish` job. A tag created
by `GITHUB_TOKEN` does not fire `push: tags` workflows, which is why
publication is dispatched explicitly.

If the `tag` job fails with a 403/422, its log keeps GitHub's message,
documentation link, accepted-permissions header and request id. Do **not** add
a PAT or bypass a ruleset: the owner either allows GitHub Actions to create
release tags, or uses the local route below. Nothing was published.

Concurrency: dispatches of the same package queue in one group (`release-<key>`;
a running coordinator is never cancelled, a newer pending dispatch replaces an
older pending one — a dry run too, so never dispatch a dry run while a real run
of that package is still pending). Because every write re-checks durable state, a duplicate
dispatch reuses the existing tag and publisher run instead of repeating them.

Equivalent — a tag push from an authenticated local session:

```sh
git tag <tag> <candidate-sha>
git push origin <tag>
```

Both routes reach the same publisher. Never tag an unverified commit, and
never move or delete a pushed release tag.

#### Dispatch routes

`gh` failing (`gh auth status` → invalid/missing token) only says this shell
cannot reach GitHub's REST API; it does **not** mean the session cannot
dispatch. Run `release.mjs preflight`, then use the first route that works:

1. **`gh` / REST** (`GH_TOKEN` or `gh auth`) — the commands in steps 6–7.
2. **GitHub MCP tools** (Claude Code on the web, Codex with a GitHub
   connector). Pass every input as a string:
   - dispatch: `actions_run_trigger` → `method: run_workflow`,
     `workflow_id: release.yml`, `ref: main`,
     `inputs: {package: "<key>", version: "X.Y.Z", sha: "<candidate-sha>", dry_run: "true"|"false"}`;
   - readback: the dispatch answer (HTTP 204) carries no run id. List
     `actions_list` → `list_workflow_runs`, `resource_id: release.yml`,
     `workflow_runs_filter: {event: "workflow_dispatch"}` and take the run
     whose `display_title` is exactly
     `Release <key> X.Y.Z <candidate-sha>` (plus ` (dry run)` for a dry run),
     created after the dispatch; then `list_workflow_jobs` on that run id and
     `get_job_logs` for the step output;
   - the `dispatch` job log names the exact publisher run
     (`run_id=…`, `run_url=…`); follow it with `actions_get` →
     `get_workflow_run` and `list_workflow_jobs` (publish vs finalize);
   - cancel / resume: `actions_run_trigger` → `cancel_workflow_run`,
     `rerun_failed_jobs` with that run id.
3. **Actions UI** — <https://github.com/Takazudo/zudo-sg/actions/workflows/release.yml>
   → *Run workflow* on `main`, fill the four inputs. The run's summary shows
   the exact publisher run link.

Whatever the route, record the coordinator run URL and the publisher run id
it reports; never infer "the newest run" for a publisher when an id is known.

### 8. What the publish workflow does

`publish` job (`contents: read`, `actions: read`, `id-token: write`):

1. A `workflow_dispatch` must target an exact tag in the package's namespace;
   branch refs are refused before checkout.
2. Stable-only guard: tag and manifest are a clean, matching `X.Y.Z`.
3. `release.mjs guard-tag`: exact namespace (the other package's tag is
   refused) and manifest version.
4. `release.mjs verify-candidate`: the tagged commit is on `main`, notes exist,
   the tag is not elsewhere, and the commit's exact push CI succeeded (waits up
   to 10 minutes for pending runs). A `main-deploy.yml` run that GitHub
   cancelled because a newer push queued behind it counts only when the same
   workflow later succeeded on a `main` commit containing the candidate.
5. The same step decides publication from the registry: **not found** → build, gate and publish;
   **found with provenance matching this repo, workflow, tag and commit** →
   skip publication (resume); **uncertain or foreign** → fail.
6. The package's release gates (unchanged), then
   `pnpm publish … --tag latest --access public --no-git-checks --provenance`
   with no token. The job is green as soon as `pnpm publish` succeeded; it
   no longer waits for the registry to show the version (a slow registry
   used to turn an already successful publication red).

`finalize` job (`contents: write` only; needs `publish`): waits up to 15
minutes for the version to be visible (an uncertain registry answer keeps
waiting, never counts as unpublished), re-checks that the tag points at the
run's commit, then creates the GitHub Release (`@takazudo/zudo-sg X.Y.Z` / `create-zudo-sg X.Y.Z`) from the
changelog source. An existing matching Release is kept. An existing Release
with different text is **left untouched** with a warning. A draft or
prerelease with that tag fails for a human to resolve.

After creating it, the Release is read back; an ambiguous create answer is
resolved by that readback rather than by retrying the POST.

Publication and finalization are separate job outcomes. Follow the exact run
id the coordinator reported (`gh run watch <id>`), and list every publisher
run of the tag with both outcomes apart:

```sh
node scripts/release/release.mjs publisher-runs --package <key> --version X.Y.Z
# run=<id> … publish=success finalize=failure …
```

### 9. Verify and report

```sh
node scripts/release/release.mjs status --package <key> --version X.Y.Z   # stage=done, identity=match
npm view <name>@X.Y.Z version
npm dist-tag ls <name>                                                     # X.Y.Z on latest
```

Report per package: version, candidate SHA, coordinator and publisher run
URLs, publish vs. finalize outcomes, npm URL, Release URL. Then continue with
the initializer if it was selected. **If the engine did not reach npm, do not
start the initializer.**

## Recovery

Always start with `status` (or `publish-decision`) — registry state, not the
Actions colour, decides.

- **Gate/CI failure before tagging** — fix on `main` and continue; nothing is
  released. If the release commit should be abandoned and is still `main`'s
  HEAD, `git revert` it; otherwise leave the stale version for the next
  release to supersede.
- **Publish job failed, version confirmed not found**
  - transient (registry, runner) or credential-only (trusted publisher fixed
    on npmjs.com): retry the **unchanged tag** —
    `gh run rerun <run-id>` or
    `gh workflow run <publisher> --ref <tag>`.
  - needs a code fix: leave the tag where it is, fix `main`, and release a
    **new version** through the procedure.
- **Version is on npm with matching provenance (finalization missing or
  failed)** — do **not** bump or republish. Re-run only the failed job
  (`gh run rerun <run-id> --failed`, or MCP `rerun_failed_jobs`); since the
  publish job is green once `pnpm publish` succeeded, this re-runs `finalize`
  alone. Dispatching the publisher at the exact tag also works: its publish
  job skips publication via provenance.
- **Coordinator failed after the tag** (e.g. the dispatch job) — re-run the
  coordinator with the **same** inputs: the tag job sees the tag at this SHA
  and succeeds without writing, the dispatch job reuses a running or
  successful publisher run, or dispatches one.
- **Cancel** — before the tag exists, cancel the coordinator run
  (`gh run cancel <id>` / MCP `cancel_workflow_run`) and follow "Gate/CI
  failure before tagging". After the tag exists there is nothing to cancel
  safely: let the publisher finish or fail, then resume from `status`.
- **Version on npm with mismatched or missing provenance** — stop. Someone
  published outside this workflow; reconcile by hand.
- **Registry uncertain** — wait and re-run `status`; never infer "unpublished"
  from an error. Auth, network, rate-limit (429) and server answers are all
  uncertain; a packument without the version is double-checked against the
  exact-version document before it counts as "not found".
- **Tag exists at a different commit** — stop; never move a release tag.

## Codex Cloud

Cloud sessions use this same procedure. Clone access alone is not enough: the
session must be able to push a branch (or `main`), open/merge a PR, read
Actions runs, and **dispatch** `release.yml`. Until an owner-started Cloud
session passes the acceptance below, Cloud runtime acceptance is **pending**
(tracked in #1072).

**Environment setup** (Cloud environment settings): Node 24 with corepack
(`corepack enable`), setup script `pnpm install --frozen-lockfile`, and
internet access to `api.github.com`, `github.com` and `registry.npmjs.org`.
GitHub access comes from either a `GH_TOKEN` secret scoped to
`Takazudo/zudo-sg` with Contents, Pull requests and Actions **read/write**, or
the platform's GitHub MCP tools (see "Dispatch routes"). Never an npm
credential of any kind.

**Preflight + acceptance prompt** (paste into the Cloud session):

```text
In Takazudo/zudo-sg, run the release preflight from packages/styleguide/RELEASE.md
("Codex Cloud"). Do not publish anything and do not create tags or Releases.

1. Report node -v, pnpm -v, git remote -v, git rev-parse HEAD origin/main, and
   node scripts/release/release.mjs preflight. If preflight reports GitHub REST
   unavailable, do steps 2 and 4 through the GitHub MCP tools instead
   (RELEASE.md "Dispatch routes") and say which route you used.
2. Prove GitHub access beyond clone, recording each command's exact result:
   - gh api repos/Takazudo/zudo-sg --jq .permissions   (push must be true)
   - gh run list --workflow main-deploy.yml --limit 1
   - git push origin HEAD:refs/heads/cloud-preflight-<date> then delete that
     branch with git push origin :refs/heads/cloud-preflight-<date>
3. For both packages run node scripts/release/release.mjs status --package <key>
   and report stage/registry/identity.
4. Dispatch the non-publishing dry run for the engine's latest released
   version at its tag commit:
   gh workflow run release.yml --ref main -f package=engine
     -f version=<v> -f sha=<git rev-parse v<v>^{commit}> -f dry_run=true
   Watch it to completion and report the run URL and its summary
   ("already published … skipping publication"). Confirm the tag and dispatch
   jobs were skipped.
5. Report PASS only if every step succeeded; otherwise report the first
   failing step with its exact error. Post the report on issue #1072.
```

A real Cloud release then follows steps 1–9 with the PR integration route and
the `release.yml` dispatch.

## Manual verification (no publish)

```sh
pnpm vitest run scripts/__tests__/release.test.ts   # orchestration behaviour
bash scripts/check-pack.sh                          # tarball shape + import smoke
npm view @takazudo/zudo-sg version                  # public read
```

None of these write to npm or GitHub.
