---
name: zudo-sg-release
description: >-
  Release @takazudo/zudo-sg (engine, tag vX.Y.Z) and/or create-zudo-sg
  (initializer, tag create-zudo-sg-vX.Y.Z) to npm by following the repository
  runbook packages/styleguide/RELEASE.md. Use for "release zudo-sg", "cut a
  release", "release create-zudo-sg", "bump version", a release dry run, or
  resuming/recovering a failed release. Stable-only, tokenless (npm Trusted
  Publishing in GitHub Actions); never publishes from the agent's machine.
---

# zudo-sg release (Codex adapter)

Thin adapter over **`packages/styleguide/RELEASE.md`** — read it first and
follow its package contract, steps 1–9 and Recovery exactly. If this file and
the runbook disagree, the runbook wins.

## Codex-specific behaviour

- **One decision.** The user's release request is the decision. Print the
  step 2 proposal and continue; do not add approval prompts. If the request
  says "dry run", stop after step 6.
- **Begin and resume with** `node scripts/release/release.mjs status --package
  <engine|create-zudo-sg>` and continue at the reported stage.
- **Auth.** Use `GH_TOKEN` (or `gh auth`) for GitHub. Never request, create or
  use an npm token, and never run `npm publish`/`pnpm publish` yourself — the
  publish workflows do that through OIDC.
- **Cloud sessions.** Use the PR integration route (step 5), then dispatch
  `release.yml` (step 7). If the preflight in the runbook's "Codex Cloud"
  section fails (e.g. no Actions dispatch access), stop after integration and
  report exactly which permission is missing; do not fall back to a tag push
  with other credentials.
- **Heavy gates.** If the environment cannot run a local gate, say which one
  and why in the report; the hosted publisher still runs the release gates.
- **Report** per step 9, keeping publication and finalization outcomes
  separate and listing run URLs.
