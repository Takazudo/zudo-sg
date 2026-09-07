# Diagnosis: what materialises the divergent `packages/ui` runtime tree

Reproduction for [#568](https://github.com/Takazudo/zudo-sg/issues/568) (epic
[#560](https://github.com/Takazudo/zudo-sg/issues/560), source
[#530](https://github.com/Takazudo/zudo-sg/issues/530)).

Every claim below is labelled **OBSERVED** (a command was run in this worktree and its real
output is pasted) or **INFERRED** (read from source, not executed). Nothing is asserted from
memory.

- **Environment:** pnpm 11.5.2 (invoked directly; `corepack pnpm` only for the `pack` test, to
  mirror how the verifier script invokes it), worktree
  `/home/takazudo/repos/myoss/zudo-sg/worktrees/diagnose-install`, branch
  `sweep-260908-ui-install-gates/diagnose-install`.
- **Health probe used throughout:** presence of `packages/ui/node_modules/.pnpm/`, the link
  target of `packages/ui/node_modules/preact`, and the version Node resolves from inside
  `packages/ui`.

## Headline

**The trigger is not an install command at all.** Any `pnpm run` or `pnpm exec` executed with
the working directory inside `packages/ui` makes pnpm auto-install the package's *standalone*
dependency set first, because `verify-deps-before-run` is left at its pnpm 11.5.2 default. The
explicit `pnpm --dir packages/ui install` in #530's reproduction is sufficient but **not
necessary**, and it is not what the gate script actually does.

## Baseline: the healthy state this started from

**OBSERVED.**

```
$ ls -ld packages/ui/node_modules/preact
lrwxrwxrwx 1 takazudo takazudo 62  9月  8 02:02 packages/ui/node_modules/preact -> ../../../node_modules/.pnpm/preact@10.29.2/node_modules/preact

$ ls -d packages/ui/node_modules/.pnpm/preact@*
ls: cannot access 'packages/ui/node_modules/.pnpm/preact@*': No such file or directory

$ [ -d packages/ui/node_modules/.pnpm ] && echo YES || echo NO
NO

$ ls -A packages/ui/node_modules | wc -l
13
$ find packages/ui/node_modules -maxdepth 1 -mindepth 1 -type l | wc -l
8
$ find packages/ui/node_modules -maxdepth 1 -mindepth 1 -type d | wc -l
5
```

Of the 13 entries, 8 are symlinks pointing up into the root store; the other 5 are `.bin` and
the scoped-package directories, which hold further symlinks up to the same store:

```
$ ls -la packages/ui/node_modules/@testing-library/
lrwxrwxrwx 1 takazudo takazudo  101 jest-dom -> ../../../../node_modules/.pnpm/@testing-library+jest-dom@6.9.1/node_modules/@testing-library/jest-dom
lrwxrwxrwx 1 takazudo takazudo  112 preact   -> ../../../../node_modules/.pnpm/@testing-library+preact@3.2.4_preact@10.29.2/node_modules/@testing-library/preact
```

Note `@testing-library/preact` is the root-resolved `_preact@10.29.2` variant. There is no
nested `.pnpm` directory at all.

## Q1 — Which exact command materialises `packages/ui/node_modules/.pnpm/preact@…`?

### `pnpm --dir packages/ui check` alone does it. No explicit install required.

**OBSERVED.** From the healthy baseline above, with no install command issued:

```
$ pnpm --dir packages/ui check
Lockfile is up to date, resolution step is skipped
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +243
++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
Progress: resolved 243, reused 243, downloaded 0, added 243, done

dependencies:
+ @takazudo/zfb-md-wasm 2.15.1
+ dompurify 3.4.14

devDependencies:
+ @testing-library/jest-dom 6.9.1
+ @testing-library/preact 3.2.4
+ @types/node 22.20.1
+ @zudo-composer/component-contract 1.0.0
+ happy-dom 16.8.1
+ jsdom 29.1.1
+ preact 10.29.8
+ preact-render-to-string 6.7.0
+ tailwindcss 4.3.3
+ typescript 5.9.3
+ vitest 4.1.11

Done in 1.1s using pnpm v11.5.2
$ pnpm run typecheck && pnpm run test
...
 Test Files  83 passed (83)
      Tests  602 passed (602)
```

pnpm printed a full install report **before** the first script line ran. State afterwards:

```
$ readlink packages/ui/node_modules/preact
.pnpm/preact@10.29.8_preact-render-to-string@6.7.0/node_modules/preact

$ ls -d packages/ui/node_modules/.pnpm/preact@*
packages/ui/node_modules/.pnpm/preact@10.29.8_preact-render-to-string@6.7.0

$ ls packages/ui/node_modules/.pnpm | wc -l
245
```

The link flipped from a `../../../` workspace link to a nested self-relative one, and 245
nested store entries appeared. **`test:ui-provider-package` contaminates the tree on its own.**

Note the directory name carries a peer suffix — `preact@10.29.8_preact-render-to-string@6.7.0`,
not a bare `preact@10.29.8`. A contamination guard must glob `preact@*`; an exact-string match
on `preact@10.29.8` would miss it.

### The tests are irrelevant — a no-op `pnpm exec` is enough

**OBSERVED.** From a freshly restored healthy tree:

```
$ pnpm --dir packages/ui exec node -e "0"
Lockfile is up to date, resolution step is skipped
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +243
...
+ preact 10.29.8
...

$ [ -d packages/ui/node_modules/.pnpm ] && echo "YES: $(ls packages/ui/node_modules/.pnpm | wc -l) entries"
YES: 245 entries
```

A command that does nothing at all materialises the entire second tree. Neither Vitest, nor
`tsc`, nor any install flag is part of the trigger.

### The mechanism is pnpm's `verify-deps-before-run`

**OBSERVED.** The same no-op with the setting disabled, from a healthy tree:

```
$ pnpm --dir packages/ui --config.verify-deps-before-run=false exec node -e "0"

$ [ -d packages/ui/node_modules/.pnpm ] && echo YES || echo NO
NO
```

No install output, tree untouched. The setting is not configured anywhere in this repository —
`pnpm config get verify-deps-before-run` prints `undefined` from both the root and
`packages/ui`, and the key appears in neither `pnpm-workspace.yaml` nor `.npmrc` — so what runs
is pnpm 11.5.2's built-in default.

**INFERRED (mechanism, not the effect):** the effect is observed above; the causal story is that
before running a script pnpm compares `node_modules` against the *nearest* lockfile. Because
`packages/ui/pnpm-workspace.yaml` declares `packages: []`, `packages/ui` is its own workspace
root, so the nearest lockfile is `packages/ui/pnpm-lock.yaml` (preact 10.29.8) rather than the
root one (preact 10.29.2). The root install's workspace links never satisfy it, so the check
fails and re-installs on every first invocation.

### Re-running is idempotent — it only fires from the healthy state

**OBSERVED.** Immediately re-running `check` on the already-contaminated tree:

```
$ pnpm --dir packages/ui check
$ pnpm run typecheck && pnpm run test
$ tsc --noEmit
$ vitest run --config vitest.config.ts
...
 Test Files  83 passed (83)
```

No install report. The install fires only when the tree currently matches the *root* lockfile —
i.e. exactly once after every recovery.

### Verdict on #530's wording

- #530's follow-up comment — "`pnpm test` inside `packages/ui` runs its nested standalone
  install" — is **correct**. **OBSERVED**, via the literal `cd` form the comment describes:

  ```
  $ cd packages/ui && pnpm test
  Lockfile is up to date, resolution step is skipped
  ...
  Packages: +243
  ...
   Test Files  83 passed (83)

  $ readlink packages/ui/node_modules/preact
  .pnpm/preact@10.29.8_preact-render-to-string@6.7.0/node_modules/preact
  ```

- #530's *reproduction* using an explicit `pnpm --dir packages/ui install` is not wrong, but it
  is **misleading as a description of the hazard**: it suggests the fix is to avoid running an
  install, when in fact the gate never issues one. Nothing in #530 turned out to be false; the
  reproduction was simply narrower than the trigger.

### Consequence: two module identities

**OBSERVED.** While contaminated, Node resolves `preact` to two different files:

```
$ node -e "
const {createRequire} = require('module');
const rootReq = createRequire('<worktree>/vitest.config.ts');
const uiReq   = createRequire('<worktree>/packages/ui/src/index.ts');
console.log('resolved from root config :', rootReq.resolve('preact'));
console.log('resolved from packages/ui :', uiReq.resolve('preact'));
console.log('SAME PATH?', rootReq.resolve('preact')===uiReq.resolve('preact'));
"
resolved from root config : <worktree>/node_modules/.pnpm/preact@10.29.2/node_modules/preact/dist/preact.js
resolved from packages/ui : <worktree>/packages/ui/node_modules/.pnpm/preact@10.29.8_preact-render-to-string@6.7.0/node_modules/preact/dist/preact.js
SAME PATH? false
```

(`<worktree>` stands in for the absolute worktree path, which was printed in full.)

This is the cheap, direct proof of the divergence. The downstream root-unit failure mode
(~77 "Found multiple elements" failures reported in #530) was **not** re-run here — the root
unit suite is outside this sub-task's verification budget and belongs to #571.

## Q2 — Does `verify:ui-provider-install` contribute?

### No. It leaves the tree healthy, and on the `--exact` path it never enters `packages/ui`.

**INFERRED (from reading `scripts/verify-ui-provider-install.mjs`):** all 17 `run()` call sites
were enumerated with their `cwd` argument:

```
$ grep -n "await run(\|run(\"" scripts/verify-ui-provider-install.mjs
 69: run("git", ["rev-parse", `HEAD:${handoff.sourcePath}`], root)
 74: run("git", ["ls-remote", "--exit-code", repositoryUrl, ref], root, …)
 89: run("git", ["init", "--bare", "--quiet", bare], root)
 92: run("git", ["fetch", "--no-tags", repositoryUrl, remoteCommit], bare, …)
 96: run("git", ["cat-file", "-e", …], bare, …)
100: run("git", ["merge-base", "--is-ancestor", …], bare, …)
135: run("git", ["init", "--bare", "--quiet", bare], root)
136: run("git", ["fetch", "--no-tags", "--depth=1", …], bare)
137: run("git", ["rev-parse", `${handoff.packageCommit}^{tree}`], bare)
213: run("corepack", ["pnpm", "install", "--lockfile-only"], directory)
215: run("corepack", ["pnpm", "install", "--frozen-lockfile"], directory)
216: run("corepack", ["pnpm", "run", "typecheck"], directory)
217: run("corepack", ["pnpm", "run", "build"], directory)
218: run("corepack", ["pnpm", "exec", "playwright", "install", "chromium"], directory)
219: run("node", ["browser-proof.mjs"], directory)
230: run("corepack", ["pnpm", "pack", "--pack-destination", artifacts], packageRoot)
```

Only three `cwd` values occur. `root` is used exclusively for read-only `git` queries (the two
`git init --bare` calls take the temp path as an argument, so they write outside the repo);
`bare` and `directory` are both `os.tmpdir()` `mkdtemp` paths (`zudo-sg-ui-ancestry-`,
`zudo-sg-ui-ref-`, `zudo-sg-ui-pack-`, `zudo-sg-ui-consumer-`). All consumer installs,
typechecks, builds and the Playwright proof run in the temp consumer.

**Exactly one call runs with `cwd` inside the package** — line 230, `pnpm pack`, inside
`localPackageSpec()`.

`localPackageSpec()` is only reached on the **local fallback** branch (`forceLocal`, or the
advertised package branch not being reachable). On the exact path — the one `--exact` forces —
`prepareAndBuild()` is called with `handoff.rootGitSpec` and `pnpm pack` is never invoked, so
**no command whatsoever runs inside `packages/ui`**.

**OBSERVED:** the one candidate, run in isolation from a healthy tree:

```
$ (cd packages/ui && corepack pnpm pack --pack-destination "$PACKDIR")
package: @zudo-sg/ui@0.1.0
Tarball Contents
...
Tarball Details
/tmp/zudo-packtest-Y9bw/zudo-sg-ui-0.1.0.tgz

$ readlink packages/ui/node_modules/preact
../../../node_modules/.pnpm/preact@10.29.2/node_modules/preact

$ [ -d packages/ui/node_modules/.pnpm ] && echo YES || echo NO
NO
```

The tree stayed linked to the root store. (**INFERRED** explanation: `pnpm pack` is neither
`run` nor `exec`, so the pre-run deps check never fires.) **`verify:ui-provider-install` is already fully isolated and contributes
nothing to the hazard.**

The full `verify:ui-provider-install` script was **not** executed end-to-end — it downloads
Chromium and drives a browser proof, which this sub-task's budget excludes. The claim above
rests on the source enumeration plus the isolated test of its single in-package command.

## Q3 — Minimal reproduction

**OBSERVED.** From a clean workspace (`rm -rf packages/ui/node_modules && pnpm install` at the
repo root), a single command suffices:

```sh
pnpm --dir packages/ui exec node -e "0"
```

The payload does not matter: the contamination comes from pnpm's pre-run dependency check, so any
`pnpm run <script>` or `pnpm exec <anything>` with cwd inside `packages/ui` is equivalent, and
the payload is irrelevant. The realistic repro through the project's own scripts is:

```sh
pnpm test:ui-provider-package     # = pnpm --dir packages/ui check
```

Both were run and both produced the identical 245-entry nested `.pnpm` tree.

## Q4 — The ordering claim

### Confirmed for the no-drift case, and `--lockfile-only` provably never writes `node_modules`

The claim from #530's comment: `pnpm --dir packages/ui install --lockfile-only` followed by a
root install **last** updates both lockfiles without ever materialising the second tree.

**OBSERVED — step 1**, from a healthy tree:

```
$ pnpm --dir packages/ui install --lockfile-only
Done in 338ms using pnpm v11.5.2

$ [ -d packages/ui/node_modules/.pnpm ] && echo YES || echo NO
NO
$ readlink packages/ui/node_modules/preact
../../../node_modules/.pnpm/preact@10.29.2/node_modules/preact
```

**OBSERVED — step 2**, root install last:

```
$ pnpm install
Scope: all 4 workspace projects
Already up to date
Done in 287ms using pnpm v11.5.2

$ [ -d packages/ui/node_modules/.pnpm ] && echo YES || echo NO
NO
$ git status --short
            (empty)
$ diff -q <backup> packages/ui/pnpm-lock.yaml && echo "ui lockfile IDENTICAL"
ui lockfile IDENTICAL
$ diff -q <backup> pnpm-lock.yaml && echo "root lockfile IDENTICAL"
root lockfile IDENTICAL
```

The sequence left the tree healthy. **Caveat, stated plainly:** both lockfiles were already up
to date in this worktree, so this run confirmed only the "does not materialise the second tree"
half. It did **not** exercise the "updates both lockfiles" half, because there was nothing to
update. The claim as written is therefore *consistent with* what was observed, not fully proven
by it.

**OBSERVED — the update half, on an isolated copy outside the repo.** To exercise real
resolution without touching any tracked file under `packages/ui`, its `package.json`,
`pnpm-workspace.yaml` and `pnpm-lock.yaml` were copied to a temp dir and drift was forced
(`devDependencies.preact` → `^10.28.0`):

```
$ ls -d $T/node_modules
ls: cannot access '/tmp/zudo-lockonly-yD6W/node_modules': No such file or directory

$ pnpm install --lockfile-only
Progress: resolved 1, reused 0, downloaded 0, added 0
Progress: resolved 234, reused 1, downloaded 0, added 0
Progress: resolved 268, reused 1, downloaded 0, added 0, done

Done in 1.6s using pnpm v11.5.2

$ ls -d $T/node_modules
ls: cannot access '/tmp/zudo-lockonly-yD6W/node_modules': No such file or directory

$ diff -q <original packages/ui lock> $T/pnpm-lock.yaml > /dev/null \
    && echo UNCHANGED || echo "CHANGED (resolution ran)"
CHANGED (resolution ran)
```

268 packages were genuinely resolved and the lockfile was rewritten, yet **`node_modules` was
never created at all**. So `--lockfile-only` is safe by construction, not by luck.

### But the ordering framing understates the risk — flagged for #570

**OBSERVED consequence of Q1.** The ordering rule holds as far as it goes, but Q1 shows the
hazard is not about install *ordering*: it is about ever running a script under `packages/ui`.
A sequence that obeys the ordering rule perfectly and then runs `pnpm test:ui-provider-package`
is contaminated anyway. #570 should document the ordering as "how to refresh the nested lockfile
safely", not as "how to avoid the divergent tree" — the latter needs the isolated runner from
#569.

## Q5 — The recovery

### Both halves confirmed exactly as #530 described

**OBSERVED — a plain root install does not repair it.** Run while contaminated:

```
$ pnpm install
Scope: all 4 workspace projects
Already up to date
Done in 312ms using pnpm v11.5.2

$ readlink packages/ui/node_modules/preact
.pnpm/preact@10.29.8_preact-render-to-string@6.7.0/node_modules/preact
$ ls -d packages/ui/node_modules/.pnpm/preact@*
packages/ui/node_modules/.pnpm/preact@10.29.8_preact-render-to-string@6.7.0
```

The version Node resolves from inside `packages/ui` was still `10.29.8`. Still contaminated,
exit code 0, no warning of any kind.

**OBSERVED — `rm -rf` + root install repairs it:**

```
$ rm -rf packages/ui/node_modules && pnpm install
Scope: all 4 workspace projects
Lockfile is up to date, resolution step is skipped
Already up to date

. prepare$ lefthook install
. prepare: sync hooks: ✔️(pre-commit)
. prepare: Done
Done in 973ms using pnpm v11.5.2

$ readlink packages/ui/node_modules/preact
../../../node_modules/.pnpm/preact@10.29.2/node_modules/preact
$ [ -d packages/ui/node_modules/.pnpm ] && echo YES || echo NO
NO
```

The version Node resolves from inside `packages/ui` was back to `10.29.2`.

### Sharp edge worth documenting: "Already up to date" appears in both cases

Both the failed repair and the successful one print `Already up to date`. The message is **not**
a signal of either outcome, so neither docs nor a guard script may key off it. The only reliable
signal is the filesystem probe (`packages/ui/node_modules/.pnpm/preact@*` present, or
`packages/ui/node_modules/preact` not being a `../../../` symlink).

## What this means for #569

1. Guard on the filesystem, never on pnpm's output text.
2. Glob `packages/ui/node_modules/.pnpm/preact@*` — the real directory carries a
   `_preact-render-to-string@6.7.0` peer suffix.
3. The isolated runner must copy the package out of the workspace, because *any* pnpm
   `run`/`exec` inside `packages/ui` contaminates. Passing `--config.verify-deps-before-run=false`
   suppresses the auto-install (**OBSERVED**), but it is the wrong fix — **INFERRED:** with the
   flag set, the gate would execute against whatever `packages/ui/node_modules` already holds,
   which after a root install is the root workspace's resolution, not the standalone tree the
   gate exists to verify. That was not measured; #569 should confirm it if it relies on it.
4. `verify:ui-provider-install` needs no change for this hazard.

## Restoration

**OBSERVED.** The worktree was returned to the healthy linked state before this document was
committed:

```
$ rm -rf packages/ui/node_modules && pnpm install
$ readlink packages/ui/node_modules/preact
../../../node_modules/.pnpm/preact@10.29.2/node_modules/preact
$ [ -d packages/ui/node_modules/.pnpm ] && echo YES || echo NO
NO
$ git status --short
            (empty)
$ git rev-parse HEAD:packages/ui
3b5571cac4d1e3def761a87335e2a27387e450ec
```

The provider tree SHA is unchanged and matches `ui-provider-handoff.json`'s `sourceTree`.
