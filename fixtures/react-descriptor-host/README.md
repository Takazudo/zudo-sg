# Packed React descriptor host

This independent Node 24 (`>=24 <25`, required by zudo-doc 7) consumer uses React/ReactDOM 19.3.0 and Monaco 0.57.0 inside its own preview document. The catalog and chrome use the engine's renderer. No React adapter or React dependency is added to the engine.

From the repository, run `pnpm verify:react-descriptor-host-install -- --keep`. The verifier packs the current built engine, installs it outside the workspace, records installed versions and its own complete audit, builds the preview, captures real committed fixtures, validates receipts, then builds and exercises `/styleguide/` and `/`. `--keep` retains the foreign directory, generated lockfile, captures, audit and graph evidence. Run the repository's package build first after changing engine source.

All direct fixture dependencies are exact. A committed lock containing a previous local tarball's integrity would not verify a current-head pack, so each verifier install generates its own independent lock and audits that actual graph. KaTeX is on 0.19.0, the line zudo-doc 7 requires, which also clears the 0.16.47 low advisory the doc 6 graph carried; critical, high and moderate findings fail. This fresh install does not establish compatibility of every historical consumer lockfile (see issue #963).

`preview/entry.tsx` adapts the public `createExternalPreviewRuntime` controller to one React root. Ordinary prop edits and Reset call `root.render`; full fixture Reset unmounts the root and disposes the editor, model, owned worker, observer, listener and portal. The component uses an owned JSON worker through Monaco's current `createWebWorker({worker})` API. Validation executes in that worker, including after a full reset. No CDN or shared JSON worker manager is used.

Monaco 0.57 also embeds DOMPurify 3.4.15 in its ESM files. The narrow resolver in `scripts/prepare.mjs` replaces only Monaco's exact sanitizer import with installed DOMPurify 3.4.16. A dependency override alone would leave the vulnerable embedded copy intact. The emitted esbuild graph must contain the patched ESM file and exclude the embedded file; the browser additionally exercises Monaco's sanitizer. The override covers Monaco's package dependency separately.

One canonical generator reads the actual fixture source and emits descriptors, loader metadata/functions, displayed source and image promises. Capture calls the actual runtime `whenStable()` barrier, saves image/identity/source receipts, and validates the public files before `zfb build`. Final validation uses `dist/styleguide` for non-root public assets and `dist` for root assets. Captures are generated locally; binary images and installed/build outputs are ignored.

To migrate a project-owned adapter:

1. Keep your framework, component loader and asset bundler in the host. Register plain descriptor metadata instead of passing React components to engine routes.
2. Replace bespoke ready/props/reset listeners with the public runtime controller. Return `update`, `dispose`, and a renderer-specific `whenStable` barrier from `mount`; honor the provided abort signal after every asynchronous import.
3. Use `externalPreview: {url: "/frame/", runtime: "external-v1"}`. Remove local pages shadowing the engine's component routes. Host chrome stays renderer independent.
4. Generate source/loader/capture entries from the same canonical keys. Build preview assets, capture committed fixtures, validate output maps and images, then build the catalog.
5. Run the packed verifier against both base paths and review its emitted graph, audit and browser evidence before publishing.

The pinned zfb image checker can warn about the non-root capture URL before its public-file copy is complete. The verifier keeps that warning visible and independently validates the final `dist/styleguide/captures` bytes and the browser's 200 response/natural dimensions. A missing promised image fails validation; this warning is not used as an exception to the asset contract.
