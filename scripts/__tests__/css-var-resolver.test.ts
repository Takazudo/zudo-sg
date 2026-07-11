// scripts/__tests__/css-var-resolver.test.ts
//
// Unit tests for scripts/lib/css-var-resolver.mjs. Fixtures are modeled on
// the real Tier1 (raw primitives) -> Tier2 (semantic alias) chains this
// resolver exists to walk, plus the runtime-injected `--zd-surface` case
// (set by JS at runtime, never statically declared) that must resolve to
// `unresolved: true` instead of throwing.

import { describe, expect, it } from "vitest";
import { createCssVarResolver, CssVarCycleError } from "../lib/css-var-resolver.mjs";

describe("createCssVarResolver", () => {
  it("dereferences a Tier2 -> Tier1 whole-value var() alias to its literal", () => {
    const tier1 = `:root { --text-lg: 1.25rem; }`;
    const tier2 = `:root { --text-body: var(--text-lg); }`;
    const { resolveCssVar } = createCssVarResolver([
      { label: "tier1", cssText: tier1 },
      { label: "tier2", cssText: tier2 },
    ]);

    const result = resolveCssVar("--text-body");
    expect(result.value).toBe("1.25rem");
    expect(result.resolvedFrom).toBe("tier1");
    expect(result.chain).toEqual(["--text-body", "--text-lg"]);
    expect(result.unresolved).toBe(false);
  });

  it("last supplied source wins when two sources declare the same name", () => {
    const source1 = `:root { --radius-lg: 1rem; }`;
    const source2 = `:root { --radius-lg: 0.5rem; }`;
    const { resolveCssVar } = createCssVarResolver([
      { label: "source1", cssText: source1 },
      { label: "source2", cssText: source2 },
    ]);

    const result = resolveCssVar("--radius-lg");
    expect(result.value).toBe("0.5rem");
    expect(result.resolvedFrom).toBe("source2");
    expect(result.unresolved).toBe(false);
  });

  it("resolves a var() to a name absent from every source as unresolved, never throws", () => {
    // Mirrors --zd-surface: injected by JS at runtime, intentionally never
    // declared in any static CSS source.
    const semantic = `:root { --color-surface: var(--zd-surface); }`;
    const { resolveCssVar } = createCssVarResolver([{ label: "semantic", cssText: semantic }]);

    const result = resolveCssVar("--color-surface");
    expect(result.unresolved).toBe(true);
    expect(result.value).toBe("var(--zd-surface)");
    expect(result.resolvedFrom).toBe(null);
  });

  it("resolving an undeclared name directly is also unresolved, never throws", () => {
    const { resolveCssVar } = createCssVarResolver([{ label: "empty", cssText: `:root {}` }]);

    const result = resolveCssVar("--zd-surface");
    expect(result.unresolved).toBe(true);
    expect(result.value).toBe("var(--zd-surface)");
  });

  it("throws CssVarCycleError on a var() -> var() -> var() cycle instead of overflowing", () => {
    const cyclic = `
      :root {
        --loop-a: var(--loop-b);
        --loop-b: var(--loop-c);
        --loop-c: var(--loop-a);
      }
    `;
    const { resolveCssVar } = createCssVarResolver([{ label: "cyclic", cssText: cyclic }]);

    expect(() => resolveCssVar("--loop-a")).toThrow(CssVarCycleError);
    expect(() => resolveCssVar("--loop-a")).toThrow(/Cycle detected/);
  });

  it("passes through an embedded var() inside a larger expression as unresolved", () => {
    const css = `
      :root {
        --space-2: 0.5rem;
        --shadow-x: calc(var(--space-2) * 2);
      }
    `;
    const { resolveCssVar } = createCssVarResolver([{ label: "source", cssText: css }]);

    const result = resolveCssVar("--shadow-x");
    expect(result.unresolved).toBe(true);
    expect(result.value).toBe("calc(var(--space-2) * 2)");
  });

  it("passes through a var() with a fallback as unresolved", () => {
    const css = `:root { --gap: var(--space-3, 1rem); }`;
    const { resolveCssVar } = createCssVarResolver([{ label: "source", cssText: css }]);

    const result = resolveCssVar("--gap");
    expect(result.unresolved).toBe(true);
    expect(result.value).toBe("var(--space-3, 1rem)");
  });
});
