// Sole importer of `virtual:zudo-sg-context` (ADR docs/adr/styleguide-engine.md
// decision 10). Route entrypoints read host data through `ctx` and build every
// internal href with `withBase`, never from literals.
//
// No `node:` imports anywhere in this graph: route entrypoints render inside
// zfb's SSR bundle, so `withBase` is inlined instead of reusing host-paths.ts.

import { sgContext } from "virtual:zudo-sg-context";

export const ctx = sgContext;

/** Prefixes a root-absolute URL path with the site base (`"/docs/"` + `"/tokens"` → `"/docs/tokens"`). */
export function withBase(path: string): string {
  return ctx.base.replace(/\/+$/, "") + path;
}
