---
description: >-
  Release @takazudo/zudo-sg and create-zudo-sg end-to-end from ONE invocation,
  following the canonical runbook packages/styleguide/RELEASE.md. By default it
  judges both packages and releases every one that has something to ship,
  engine first and initializer second. An explicit `engine` or
  `create-zudo-sg`/`initializer` request restricts the run to that package.
  Both packages are STABLE-ONLY (clean X.Y.Z on npm `latest`) and publish
  tokenlessly through npm Trusted Publishing in GitHub Actions. Invoking the
  skill is the release decision and authorizes the whole flow through
  publication; pass `--confirm` for an interactive proposal checkpoint.
  Triggers on "bump version", "cut a release", "release zudo-sg", "release
  create-zudo-sg", "release the initializer", and "make a release".
user-invocable: true
argument-description: >-
  Optional: major | minor | patch | X.Y.Z — force that bump/version (applies to
  the engine in a combined run, or to the named package). `engine` or
  `create-zudo-sg`/`initializer` restricts the run. `--confirm` waits at the
  proposal before any mutation. `--dry-run` stops after the non-publishing
  coordinator dry run. `cancel` abandons a not-yet-tagged release.
---

# /l-make-release

Thin Claude Code adapter over **`packages/styleguide/RELEASE.md`**. Read that
file first and follow its steps 1–9, recovery rules and package contract
exactly; this skill only adds Claude-specific behaviour. If this file and the
runbook ever disagree, the runbook wins — fix this file.

## Argument mapping

| Argument | Runbook effect |
| --- | --- |
| none | combined run: step 2 judges both packages |
| `engine` / `create-zudo-sg` / `initializer` | restrict step 2 to that package |
| `major` / `minor` / `patch` / `X.Y.Z` | explicit version selection in step 2 |
| `--confirm` | print the step 2 proposal and wait for one confirmation |
| `--dry-run` | run steps 1–6 only; stop after the coordinator dry run |
| `cancel` | Recovery → "Gate/CI failure before tagging" for the prepared release |

## Claude-specific behaviour

- **One decision.** Without `--confirm`, the invocation is the release
  decision: print the proposal for visibility and continue. With
  `--confirm`, ask once; after that do not ask again before integration,
  tagging, publication, the initializer half or finalization.
- **Start every run (and every resume) with `status`** for the selected
  packages and continue at the stage it reports. Never repeat a finished
  stage, never bump because finalization failed, never move a tag.
- **Integration route.** On the owner's Mac the direct `main` push in step 5 is
  permitted. Use the PR route instead when the session cannot push `main`.
- **Candidate.** Pin the candidate with `release.mjs pick-candidate` (main's
  HEAD once its push CI is green) and pass that exact SHA to every dispatch.
  Never swap it for a newer `main` on your own; on resume reuse the SHA the
  tag/publication already carries.
- **Release step.** Prefer dispatching `release.yml` (step 7). Run
  `release.mjs preflight` first. If `gh` is unauthenticated, do not conclude
  dispatch is impossible: use the GitHub MCP tools (`actions_run_trigger`
  `run_workflow`, inputs as strings; read back with `actions_list` /
  `actions_get` / `get_job_logs`) per the runbook's "Dispatch routes". If no
  route can dispatch, tell the user to start it from the Actions UI with the
  exact inputs. The local tag push is the owner's fallback when the workflow
  token cannot create the tag; never add a PAT or bypass a ruleset.
- **Exact runs.** Take the publisher run id from the coordinator's `dispatch`
  job output and follow that run; report its publish and finalize jobs
  separately (`release.mjs publisher-runs`).
- **Heavy gates.** Run `pnpm b4push` and other long local suites through the
  machine's heavy-test guard when one is configured, in the background, and
  resume when they finish.
- **Waiting.** Watch CI and publisher runs with `gh run watch <id>
  --exit-status` in the background rather than polling (with MCP only, check
  the exact run id at widening intervals).
- **Report** per the runbook's step 9, keeping publication and finalization
  outcomes separate.
