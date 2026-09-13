# Release runbook — `@takazudo/zudo-sg`

Short operational reference. The end-to-end orchestration lives in the
`/l-make-release` project skill (`.claude/skills/l-make-release/SKILL.md`) —
read this file for the facts that skill assumes, or when recovering from a
failed publish by hand.

## Channels

**Stable only.** There is no `next` / prerelease dist-tag for this package
(ADR `docs/adr/styleguide-engine.md` decision 12). Every release is a clean
`X.Y.Z` published to the npm `latest` dist-tag. `/l-make-release` never takes
a `next`/`stable`/prerelease argument for this repo.

## Tag namespace

`v*.*.*` (e.g. `v0.1.0`) on the **root repository**. Pushing a matching tag
triggers `.github/workflows/publish-zudo-sg.yml`.

## Version source of truth

`packages/styleguide/package.json`'s `version` field. The root `package.json`
stays `private` and is never bumped by a release.

## Token type

`NPM_TOKEN` (repo secret) **must be an Automation-type token**. Scoped publish
(`@takazudo/*`) requires 2FA, and only an Automation (or a granular,
2FA-bypassing) token can publish unattended in CI — a standard user token
fails the publish step with an OTP/EOTP error.

## What the publish workflow does

On a pushed `v*.*.*` tag (or a `workflow_dispatch` guarded to the same tag
pattern):

1. `pnpm install --frozen-lockfile`
2. Build the package (`pnpm --filter @takazudo/zudo-sg build`, invoked via
   `pnpm --filter @takazudo/zudo-sg check`, which also typechecks + tests it)
3. `pnpm verify:styleguide-install` — the foreign-install proof (#665):
   packs, installs into `fixtures/engine-host` outside the workspace, builds
   under a non-root `base`, boots `zfb dev` once
4. `bash scripts/check-pack.sh` — packs again, asserts the tarball matches the
   `files` whitelist and every `exports` target resolves, installs the
   tarball into a scratch project, imports the Node-importable subpaths, runs
   `zudo-sg --help`
5. `pnpm --filter @takazudo/zudo-sg publish --tag latest --access public
   --no-git-checks --provenance`

The version is validated against `^v\d+\.\d+\.\d+$` before anything runs — no
`next` branch anywhere in the workflow.

## If the publish job fails after tagging

npm never allows re-publishing the same version. Recovery:

1. Inspect the failed run's logs (`gh run view <run-id> --log-failed`).
2. **Transient failure** (registry hiccup, runner eviction) — re-run the same
   workflow run: `gh run rerun <run-id>`. The version was never actually
   published, so a clean re-run can still succeed under the same tag.
3. **Needs a code fix** — the tag must move to a new commit; npm will not
   accept the same version twice:

   ```sh
   git push origin :refs/tags/v<version>   # delete the remote tag
   git tag -d v<version>                    # delete it locally
   ```

   Fix the code, then re-run `/l-make-release` — its resume detection picks
   the un-tagged version bump back up (or cuts a fresh one).
4. **OTP / `EOTP` / 2FA error in the publish step** — `NPM_TOKEN` is not an
   Automation-type token. Regenerate it as Automation at npmjs.com, update the
   repo secret (`gh secret set NPM_TOKEN`), then retry via step 2 or 3.

## Manual verification (no publish)

```sh
bash scripts/check-pack.sh          # tarball shape + import smoke, no registry writes
npm pack --dry-run                  # from packages/styleguide — file listing only
npm view @takazudo/zudo-sg          # 404 until the very first release ships
```

None of these touch the npm registry.
