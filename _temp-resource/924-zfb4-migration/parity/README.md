# Migrated-site parity gate

The unchanged S1 `../baseline/states.json` drives all 84 local screenshot/style
pairs. `differences.json` compares every declared computed property and PNG
pixel (RGB tolerance 16); `matrix.md` records the decision for every pair.
PNG files are individual small captures; complete dist tarballs remain in the
machine cache recorded by S1 and are never committed.

Run builds serially through the heavy guard. Run every command that launches
Chromium through both the machine heavy guard and Playwright guard. The manager
runs these commands; the P1 worker performs offline comparisons and source fixes.

```sh
bash "$HOME/.codex/scripts/heavy-guard.sh" -- pnpm build
bash "$HOME/.codex/scripts/heavy-guard.sh" -- pnpm --filter @zudo-sg/demo build
bash "$HOME/.codex/scripts/heavy-guard.sh" -- pnpm build:doc
bash "$HOME/.codex/scripts/heavy-guard.sh" -- bash "$HOME/.claude/scripts/playwright-guard.sh" --wait 300 -- env CI=1 pnpm exec tsx _temp-resource/924-zfb4-migration/parity/capture.ts
bash "$HOME/.codex/scripts/heavy-guard.sh" -- bash "$HOME/.claude/scripts/playwright-guard.sh" --wait 300 -- env CI=1 pnpm exec tsx _temp-resource/924-zfb4-migration/parity/capture.ts --audit
bash "$HOME/.codex/scripts/heavy-guard.sh" -- bash "$HOME/.claude/scripts/playwright-guard.sh" --wait 300 -- env CI=1 pnpm exec playwright test --config _temp-resource/924-zfb4-migration/parity/behavior.config.ts
bash "$HOME/.codex/scripts/heavy-guard.sh" -- bash "$HOME/.claude/scripts/playwright-guard.sh" --wait 300 -- pnpm exec tsx _temp-resource/924-zfb4-migration/parity/live-capture.ts
python3 _temp-resource/924-zfb4-migration/parity/inventory.py
python3 _temp-resource/924-zfb4-migration/parity/compare.py
python3 _temp-resource/924-zfb4-migration/parity/matrix.py
```

`--site demo` limits recaptures after a demo-only fix. `CI=1` selects the free
legacy preview ports 4700/4701/4702; this machine's derived root port 50688 was
occupied. Preview helpers refuse missing local output and never reuse a server.
`token-metrics.ts` captures one 1280px light page with per-card geometry; `--live`
uses the live v2 root, and `--detail` selects the component detail instead of
`/tokens`. The live spot check uses all 14 manifest states at 1280px/light.

The S1 inventories omitted `data-zfb-island-skip-ssr`. `inventory.py` recovers
both marker forms from the cached S1 tarballs, without modifying S1 evidence.
The runtime audit likewise covers both forms and every emitted marker-bearing
HTML route. A 404 route must return 404; only Chromium's exact resource error
for that document URL is expected. All asset errors and other console errors
remain fatal. Lazy islands are scrolled into view for their mount assertions.

Two defects found by the original captures are fixed in production source:

- The mobile drawer's checked translate lost to the later mobile offset because
  wind wraps the peer state in zero-specificity `:where()`. A scoped authored
  checked rule restores the drawer; see the CSS wisdom article
  `selectors/is-where-selectors.mdx`.
- Render-null demo enhancers sat at the end of the document with `when="visible"`.
  The search query and chrome/form behavior could remain inactive while their
  real UI was on screen. They now activate on load.

`behavior.spec.ts` supplements the existing smoke, preview-fidelity,
preview-token-panel, detail-workbench, and demo transition suites. Those existing
suites own sidebar identity, token-panel UI bridge/receiver, theme restore,
soft-navigation sentinel, active nav resync, and loading-overlay assertions.

## Completed local validation

- Manager builds: root 89 routes, demo 74, doc 45; all pass.
- Runtime inventory: root 88 marker-bearing pages / 853 mounted islands; demo
  73 / 652; doc 43 / 282. All mount assertions pass with no unexpected console
  errors.
- P1 scoped checks: demo-ui typecheck and demo zfb/TypeScript check pass.
  SearchResultsEnhancer and MobileNavEnhancer unit tests: 15/15 pass.
- Final recaptures: demo search (all widths/themes) and mobile-open (390px,
  both themes) have zero pixel/style differences after the scoped fixes.
- Supplemental root behavior: pass, including actual remount identity and
  token-panel UI → apply-css-vars → computed color, followed by live CSS color.
- Supplemental demo behavior: pass for native VT completion, drawer close,
  query enhancement and live filtering.
- Live v2 spot comparison: all 14 states at 1280px/light exactly match S1
  pixels/styles. See `behavior-results.md` for the contract-to-evidence table.
- Final existing demo regression project: 13/13 pass after production fixes,
  including sentinel, overlay, nav resync and theme restoration.
