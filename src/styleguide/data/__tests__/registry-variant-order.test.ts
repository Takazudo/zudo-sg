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
  it("orders Button variants in source order; variants[0] (default tab) is Playground", () => {
    const button = getStoryBySlug("button");
    expect(button).toBeDefined();
    expect(button!.variants.map((v) => v.exportName)).toEqual([
      "Playground",
      "Variants",
      "Sizes",
      "AsLink",
      "Disabled",
      "Block",
    ]);
    // The code panel defaults to variants[0] — this is the reported default-tab bug.
    expect(button!.variants[0]!.exportName).toBe("Playground");
  });

  it("defaults to the first source-order export, not a hardcoded Playground", () => {
    // Form authors no Playground — its first source-order export is TextField,
    // so the general contract is "first-authored story", not "Playground".
    const form = getStoryBySlug("form");
    expect(form).toBeDefined();
    expect(form!.variants[0]!.exportName).toBe("TextField");
  });
});
