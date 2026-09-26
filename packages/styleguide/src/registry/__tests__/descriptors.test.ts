import { describe, expect, it } from "vitest";

import { validateStoryDescriptors, type StoryDescriptor } from "../index.js";

function desc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "button",
    slug: "button",
    title: "Button",
    category: "Actions",
    variants: [{ exportName: "Default", name: "Default" }],
    ...overrides,
  };
}

function errorOf(input: unknown, options?: Parameters<typeof validateStoryDescriptors>[1]): string {
  try {
    validateStoryDescriptors(input, options);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected validateStoryDescriptors to throw");
}

describe("validateStoryDescriptors", () => {
  it("accepts valid descriptors and returns normalized plain copies", () => {
    const input = [
      desc({
        description: "Clickable",
        sourcePath: "src/button.stories.tsx",
        order: 2,
        extra: "dropped",
        variants: [
          {
            exportName: "Primary",
            name: "Primary",
            controls: [{ type: "boolean", prop: "disabled", label: "Disabled", defaultValue: false }],
          },
        ],
        thumbnail: { kind: "image", src: "/thumbs/button.png", width: 320, height: 200, alt: "Button" },
      }),
      desc({ id: "card", slug: "card", title: "Card", thumbnail: { kind: "placeholder", note: "Pending" } }),
    ];
    const out = validateStoryDescriptors(input);
    expect(out).toEqual<StoryDescriptor[]>([
      {
        id: "button",
        slug: "button",
        title: "Button",
        category: "Actions",
        description: "Clickable",
        sourcePath: "src/button.stories.tsx",
        order: 2,
        variants: [
          {
            exportName: "Primary",
            name: "Primary",
            controls: [{ type: "boolean", prop: "disabled", label: "Disabled", defaultValue: false }],
          },
        ],
        thumbnail: { kind: "image", src: "/thumbs/button.png", width: 320, height: 200, alt: "Button" },
      },
      {
        id: "card",
        slug: "card",
        title: "Card",
        category: "Actions",
        variants: [{ exportName: "Default", name: "Default" }],
        thumbnail: { kind: "placeholder", note: "Pending" },
      },
    ]);
    expect(out[0]).not.toBe(input[0]);
  });

  it("keeps URL-safe slugs verbatim (never re-slugified from the title)", () => {
    const [d] = validateStoryDescriptors([desc({ slug: "legacy_Slug-1", title: "Something Else Entirely" })]);
    expect(d?.slug).toBe("legacy_Slug-1");
  });

  it("accepts an empty array", () => {
    expect(validateStoryDescriptors([])).toEqual([]);
  });

  it("rejects non-array input", () => {
    expect(errorOf({})).toMatch(/^\[zudo-sg\] storyDescriptors must be an array/);
    expect(errorOf(null)).toMatch(/got null/);
    expect(errorOf(undefined)).toMatch(/got undefined/);
  });

  it("rejects a non-object entry, naming its index", () => {
    expect(errorOf([desc(), "nope"])).toBe("[zudo-sg] storyDescriptors[1] (id (missing)): must be an object");
  });

  for (const key of ["id", "slug", "title", "category"]) {
    it(`rejects a missing "${key}"`, () => {
      const msg = errorOf([desc(), desc({ id: "second", slug: "second", [key]: undefined })]);
      expect(msg).toMatch(/^\[zudo-sg\] storyDescriptors\[1\] /);
      expect(msg).toContain(`"${key}" must be a non-empty string`);
      if (key !== "id") expect(msg).toContain('(id "second")');
    });

    it(`rejects an empty "${key}"`, () => {
      const msg = errorOf([desc({ [key]: "  " })]);
      expect(msg).toContain("storyDescriptors[0]");
      expect(msg).toContain(`"${key}" must be a non-empty string`);
    });
  }

  it("rejects a duplicate id, naming both entries", () => {
    const msg = errorOf([desc(), desc({ slug: "button-2" })]);
    expect(msg).toBe(
      '[zudo-sg] storyDescriptors[1] (id "button"): duplicate id "button" (also used by storyDescriptors[0])',
    );
  });

  it("rejects a duplicate slug, naming both entries", () => {
    const msg = errorOf([desc(), desc({ id: "button-alt" })]);
    expect(msg).toBe(
      '[zudo-sg] storyDescriptors[1] (id "button-alt"): duplicate slug "button" (also used by storyDescriptors[0])',
    );
  });

  it("rejects an empty or missing variants list", () => {
    expect(errorOf([desc({ variants: [] })])).toBe(
      '[zudo-sg] storyDescriptors[0] (id "button"): "variants" must be a non-empty array',
    );
    expect(errorOf([desc({ variants: undefined })])).toContain('"variants" must be a non-empty array');
  });

  it("rejects an empty exportName", () => {
    const msg = errorOf([desc({ variants: [{ exportName: "", name: "X" }] })]);
    expect(msg).toBe('[zudo-sg] storyDescriptors[0] (id "button"): variants[0].exportName must be a non-empty string');
  });

  it("rejects a duplicate exportName within one story", () => {
    const msg = errorOf([
      desc({
        variants: [
          { exportName: "Default", name: "A" },
          { exportName: "Default", name: "B" },
        ],
      }),
    ]);
    expect(msg).toBe('[zudo-sg] storyDescriptors[0] (id "button"): variants[1]: duplicate exportName "Default"');
  });

  it("allows the same exportName in different stories", () => {
    expect(() => validateStoryDescriptors([desc(), desc({ id: "card", slug: "card" })])).not.toThrow();
  });

  for (const slug of ["a/b", "a b", "tab\there", "a?b", "a#b", "a%20b", "..", "."]) {
    it(`rejects the non-URL-safe slug ${JSON.stringify(slug)}`, () => {
      const msg = errorOf([desc({ slug })]);
      expect(msg).toContain('storyDescriptors[0] (id "button")');
      expect(msg).toContain("is not URL-safe");
    });
  }

  it("rejects reserved slugs and the slug the preview endpoint occupies", () => {
    expect(errorOf([desc({ slug: "tokens" })])).toContain('slug "tokens" is reserved');
    expect(errorOf([desc({ slug: "preview" })])).toContain('slug "preview" is reserved');
    // An out-of-namespace preview endpoint frees "preview".
    expect(
      validateStoryDescriptors([desc({ slug: "preview" })], { routes: { componentsPreview: "/sg-preview" } })[0]?.slug,
    ).toBe("preview");
  });

  const badThumbs: Array<[string, unknown, string]> = [
    ["a non-object", "thumb.png", "thumbnail must be an object"],
    ["an unknown kind", { kind: "video" }, 'thumbnail.kind must be "image" or "placeholder"'],
    ["an image without src", { kind: "image", width: 1, height: 1 }, 'non-empty "src"'],
    ["an image without width", { kind: "image", src: "/a.png", height: 1 }, 'positive finite "width"'],
    ["an image with zero height", { kind: "image", src: "/a.png", width: 1, height: 0 }, 'positive finite "height"'],
    ["an image with a non-string alt", { kind: "image", src: "/a.png", width: 1, height: 1, alt: 3 }, '"alt"'],
    ["a placeholder without note", { kind: "placeholder" }, 'non-empty "note"'],
  ];
  for (const [label, thumbnail, fragment] of badThumbs) {
    it(`rejects a malformed thumbnail: ${label}`, () => {
      const msg = errorOf([desc({ thumbnail })]);
      expect(msg).toContain('[zudo-sg] storyDescriptors[0] (id "button"): malformed thumbnail:');
      expect(msg).toContain(fragment);
    });
  }

  it("rejects functions anywhere in a descriptor", () => {
    const msg = errorOf([desc({ variants: [{ exportName: "Default", name: "Default", render: () => null }] })]);
    expect(msg).toBe(
      '[zudo-sg] storyDescriptors[0] (id "button"): descriptor.variants[0].render is a function; descriptors must be plain data',
    );
  });

  it("rejects wrongly-typed optional fields", () => {
    expect(errorOf([desc({ order: "1" })])).toContain('"order" must be a finite number');
    expect(errorOf([desc({ description: 1 })])).toContain('"description" must be a string');
    expect(errorOf([desc({ sourcePath: false })])).toContain('"sourcePath" must be a string');
    expect(errorOf([desc({ variants: [{ exportName: "A", name: "" }] })])).toContain("variants[0].name");
    expect(errorOf([desc({ variants: [{ exportName: "A", name: "A", controls: {} }] })])).toContain(
      "variants[0].controls must be an array",
    );
  });
});
