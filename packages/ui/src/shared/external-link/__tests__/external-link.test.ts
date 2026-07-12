import { describe, expect, it } from "vitest";
import { externalLinkAttrs, EXTERNAL_GLYPH, INTERNAL_GLYPH } from "../external-link";

describe("externalLinkAttrs", () => {
  it("returns target=_blank + rel=noopener noreferrer when external", () => {
    expect(externalLinkAttrs(true)).toEqual({ target: "_blank", rel: "noopener noreferrer" });
  });

  it("returns an empty object when not external", () => {
    expect(externalLinkAttrs(false)).toEqual({});
    expect(externalLinkAttrs()).toEqual({});
  });
});

describe("glyphs", () => {
  it("exposes distinct external/internal glyphs", () => {
    expect(EXTERNAL_GLYPH).toBe("↗");
    expect(INTERNAL_GLYPH).toBe("→");
  });
});
