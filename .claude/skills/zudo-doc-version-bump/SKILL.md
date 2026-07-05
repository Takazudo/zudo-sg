---
name: zudo-doc-version-bump
description: >-
  Bump package version, generate changelog docs, commit, tag, and create GitHub release. Use when:
  (1) User says 'version bump', 'bump version', 'release', or 'zudo-doc-version-bump', (2) User
  wants to create a new release of this project.
user-invocable: true
disable-model-invocation: true
argument-description: "Optional: major, minor, or patch to skip the proposal step"
---

# /zudo-doc-version-bump

Bump the version, generate changelog doc pages, commit, tag, and create a GitHub release.

## Preconditions

Before doing anything else, verify ALL of the following. If any check fails, stop and tell the user.

1. Current branch is `main`
2. Working tree is clean (`git status --porcelain` returns empty)
3. At least one `v*` tag exists (`git tag -l 'v*'`). If no tag exists, tell the user to create the initial tag first (e.g. `git tag v0.1.0 && git push --tags`).

Find the latest version tag:

```bash
git tag -l 'v*' --sort=-v:refname | head -1
```

## Analyze changes since last tag

Run:

```bash
git log <last-tag>..HEAD --oneline
```

and

```bash
git diff <last-tag>..HEAD --stat
```

Categorize each commit by its conventional-commit prefix:

- **Breaking Changes**: commits with an exclamation mark suffix (e.g. `feat!:`) or BREAKING CHANGE in body
- **Features**: `feat:` prefix
- **Bug Fixes**: `fix:` prefix
- **Other Changes**: everything else (`docs:`, `chore:`, `refactor:`, `ci:`, `test:`, `style:`, `perf:`, etc.)

## Propose version bump

Based on the changes:

- If there are breaking changes → propose **major** bump
- If there are features (no breaking) → propose **minor** bump
- Otherwise → propose **patch** bump

If the user passed an argument (`major`, `minor`, or `patch`), use that directly instead of proposing.

Present the proposal to the user:

```
Proposed bump: {current} → {new} ({type})

Breaking Changes:
- description (hash)

Features:
- description (hash)

Bug Fixes:
- description (hash)

Other Changes:
- description (hash)
```

Only show sections that have entries. **Wait for user confirmation before proceeding.**

If this is a **major** version bump, ask the user whether they want to archive the current docs as a versioned snapshot (i.e. run with `--snapshot`). Explain that this copies the current docs to a versioned directory for the old version.

## Update package.json and changelog

This repo has **no `scripts/version-bump.sh`** and **no JA locale** (`locales: {}` in
`src/config/settings.ts`, no `docs-ja` directory) — do these two updates directly instead of
running a wrapper script:

1. Update the `version` field in `package.json` to `{NEW_VERSION}`.
2. Update `src/content/docs/changelog/index.mdx` (the **only** changelog page — there is no
   per-version file, everything lives in this one file as dated `##` sections):
   - Rename the current `## Unreleased` heading to `## {NEW_VERSION}` and add a
     `Released: {YYYY-MM-DD}` line under it.
   - Insert a fresh, empty `## Unreleased` section above it (with an `- Initial release`-style
     placeholder bullet) so future changes have somewhere to land.

## Fill in changelog content

Replace the section you just renamed with the actual categorized changes from the commit
analysis:

```mdx
## {NEW_VERSION}

Released: {YYYY-MM-DD}

### Breaking Changes

- Description (commit-hash)

### Features

- Description (commit-hash)

### Bug Fixes

- Description (commit-hash)

### Other Changes

- Description (commit-hash)
```

Rules:

- Only include sub-sections that have entries
- Use today's date for the release date
- Each entry should be the commit subject with the short hash in parentheses

## Build and test

Run the full build and test suite to make sure everything is good:

```bash
pnpm b4push
```

If anything fails, fix the issue and re-run. Do not proceed with committing until all checks pass.

## Commit changes

Stage and commit **all** version bump changes — include any files modified by b4push formatting fixes:

```bash
git add package.json src/content/docs/changelog/index.mdx
# Also stage any other modified files (e.g. formatting fixes from b4push)
git diff --name-only | xargs git add
git commit -m "chore: Bump version to v{NEW_VERSION}"
```

## Push and wait for CI

Push the commits first (without the tag) and wait for CI to pass:

```bash
git push
```

Then check CI status. Use `gh run list --branch main --limit 1 --json status,conclusion,headSha` and verify the `headSha` matches the pushed commit. Poll every 30 seconds, with a **maximum of 10 minutes**. If CI is still running after 10 minutes, ask the user whether to keep waiting or proceed.

If CI fails, investigate the failure with `gh run view <run-id> --log-failed`, fix the issue, commit, and push again.

**Do not tag or publish until CI is green.**

## Tag, push tag, and create GitHub release

**Ask the user for confirmation before tagging.**

```bash
git tag v{NEW_VERSION}
git push --tags
```

After pushing the tag, create a GitHub release. `index.mdx` holds every version as its own
`## {version}` section, so extract just the `## {NEW_VERSION}` section (from that heading up to
the next `##` heading or end of file):

```bash
NOTES=$(awk -v ver="## {NEW_VERSION}" '
  $0 == ver { f=1; next }
  f && /^## / { exit }
  f
' src/content/docs/changelog/index.mdx)
gh release create v{NEW_VERSION} --title "v{NEW_VERSION}" --notes "$NOTES"
```

## Publish to npm (if applicable)

If the package is **not** marked as `"private": true` in `package.json`, tell the user to publish:

```
The package is ready for npm publishing. Run:

  pnpm publish

(This requires browser-based 2FA and must be done manually.)
```

If the package is `"private": true`, skip this step and inform the user:

```
Package is marked as private — skipping npm publish.
```

## Done

Report the summary:

- Version bumped: `{OLD_VERSION}` → `{NEW_VERSION}`
- Changelog updated (`src/content/docs/changelog/index.mdx`)
- Git tag: `v{NEW_VERSION}`
- GitHub release: link to the release
- npm publish status (published / skipped for private package)
