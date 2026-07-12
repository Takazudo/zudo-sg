import { describe, expect, it } from "vitest";
import { resolveSectionLabel, deriveLineKey } from "../section-label";

describe("deriveLineKey", () => {
  it("returns undefined for a slug outside lines/", () => {
    expect(deriveLineKey("company/about")).toBeUndefined();
  });

  it("returns undefined for an empty/undefined slug", () => {
    expect(deriveLineKey(undefined)).toBeUndefined();
    expect(deriveLineKey("")).toBeUndefined();
  });

  it("reads the raw key from a lines/<key>/... slug", () => {
    expect(deriveLineKey("lines/vacuum/about")).toBe("vacuum");
  });

  it("reads the raw key from a bare lines/<key> slug", () => {
    expect(deriveLineKey("lines/vacuum")).toBe("vacuum");
  });
});

describe("resolveSectionLabel", () => {
  it("returns the raw line key for a lines/<key>/... slug, ignoring frontmatter section", () => {
    expect(resolveSectionLabel("lines/vacuum/about", "Custom")).toBe("vacuum");
  });

  it("returns frontmatter.section when set (corporate scope)", () => {
    expect(resolveSectionLabel("company/about", "Company")).toBe("Company");
  });

  it("falls back to the slug's first segment when section is unset (corporate scope)", () => {
    expect(resolveSectionLabel("company/about", undefined)).toBe("company");
  });

  it("falls back to the slug's first segment for a single-segment slug", () => {
    expect(resolveSectionLabel("news", undefined)).toBe("news");
  });

  it("returns an empty string for an empty slug with no section", () => {
    expect(resolveSectionLabel("", undefined)).toBe("");
  });
});
