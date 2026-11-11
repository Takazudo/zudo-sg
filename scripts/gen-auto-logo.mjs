#!/usr/bin/env node
// scripts/gen-auto-logo.mjs
//
// Retired for the root site (#1063). public/img/logo.svg, public/favicon*,
// and public/img/brand are byte copies of the A06 kit in doc/public.
// The previous generator wrote zudo-doc's deterministic plate over those
// files. Do not restore that write.

console.error(
  "gen:logo is retired. Root logo, favicon, and brand files are the A06 kit copied from doc/public (#1063). Do not regenerate them.",
);
process.exit(1);
