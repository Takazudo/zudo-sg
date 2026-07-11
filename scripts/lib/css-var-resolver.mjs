// scripts/lib/css-var-resolver.mjs
//
// Pure `var()` resolver layered on top of css-var-parser.mjs. Given an
// ORDERED list of `{ label, cssText }` sources (the caller supplies the real
// cascade/import order — this module does not follow `@import` or otherwise
// discover order itself), resolves a custom property name to its final
// literal value, walking whole-value `var(--x)` chains across sources.
//
// Deliberately constrained semantics — this is NOT a cascade emulator:
//
// - Root-scoped/static declarations only. Each source is parsed independently
//   via parseCssCustomProperties(), which already discards selector/media/
//   layer/scope context (see css-var-parser.mjs) — so `:root`,
//   `:root[data-theme="..."]`, and `@theme` all collapse to one flat
//   name -> value map per source. This resolver has no concept of selector
//   specificity, media queries, or `@layer` order beyond "which source did
//   this come from."
// - Sources are parsed independently, never merged into one parse call.
//   parseCssCustomProperties() throws when the SAME file redeclares a
//   property with a different value — that's a same-file typo guard. Feeding
//   two different files into one parse call would trip that guard on a
//   legitimate cross-file override (e.g. a Tier-2 file redefining
//   `--radius-lg` from a Tier-1 file), which is exactly the case this
//   resolver exists to support.
// - "Last supplied source wins": when more than one source declares the same
//   name, the resolved value comes from the LAST source in the caller's
//   array. This approximates cascade order (later stylesheets / later
//   `:root[data-theme]` overrides win) but is not real cascade semantics —
//   there's no specificity or media-query evaluation.
// - Only WHOLE-VALUE `var(--x)` references are dereferenced recursively.
//   A declaration like `--text-body: var(--text-lg);` is fully resolved to
//   the literal `--text-lg` bottoms out at. A `var()` embedded inside a
//   larger expression (`calc(var(--x) * 2)`) or a `var()` with a fallback
//   (`var(--x, 1rem)`) is returned as-is, flagged `unresolved: true` — this
//   resolver does not evaluate `calc()` or apply fallback semantics.
// - A `var(--x)` reference to a name that is absent from EVERY source never
//   throws — it resolves to `{ value: "var(--x)", unresolved: true }`. This
//   is required for runtime-injected tokens like `--zd-surface`, which is
//   set by JS at runtime and intentionally has no static declaration in any
//   source file.

import { parseCssCustomProperties } from "./css-var-parser.mjs";

/**
 * @typedef {{ label: string, cssText: string }} CssVarSource
 */

/**
 * @typedef {{
 *   value: string,
 *   resolvedFrom: string | null,
 *   chain: string[],
 *   unresolved: boolean,
 * }} CssVarResolution
 */

/** Matches a declaration value that is EXACTLY one `var(--name)` call — no
 * fallback, no surrounding text. Whitespace around the name is tolerated. */
const WHOLE_VALUE_VAR_RE = /^var\(\s*(--[a-zA-Z0-9_-]+)\s*\)$/;

/**
 * Thrown when dereferencing a `var()` chain revisits a name already on the
 * current chain — i.e. a genuine cycle (`--a: var(--b); --b: var(--a);`).
 * Named and exported so callers can catch it specifically instead of a
 * generic Error, and so a cycle surfaces as a clear diagnostic instead of a
 * stack overflow (RangeError) from unbounded recursion.
 */
export class CssVarCycleError extends Error {
  /**
   * @param {string[]} chain The chain of names traversed, ending with the
   *   name that closes the cycle (i.e. repeats an earlier entry).
   */
  constructor(chain) {
    super(`Cycle detected while resolving var() chain: ${chain.join(" -> ")}`);
    this.name = "CssVarCycleError";
    this.chain = chain;
  }
}

/**
 * Build a resolver over an ordered list of independently-parsed CSS sources.
 *
 * @param {CssVarSource[]} sources Ordered oldest-first; later entries win on
 *   name collisions (see module header for the "last supplied source wins"
 *   caveat).
 * @returns {{ resolveCssVar: (name: string) => CssVarResolution }}
 */
export function createCssVarResolver(sources) {
  // parseCssCustomProperties is called once per source, independently — see
  // module header for why sources are never merged into one parse call.
  const parsedSources = sources.map(({ label, cssText }) => ({
    label,
    vars: parseCssCustomProperties(cssText),
  }));

  /**
   * Find the last-supplied source (highest index) that declares `name`,
   * scanning from the end so a later source's value wins over an earlier
   * one's.
   */
  function findDeclaration(name) {
    for (let i = parsedSources.length - 1; i >= 0; i--) {
      const source = parsedSources[i];
      if (source.vars.has(name)) {
        return { label: source.label, value: source.vars.get(name) };
      }
    }
    return null;
  }

  /**
   * @param {string} name
   * @param {string[]} chain Names already traversed on this call stack, for
   *   cycle detection.
   * @returns {CssVarResolution}
   */
  function resolve(name, chain) {
    if (chain.includes(name)) {
      throw new CssVarCycleError([...chain, name]);
    }
    const nextChain = [...chain, name];

    const declaration = findDeclaration(name);
    if (declaration === null) {
      // Absent from every source (e.g. runtime-injected --zd-surface) —
      // never throw, just report unresolved with the raw var() preserved.
      return {
        value: `var(${name})`,
        resolvedFrom: null,
        chain: nextChain,
        unresolved: true,
      };
    }

    const wholeValueMatch = declaration.value.match(WHOLE_VALUE_VAR_RE);
    if (wholeValueMatch === null) {
      // Literal value, OR a var() embedded in a larger expression, OR a
      // var() with a fallback — none of those are whole-value var() refs,
      // so only a bare literal (no "var(" at all) counts as fully resolved.
      const unresolved = declaration.value.includes("var(");
      return {
        value: declaration.value,
        resolvedFrom: unresolved ? null : declaration.label,
        chain: nextChain,
        unresolved,
      };
    }

    // Whole-value var() reference — recurse into the referenced name.
    const referencedName = wholeValueMatch[1];
    const referencedResolution = resolve(referencedName, nextChain);
    return {
      value: referencedResolution.value,
      resolvedFrom: referencedResolution.resolvedFrom,
      chain: referencedResolution.chain,
      unresolved: referencedResolution.unresolved,
    };
  }

  /**
   * @param {string} name Custom property name, e.g. `"--text-body"`.
   * @returns {CssVarResolution}
   */
  function resolveCssVar(name) {
    return resolve(name, []);
  }

  return { resolveCssVar };
}
