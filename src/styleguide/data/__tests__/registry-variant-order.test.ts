import { describe, expect, it } from "vitest";

import { getStoryBySlug } from "../registry";

/**
 * Fast, SSR-safe guard for the variant ordering fix (#128 / #174). The browser
 * e2e (`e2e/smoke.spec.ts`) also asserts the default tab, but it's slow and
 * checks only the default; this pins the full source order and the
 * `variants[0]`-is-default invariant at the data layer, deterministically.
 *
 * `registry.ts` sorts each story's variants by the codegen-emitted
 * `storyExportOrder` (source order) rather than the alphabetical key
 * enumeration of the `import * as` namespace it builds them from.
 */
describe("registry variant ordering (#128 / #174)", () => {
  it("orders CtaButton variants in source order; variants[0] (default tab) is Playground", () => {
    const ctaButton = getStoryBySlug("cta-button");
    expect(ctaButton).toBeDefined();
    expect(ctaButton!.variants.map((v) => v.exportName)).toEqual(["Playground", "Pair"]);
    // The code panel defaults to variants[0] — this is the reported default-tab bug.
    expect(ctaButton!.variants[0]!.exportName).toBe("Playground");
  });

  it("defaults to the first source-order export, not a hardcoded Playground", () => {
    // Card authors no Playground — its first source-order export is Default,
    // so the general contract is "first-authored story", not "Playground".
    const card = getStoryBySlug("card");
    expect(card).toBeDefined();
    expect(card!.variants[0]!.exportName).toBe("Default");
  });
});
