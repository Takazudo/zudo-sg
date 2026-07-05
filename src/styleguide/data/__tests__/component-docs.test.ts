import { describe, expect, it } from "vitest";
import {
  COMPONENT_DOCS_COLLECTION,
  componentDocSlug,
} from "../component-docs";

describe("componentDocSlug", () => {
  it("derives the collection slug from a story registry path", () => {
    expect(componentDocSlug("./ui/src/button/button.stories.tsx")).toBe(
      "button/button",
    );
    expect(componentDocSlug("./ui/src/site-header/site-header.stories.tsx")).toBe(
      "site-header/site-header",
    );
  });

  it("returns null for a path that is not the story glob shape", () => {
    // Wrong prefix (not the glob-relative story path).
    expect(componentDocSlug("packages/ui/src/button/button.stories.tsx")).toBe(
      null,
    );
    // Wrong suffix (not a story file).
    expect(componentDocSlug("./ui/src/button/button.tsx")).toBe(null);
    // Empty stem.
    expect(componentDocSlug("./ui/src/.stories.tsx")).toBe(null);
  });

  it("exposes the collection name registered in zfb.config.ts", () => {
    expect(COMPONENT_DOCS_COLLECTION).toBe("componentDocs");
  });
});
