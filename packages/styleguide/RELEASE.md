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

## First release

With no `v*` tags, `/l-make-release` always takes the cold-start proposal
path. A clean tree and an untagged `0.1.0` do not mean a release is ready to
resume: that version was seeded when the package was created. Confirm npm
has no published versions, analyze the engine's history, and normally
propose **`0.1.0`**, finalizing the unreleased changelog entry without an
automatic `0.1.1` bump. A Scheme B breaking-change judgement or an explicit
bump argument can propose a higher version, with the reason stated.

The first release still requires the normal proposal confirmation, finalized
changelog, quality checks, and a new release commit. Tag that verified
release commit, never the old package-introduction commit. A restarted first
attempt with no `v*` tags also returns to the proposal gate.

## Publish credentials

The first publish uses the `NPM_TOKEN` repo secret: a **granular access
token** with **Read and write (publish and stage)** permissions covering the
`@takazudo` scope, including creation of `@takazudo/zudo-sg`, and **Bypass
2FA** enabled. Check its expiry and the account's publish rights at
npmjs.com. The stored GitHub secret cannot be read back to verify its type;
the operator must confirm these settings before releasing. npm removed
legacy/classic tokens in late 2025. See
[npm access tokens](https://docs.npmjs.com/about-access-tokens/) and
[creating granular tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens/).

Once the package exists on npm, prefer **Trusted Publishing (OIDC)**. In its
npm settings, configure a GitHub Actions trusted publisher for owner
`Takazudo`, repository `zudo-sg`, workflow filename `publish-zudo-sg.yml`,
with direct publishing allowed. The workflow already uses GitHub-hosted
runners, `id-token: write`, and `--provenance`; these do not establish the
npm-side trust by themselves. Verify OIDC publishing with the workflow's
package-manager version before removing `NPM_TOKEN` and its environment
wiring, then revoke the unused token. See
[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

This token-based bootstrap is current as of September 2026. npm has
announced the removal of direct publishing with bypass-2FA tokens in January
2027; complete the OIDC migration before then (see the access-token docs
above).

## What the publish workflow does

On a pushed `v*.*.*` tag (or a `workflow_dispatch` guarded to the same tag
pattern):

1. `pnpm install --frozen-lockfile`
2. Build the package (`pnpm --filter @takazudo/zudo-sg build`, invoked via
   `pnpm --filter @takazudo/zudo-sg check`, which also typechecks + tests it)
3. `pnpm verify:styleguide-install` — the foreign-install proof (#665):
   packs, installs into `fixtures/engine-host` outside the workspace, builds
   under a non-root `base`, boots `zfb dev` once
4. `bash scripts/check-pack.sh` — packs again, asserts the tarball contains
   `LICENSE`, matches the `files` whitelist, and every `exports` target
   resolves, installs the tarball into a scratch project, imports the
   Node-importable subpaths, runs `zudo-sg --help`
5. `pnpm --filter @takazudo/zudo-sg publish --tag latest --access public
   --no-git-checks --provenance`

The version is validated against `^v\d+\.\d+\.\d+$` before anything runs — no
`next` branch anywhere in the workflow.

## If the publish job fails after tagging

1. **First, check the exact version on npm**, even if Actions says the job
   failed:

   ```sh
   npm view "@takazudo/zudo-sg@<version>" version --registry=https://registry.npmjs.org/
   ```

   If it resolves to `<version>`, the version is **live**. Do not re-tag,
   delete its tag, re-publish, or re-run the publish job. Continue with the
   skill's **Step 9: Create the GitHub Release** (reuse an existing Release),
   then verify/report. Keep the published tag and commit; a missing or
   mismatched tag must be reconciled before creating the Release.

   Proceed below only for a confirmed not-found result (`E404`, including
   no matching version). An authentication, network, or registry error is
   inconclusive: stop and recheck when its status can be established.
2. Inspect the failed run's logs (`gh run view <run-id> --log-failed`).
3. **Transient failure** (registry hiccup, runner eviction) — repeat step 1
   immediately before retrying. If the version is still absent, re-run the
   unchanged workflow at the same tag: `gh run rerun <run-id>`. Watch it and
   repeat this recovery check if it fails again.
4. **Needs a code fix** — leave the pushed tag at its original commit. Fix
   the code on `main`, then re-run `/l-make-release` for a **new version**
   through the proposal gate. Never delete/recreate a release tag to point
   it at different content.
5. **OTP / `EOTP` / 2FA or token-permission error** — check the granular
   token's expiry, publish rights covering `@takazudo`, and **Bypass 2FA**
   setting at npmjs.com (or the configured Trusted Publisher). Correct the
   credential and update `NPM_TOKEN` if needed, then repeat step 1 before
   retrying the unchanged run. A credential-only fix does not need a new
   commit or a moved tag.

## Manual verification (no publish)

```sh
bash scripts/check-pack.sh          # tarball shape + import smoke, no registry writes
npm pack --dry-run                  # from packages/styleguide — file listing only
npm view @takazudo/zudo-sg          # 404 until the very first release ships
```

None of these touch the npm registry.
