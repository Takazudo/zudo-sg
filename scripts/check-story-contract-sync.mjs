#!/usr/bin/env node
// Drift guard for the duplicated story-authoring contract (ADR
// docs/adr/styleguide-engine.md decision 3, option ii).
//
// The engine's canonical `packages/styleguide/src/stories/types.ts` and the
// provider's `packages/ui/src/stories/types.ts` must stay byte-equivalent
// after their leading comment block (the header differs by design). The
// provider cannot import the engine: external consumers typecheck
// `@zudo-sg/ui` from source, so an engine import there would be TS2307 for
// every install without the engine.
//
// Usage: node scripts/check-story-contract-sync.mjs   (exit 1 on drift)

import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL = resolve(ROOT, "packages/styleguide/src/stories/types.ts");
const PROVIDER_COPY = resolve(ROOT, "packages/ui/src/stories/types.ts");

/** Drops leading whitespace plus every leading `/* … *\/` or `//` comment. */
export function stripLeadingCommentBlock(source) {
  let rest = source.replace(/^\uFEFF/, "");
  for (;;) {
    const trimmed = rest.replace(/^\s+/, "");
    if (trimmed.startsWith("/*")) {
      const end = trimmed.indexOf("*/");
      if (end === -1) return trimmed;
      rest = trimmed.slice(end + 2);
    } else if (trimmed.startsWith("//")) {
      const end = trimmed.indexOf("\n");
      rest = end === -1 ? "" : trimmed.slice(end + 1);
    } else {
      return trimmed;
    }
  }
}

function firstDifferingLine(a, b) {
  const al = a.split("\n");
  const bl = b.split("\n");
  const n = Math.max(al.length, bl.length);
  for (let i = 0; i < n; i++) {
    if (al[i] !== bl[i]) return { index: i, a: al[i], b: bl[i] };
  }
  return null;
}

function main() {
  const canonical = stripLeadingCommentBlock(readFileSync(CANONICAL, "utf8"));
  const copy = stripLeadingCommentBlock(readFileSync(PROVIDER_COPY, "utf8"));
  if (canonical === copy) {
    console.log(
      `OK — story contract in sync (${relative(ROOT, CANONICAL)} ≡ ${relative(ROOT, PROVIDER_COPY)}).`,
    );
    return 0;
  }
  const diff = firstDifferingLine(canonical, copy);
  console.error("check:story-contract-sync FAILED — the duplicated story contract drifted.");
  console.error(`  canonical: ${relative(ROOT, CANONICAL)}`);
  console.error(`  copy:      ${relative(ROOT, PROVIDER_COPY)}`);
  if (diff) {
    console.error(`  first difference at body line ${diff.index + 1} (after the leading comment block):`);
    console.error(`    canonical: ${JSON.stringify(diff.a ?? "<end of file>")}`);
    console.error(`    copy:      ${JSON.stringify(diff.b ?? "<end of file>")}`);
  }
  console.error("Apply the same edit to both files (headers may differ; everything after them may not).");
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
