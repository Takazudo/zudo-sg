import { describe, expect, it } from "vitest";
import {
  COMPONENT_DOCS_COLLECTION,
  componentDocsCollectionName,
  componentDocsRoots,
  deriveMapKeyPrefix,
  resolveComponentDoc,
} from "../component-docs.js";

describe("deriveMapKeyPrefix", () => {
  it("strips a leading packages/ segment, ./ and trailing slashes", () => {
    expect(deriveMapKeyPrefix("packages/demo-ui/src")).toBe("ui/src");
    expect(deriveMapKeyPrefix("ui")).toBe("ui");
    expect(deriveMapKeyPrefix("./ui/")).toBe("ui");
    expect(deriveMapKeyPrefix("src/components")).toBe("src/components");
  });
});

describe("componentDocsRoots", () => {
  it("pairs each components root's key prefix with its collection, in order", () => {
    expect(componentDocsRoots([{ dir: "packages/demo-ui/src" }, { dir: "ui" }])).toEqual([
      { keyPrefix: "ui/src", collection: "componentDocs" },
      { keyPrefix: "ui", collection: "componentDocs1" },
    ]);
    expect(COMPONENT_DOCS_COLLECTION).toBe("componentDocs");
    expect(componentDocsCollectionName(2)).toBe("componentDocs2");
  });
});

describe("resolveComponentDoc", () => {
  const single = componentDocsRoots([{ dir: "packages/demo-ui/src" }]);

  it("keeps the root host's single packages/demo-ui/src root resolution", () => {
    expect(resolveComponentDoc("./ui/src/button/button.stories.tsx", single)).toEqual({
      collection: "componentDocs",
      slug: "button/button",
    });
    expect(resolveComponentDoc("./ui/src/cards/card/card.stories.tsx", single)).toEqual({
      collection: "componentDocs",
      slug: "cards/card/card",
    });
  });

  it("resolves a non-ui/src root (engine-host `dir: \"ui\"`)", () => {
    expect(resolveComponentDoc("./ui/button/button.stories.tsx", componentDocsRoots([{ dir: "ui" }]))).toEqual({
      collection: "componentDocs",
      slug: "button/button",
    });
  });

  it("resolves each story against the root its key belongs to across two roots", () => {
    const roots = componentDocsRoots([{ dir: "packages/demo-ui/src" }, { dir: "packages/extra/src" }]);
    expect(resolveComponentDoc("./ui/src/button/button.stories.tsx", roots)).toEqual({
      collection: "componentDocs",
      slug: "button/button",
    });
    expect(resolveComponentDoc("./extra/src/chart/chart.stories.tsx", roots)).toEqual({
      collection: "componentDocs1",
      slug: "chart/chart",
    });
  });

  it("prefers the longest matching prefix when one root nests in another", () => {
    const roots = componentDocsRoots([{ dir: "ui" }, { dir: "ui/src" }]);
    expect(resolveComponentDoc("./ui/src/button/button.stories.tsx", roots)).toEqual({
      collection: "componentDocs1",
      slug: "button/button",
    });
    expect(resolveComponentDoc("./ui/other/other.stories.tsx", roots)).toEqual({
      collection: "componentDocs",
      slug: "other/other",
    });
  });

  it("returns null when no root matches or the path is not the story key shape", () => {
    expect(resolveComponentDoc("packages/demo-ui/src/button/button.stories.tsx", single)).toBe(null);
    expect(resolveComponentDoc("./uix/button/button.stories.tsx", componentDocsRoots([{ dir: "ui" }]))).toBe(null);
    expect(resolveComponentDoc("./ui/src/button/button.tsx", single)).toBe(null);
    expect(resolveComponentDoc("./ui/src/.stories.tsx", single)).toBe(null);
    expect(resolveComponentDoc("./ui/src/button/button.stories.tsx", [])).toBe(null);
  });
});
