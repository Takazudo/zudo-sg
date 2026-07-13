// Unit tests for scripts/lib/component-scaffold.mjs — the pure helpers
// behind `pnpm new:component` (scripts/new-component.mjs). These exercise
// validation, name conversion, template shape, and the barrel-insertion
// algorithm directly (no fs, no child process) — see check-links.test.ts /
// gen-z-index.test.ts for the full-script spawn-test pattern used elsewhere;
// that isn't needed here since none of this logic touches the filesystem.

import { describe, expect, it } from "vitest";
import {
  VALID_CATEGORIES,
  assertUnusedName,
  assertValidCategory,
  assertValidName,
  categorySlug,
  componentTemplate,
  insertBarrelExport,
  storiesTemplate,
  testTemplate,
  toPascalCase,
} from "../lib/component-scaffold.mjs";
import { BARREL_INDEX, COMPONENTS_ROOT, UI_PACKAGE_NAME } from "../lib/scaffold-config.mjs";
import { parseArgs } from "../new-component.mjs";

describe("scaffold-config", () => {
  it("exposes the default components root, barrel index, and package name", () => {
    expect(COMPONENTS_ROOT).toBe("packages/ui/src");
    expect(BARREL_INDEX).toBe("packages/ui/src/index.ts");
    expect(UI_PACKAGE_NAME).toBe("@zudo-sg/ui");
  });

  it("nests BARREL_INDEX under COMPONENTS_ROOT (the barrel lives inside the scanned tree)", () => {
    expect(BARREL_INDEX).not.toBeNull();
    expect(BARREL_INDEX?.startsWith(`${COMPONENTS_ROOT}/`)).toBe(true);
  });
});

describe("new-component.mjs parseArgs", () => {
  it("parses name, --category, and defaults --skip-barrel/--nested to false", () => {
    expect(parseArgs(["demo-widget", "--category", "Layout"])).toEqual({
      name: "demo-widget",
      category: "Layout",
      skipBarrel: false,
      nested: false,
    });
  });

  it("parses --category=<value> form", () => {
    expect(parseArgs(["demo-widget", "--category=Layout"])).toEqual({
      name: "demo-widget",
      category: "Layout",
      skipBarrel: false,
      nested: false,
    });
  });

  it("sets skipBarrel when --skip-barrel is passed", () => {
    expect(parseArgs(["demo-widget", "--category", "Layout", "--skip-barrel"])).toEqual({
      name: "demo-widget",
      category: "Layout",
      skipBarrel: true,
      nested: false,
    });
  });

  it("parses --skip-barrel regardless of position", () => {
    expect(parseArgs(["--skip-barrel", "demo-widget", "--category", "Layout"])).toEqual({
      name: "demo-widget",
      category: "Layout",
      skipBarrel: true,
      nested: false,
    });
  });

  it("sets nested when --nested is passed", () => {
    expect(parseArgs(["demo-widget", "--category", "Layout", "--nested"])).toEqual({
      name: "demo-widget",
      category: "Layout",
      skipBarrel: false,
      nested: true,
    });
  });

  it("parses --nested regardless of position, combined with --skip-barrel", () => {
    expect(
      parseArgs(["--nested", "demo-widget", "--skip-barrel", "--category", "Layout"]),
    ).toEqual({
      name: "demo-widget",
      category: "Layout",
      skipBarrel: true,
      nested: true,
    });
  });
});

describe("toPascalCase", () => {
  it("converts a single-word kebab name", () => {
    expect(toPascalCase("badge")).toBe("Badge");
  });

  it("converts a multi-word kebab name", () => {
    expect(toPascalCase("demo-widget")).toBe("DemoWidget");
    expect(toPascalCase("site-header")).toBe("SiteHeader");
  });
});

describe("assertValidName", () => {
  it("accepts kebab-case names", () => {
    expect(() => assertValidName("demo-widget")).not.toThrow();
    expect(() => assertValidName("badge")).not.toThrow();
    expect(() => assertValidName("a2z")).not.toThrow();
  });

  it("rejects non-kebab-case names", () => {
    for (const bad of ["DemoWidget", "demoWidget", "demo_widget", "-demo", "demo-", "demo--widget", "1demo", ""]) {
      expect(() => assertValidName(bad), bad).toThrow();
    }
  });
});

