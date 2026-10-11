# zfb 4 migration findings

This folder keeps the three text records needed to explain the migration decisions and final parity result. The original `_temp-resource/924-zfb4-migration/` tree was removed after these files were copied and verified. Captures, generated CSS, screenshots, JSON inventories, tarballs, and raw command logs were temporary evidence and were not retained here; their filenames remain in the text where they help identify the original probe.

## Records

- [D1 migration decisions](decisions.md) records the chosen CSS pipeline, dashboard boundary, wind tokens and breakpoints, and test harness.
- [S2 package spike findings](spike/findings.md) records the published package contracts and runnable API probes.
- [P1 parity matrix](parity/matrix.md) records all classified visual differences and the accepted or fixed outcomes.

## Final route and parity results

C2 recorded 88 HTML routes in the final root build, with zfb reporting 89 pages because `/robots.txt` is counted separately. This matches the S1 baseline. The four `@takazudo/zudo-sg` injected route sources are catalog index, catalog slug, preview, and tokens; none is shadowed by a host page. The route contract is summarized in [CLAUDE.md](../../../CLAUDE.md).

P1 completed 84 local capture pairs and 14 live v2 spot checks. The route audit covered 204 marker-bearing pages and 1,787 mounted islands with no unexpected browser errors. All 84 visual differences were classified with zero open parity defects; the demo smoke passed 13/13.

## Upstream follow-up

The missing public dashboard mount API in `@takazudo/zdtp@0.8.6` was already reported in [zdtp issue 1032](https://github.com/Takazudo/zudo-design-token-panel/issues/1032); C3 deduplicated against that open report. The migration uses the opaque Preact adapter described in D1 while the additive API request remains tracked.

C3 filed [zfb issue 4149](https://github.com/Takazudo/zudo-front-builder/issues/4149) for an in-process JavaScript CSS compiler API. The completed `zfb css` CLI works for the migration, but Node build integrations still need to spawn it and manage temporary config/output files.
