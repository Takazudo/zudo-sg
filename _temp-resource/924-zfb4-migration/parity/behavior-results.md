# P1 behavior evidence

Browser runs were executed by the manager in the P1 worktree through both
machine guards. The prerequisite C2 run passed 81/81 existing browser tests on
`600cb660cb9f80b52a569ef8ed22cb550885be7d`; P1 changes no root production source.
The new focused root check independently exercises the root contracts below.

| Contract | Evidence | Result |
| --- | --- | --- |
| Root sidebar actual node identity and scroll survive soft navigation | C2 `e2e/smoke.spec.ts`: “styleguide sidebar preserves DOM identity and scroll across page transitions” | Pass |
| Root search opens, returns matching documents, filters to zero for a no-match query | P1 `behavior.spec.ts`, root project | Pass |
| Root appearance restores after reload | P1 root project, explicit dark selection and reload | Pass |
| Preview iframe emits `sg:ready` and `sg:height` | P1 root project, same-origin message recorder installed before navigation | Pass |
| A control edit remounts the rendered story | P1 root project: Label edit updates CtaButton link; previous actual link node is disconnected | Pass |
| Token panel UI edit sends `apply-css-vars` and changes computed paint | P1 root project: Color tab edits `--color-accent`; iframe message recorder observes delivery; rendered link background becomes `rgb(1, 2, 3)` | Pass |
| Live code panel CSS reaches the iframe | P1 root project: edit CodeMirror CSS; rendered link background independently becomes `rgb(4, 5, 6)` | Pass |
| Demo soft-nav sentinel survives click | Existing `e2e/demo-transition.spec.ts` | Pass (13/13 demo-smoke suite) |
| Demo loading overlay shows/paints during held fetch and hides after swap | Existing demo-transition test, request interception and computed opacity/visibility | Pass (13/13 demo-smoke suite) |
| Native `document.startViewTransition().finished` resolves | P1 demo project: wrapper counts resolved finished promises after a real navigation | Pass |
| Demo current nav re-syncs after swap | Existing demo-transition test, destination leaf under `[data-current=true]` | Pass (13/13 demo-smoke suite) |
| Mobile drawer closes on navigation | P1 demo project, actual hamburger/section/leaf click | Pass |
| Demo theme restores after reload | Existing `e2e/demo-refresh.spec.ts` | Pass (13/13 demo-smoke suite) |
| Demo `?q=product` enhances/filters, and no-match query produces zero results | P1 demo project; all six search visual recaptures also exactly match S1 | Pass |

Runtime mounting audit: root 88 marker-bearing pages / 853 mounts; demo 73 /
652; docs 43 / 282. Every island gains `data-zfb-island-mounted`, including
skip-SSR boundaries, with zero unexpected console/page errors. Full route logs
are in `root-islands.json`, `demo-islands.json`, and `doc-islands.json`.

The first supplemental root attempt incorrectly queried a CtaButton as a button;
it is a link. That harness error was corrected. The corrected root run passed,
including its remount, token UI/paint, and live CSS assertions. Each project
intentionally skips the other site's focused test.

Live v2 spots: all 14 manifest states at 1280px/light match saved S1 pixels,
computed styles, and image dimensions (`live-comparison.json`).

Preview-deploy URL smoke is owned by the manager after the root PR exists; no
root PR preview was available during this local child verification.

Final scoped demo suite: manager `CI=1 pnpm exec playwright test --project demo-smoke --workers=1` passed **13/13**, heavy-guard verdict PASS.