describe("assertValidCategory", () => {
  it("accepts every StoryCategory member", () => {
    for (const category of VALID_CATEGORIES) {
      expect(() => assertValidCategory(category)).not.toThrow();
    }
  });

  it("rejects an unknown category", () => {
    expect(() => assertValidCategory("Widgets")).toThrow(/Widgets/);
  });
});

describe("categorySlug", () => {
  it("lowercases a single-word category", () => {
    expect(categorySlug("Landing")).toBe("landing");
    expect(categorySlug("Layout")).toBe("layout");
  });

  it("hyphenates a multi-word category", () => {
    expect(categorySlug("Data Display")).toBe("data-display");
  });

  it("produces a distinct slug per category (no accidental collisions across the union)", () => {
    const slugs = VALID_CATEGORIES.map(categorySlug);
    expect(new Set(slugs).size).toBe(VALID_CATEGORIES.length);
  });
});

describe("assertUnusedName", () => {
  it("passes when the name isn't taken", () => {
    expect(() => assertUnusedName("demo-widget", ["badge", "button"])).not.toThrow();
  });

  it("throws when the name is already a component directory", () => {
    expect(() => assertUnusedName("badge", ["badge", "button"])).toThrow(/already exists/);
  });
});

describe("componentTemplate", () => {
  it("emits a typed-props skeleton with the house pattern", () => {
    const src = componentTemplate({ pascalName: "DemoWidget", kebabName: "demo-widget" });
    expect(src).toContain(`export type DemoWidgetVariant = "primary" | "secondary";`);
    expect(src).toContain("export type DemoWidgetProps = {");
    expect(src).toContain("class?: string;");
    expect(src).toContain("const variants: Record<DemoWidgetVariant, string> = {");
    expect(src).toContain("focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus");
    expect(src).toContain("export function DemoWidget(");
    expect(src).toContain(`import { cx } from "../lib/cx";`);
  });

  it("uses a one-deeper relative lib/cx import when nested (category-dir scaffold)", () => {
    const src = componentTemplate({
      pascalName: "DemoWidget",
      kebabName: "demo-widget",
      nested: true,
    });
    expect(src).toContain(`import { cx } from "../../lib/cx";`);
    expect(src).not.toContain(`from "../lib/cx"`);
  });
});

describe("storiesTemplate", () => {
  it("emits a StoryMeta + typed Playground story", () => {
    const src = storiesTemplate({ pascalName: "DemoWidget", kebabName: "demo-widget", category: "Layout" });
    expect(src).toContain(`import { DemoWidget, type DemoWidgetProps } from "./demo-widget";`);
    expect(src).toContain('category: "Layout",');
    // The usage snippet's import specifier is derived from scaffold-config's
    // UI_PACKAGE_NAME, not hardcoded — see component-scaffold.mjs.
    expect(src).toContain(`import { DemoWidget } from "${UI_PACKAGE_NAME}";`);
    expect(src).toContain("export const Playground: Story<DemoWidgetProps> = {");
    expect(src).toContain('prop: "variant"');
  });
});

describe("testTemplate", () => {
  it("emits a starter render + class-map test suite", () => {
    const src = testTemplate({ pascalName: "DemoWidget", kebabName: "demo-widget" });
    expect(src).toContain(`import { DemoWidget } from "../demo-widget";`);
    expect(src).toContain('describe("DemoWidget", () => {');
    expect(src).toContain("renders its children");
  });
});

describe("insertBarrelExport", () => {
  // Trimmed fixture mirroring packages/ui/src/index.ts's real shape: a
  // header-then-blocks section per category, blocks separated by one blank
  // line, no blank line between a header and its first block.
  const FIXTURE = [
    `// ── Actions ──────────────────────────────────────────────────────────────`,
    `export { Button } from "./button/button";`,
    `export type { ButtonProps, ButtonVariant, ButtonSize } from "./button/button";`,
    ``,
    `export { Link } from "./link/link";`,
    `export type { LinkProps, LinkVariant } from "./link/link";`,
    ``,
    `// ── Data display ─────────────────────────────────────────────────────────`,
    `export { Badge } from "./badge/badge";`,
    `export type { BadgeProps, BadgeTone, BadgeVariant } from "./badge/badge";`,
    ``,
    `// ── Utilities ────────────────────────────────────────────────────────────`,
    `export { cx } from "./lib/cx";`,
    `export type { ClassValue } from "./lib/cx";`,
    ``,
  ].join("\n");

  it("inserts the new export block into the matching category section", () => {
    const result = insertBarrelExport(FIXTURE, {
      pascalName: "Stat",
      kebabName: "stat",
      category: "Data Display",
    });
    expect(result).toContain(
      `export { Badge } from "./badge/badge";\nexport type { BadgeProps, BadgeTone, BadgeVariant } from "./badge/badge";\n\n` +
        `export { Stat } from "./stat/stat";\nexport type { StatProps, StatVariant } from "./stat/stat";\n\n` +
        `// ── Utilities`,
    );
  });

  it("sorts alphabetically within the section (inserts before a later name)", () => {
    const result = insertBarrelExport(FIXTURE, {
      pascalName: "Avatar",
      kebabName: "avatar",
      category: "Actions",
    });
    const avatarIdx = result.indexOf('export { Avatar }');
    const buttonIdx = result.indexOf('export { Button }');
    const linkIdx = result.indexOf('export { Link }');
    expect(avatarIdx).toBeGreaterThan(-1);
    expect(avatarIdx).toBeLessThan(buttonIdx);
    expect(buttonIdx).toBeLessThan(linkIdx);
  });

  it("sorts a LAST-alphabetical name to the END even past a `default as` re-export block", () => {
    // Regression (#292): the real index.ts has `export { default as XEnhancer }`
    // blocks. The old sort key captured the first raw token ("default"), which
    // is lowercase and therefore sorts AFTER every PascalCase name in a
    // case-sensitive compare — so inserting a late name (e.g. "Zebra") matched
    // the `default`-keyed block first and landed at the TOP of the section
    // instead of the end. The key must derive from the BOUND name.
    const withDefaultAs = [
      `// ── Forms ────────────────────────────────────────────────────────────────`,
      `export { default as ContactFormEnhancer } from "./contact-form/contact-form-enhancer";`,
      `export { ContactForm } from "./contact-form/contact-form";`,
      ``,
      `export { Textarea } from "./textarea/textarea";`,
      `export type { TextareaProps } from "./textarea/textarea";`,
      ``,
      `// ── Utilities ────────────────────────────────────────────────────────────`,
      `export { cx } from "./lib/cx";`,
      ``,
    ].join("\n");
    const result = insertBarrelExport(withDefaultAs, {
      pascalName: "Zebra",
      kebabName: "zebra",
      category: "Forms",
      nested: true,
    });
    const zebraIdx = result.indexOf("export { Zebra }");
    const textareaIdx = result.indexOf("export { Textarea }");
    const utilitiesIdx = result.indexOf("// ── Utilities");
    // Lands AFTER Textarea (last existing entry) and BEFORE the next header.
    expect(zebraIdx).toBeGreaterThan(textareaIdx);
    expect(zebraIdx).toBeLessThan(utilitiesIdx);
    expect(result).toContain(`export { Zebra } from "./forms/zebra/zebra";`);
  });

  it("matches the category case-insensitively against a differently-cased header", () => {
    // The real file's header reads "Data display" (lowercase d) for the
    // "Data Display" StoryCategory — the match must not be case-sensitive.
    const result = insertBarrelExport(FIXTURE, {
      pascalName: "Stat",
      kebabName: "stat",
      category: "Data Display",
    });
    expect(result).toContain('export { Stat }');
  });

  it("throws when no section header matches the category", () => {
    const noNavFixture = FIXTURE; // fixture has no Navigation section
    expect(() =>
      insertBarrelExport(noNavFixture, { pascalName: "NavMenu", kebabName: "nav-menu", category: "Navigation" }),
    ).toThrow(/no ".*" section header/);
  });

  it("keeps no blank line between a header and the first block", () => {
    const result = insertBarrelExport(FIXTURE, {
      pascalName: "Avatar",
      kebabName: "avatar",
      category: "Actions",
    });
    expect(result).toContain(
      `// ── Actions ──────────────────────────────────────────────────────────────\nexport { Avatar }`,
    );
  });

  // #289 — a --nested scaffold auto-inserts into the barrel (the `!nested`
  // gate that used to skip this entirely is gone), using the nested
  // `./<category-slug>/<name>/<name>` import specifier instead of the flat
  // `./<name>/<name>` one.
  describe("nested: true (category-nested import specifier)", () => {
    it("imports from ./<category-slug>/<name>/<name>, alphabetically in the matching section", () => {
      const result = insertBarrelExport(FIXTURE, {
        pascalName: "Stat",
        kebabName: "stat",
        category: "Data Display",
        nested: true,
      });
      expect(result).toContain(
        `export { Badge } from "./badge/badge";\nexport type { BadgeProps, BadgeTone, BadgeVariant } from "./badge/badge";\n\n` +
          `export { Stat } from "./data-display/stat/stat";\n` +
          `export type { StatProps, StatVariant } from "./data-display/stat/stat";\n\n` +
          `// ── Utilities`,
      );
    });

    it("still sorts alphabetically among the section's existing (flat-imported) exports", () => {
      const result = insertBarrelExport(FIXTURE, {
        pascalName: "Avatar",
        kebabName: "avatar",
        category: "Actions",
        nested: true,
      });
      const avatarIdx = result.indexOf('export { Avatar }');
      const buttonIdx = result.indexOf('export { Button }');
      expect(result).toContain(`export { Avatar } from "./actions/avatar/avatar";`);
      expect(avatarIdx).toBeGreaterThan(-1);
      expect(avatarIdx).toBeLessThan(buttonIdx);
    });

    it("defaults nested to false (flat import specifier) when omitted", () => {
      const result = insertBarrelExport(FIXTURE, {
        pascalName: "Stat",
        kebabName: "stat",
        category: "Data Display",
      });
      expect(result).toContain(`export { Stat } from "./stat/stat";`);
      expect(result).not.toContain("./data-display/stat/stat");
    });
  });

  // #289 — the barrel cannot hold two exports of the same Pascal name, even
  // though two different categories may each scaffold a same-named component
  // on disk (STORIES.md §2). insertBarrelExport must fail loudly instead of
  // silently producing a colliding export.
  describe("duplicate Pascal name across categories", () => {
    it("throws a clear, actionable error instead of inserting a colliding export", () => {
      expect(() =>
        insertBarrelExport(FIXTURE, {
          pascalName: "Badge",
          kebabName: "badge",
          category: "Actions",
          nested: true,
        }),
      ).toThrow(/"Badge" is already exported from ".\/badge\/badge" in the "Data display" section/);
    });

    it("names the existing export's path and section, and suggests a manual alias", () => {
      try {
        insertBarrelExport(FIXTURE, { pascalName: "Button", kebabName: "button", category: "Data Display" });
        throw new Error("expected insertBarrelExport to throw");
      } catch (err) {
        expect((err as Error).message).toContain("./button/button");
        expect((err as Error).message).toContain("Actions");
        expect((err as Error).message).toMatch(/alias/i);
      }
    });

    it("detects a collision via a `default as` rename, not just a bare export name", () => {
      const fixtureWithDefaultAs = [
        `// ── Navigation ───────────────────────────────────────────────────────────`,
        `export { default as NavEnhancer } from "./chrome/nav-enhancer/nav-enhancer";`,
        ``,
        `// ── Data display ─────────────────────────────────────────────────────────`,
        `export { Badge } from "./badge/badge";`,
        `export type { BadgeProps } from "./badge/badge";`,
        ``,
      ].join("\n");
      expect(() =>
        insertBarrelExport(fixtureWithDefaultAs, {
          pascalName: "NavEnhancer",
          kebabName: "nav-enhancer",
          category: "Data Display",
          nested: true,
        }),
      ).toThrow(/"NavEnhancer" is already exported/);
    });

    it("does not throw for a name that only appears in a type export", () => {
      // Guards against over-matching: a *Props/*Variant type export sharing a
      // token with pascalName must not be mistaken for a value-export
      // collision.
      const result = insertBarrelExport(FIXTURE, {
        pascalName: "ButtonProps",
        kebabName: "button-props",
        category: "Actions",
      });
      expect(result).toContain(`export { ButtonProps } from "./button-props/button-props";`);
    });
  });
});
