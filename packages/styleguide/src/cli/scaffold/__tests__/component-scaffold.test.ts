// Ported from the host's former scripts/__tests__/component-scaffold.test.ts.
// Exercises validation, name conversion, template shape, and the
// barrel-insertion algorithm directly (no fs, no child process). The former
// module-level `VALID_CATEGORIES` / `UI_PACKAGE_NAME` / `COMPONENTS_ROOT`
// constants are now explicit parameters (sourced from the host's
// `zudo-sg.config.mjs` at the CLI orchestration layer) — this fixture
// declares its own equivalents.

import { describe, expect, it, vi } from "vitest";
import {
  assertUnusedName,
  assertValidCategory,
  assertValidName,
  categorySlug,
  componentTemplate,
  insertBarrelExport,
  storiesTemplate,
  testTemplate,
  toPascalCase,
} from "../component-scaffold.js";
import { parseArgs } from "../new-component.js";

const UI_PACKAGE_NAME = "@zudo-sg/demo-ui";
const VALID_CATEGORIES = [
  "Actions",
  "Typography",
  "Layout",
  "Data Display",
  "Forms",
  "Navigation",
  "Content",
  "Landing",
  "News",
  "Search",
  "Feedback",
  "Media",
];

describe("new-component parseArgs", () => {
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
    expect(parseArgs(["--nested", "demo-widget", "--skip-barrel", "--category", "Layout"])).toEqual({
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
  it("accepts every declared category without warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const category of VALID_CATEGORIES) {
      expect(() => assertValidCategory(category, VALID_CATEGORIES)).not.toThrow();
    }
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("accepts a new (undeclared) category — categories are open", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertValidCategory("Widgets", VALID_CATEGORIES)).not.toThrow();
    warnSpy.mockRestore();
  });

  it("warns when the category isn't declared", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    assertValidCategory("Widgets", VALID_CATEGORIES);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Widgets"));
    warnSpy.mockRestore();
  });

  it("rejects an empty or non-string category", () => {
    expect(() => assertValidCategory("", VALID_CATEGORIES)).toThrow();
    expect(() => assertValidCategory(undefined, VALID_CATEGORIES)).toThrow();
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
    expect(() => assertUnusedName("demo-widget", ["badge", "button"], "packages/demo-ui/src")).not.toThrow();
  });

  it("throws when the name is already a component directory", () => {
    expect(() => assertUnusedName("badge", ["badge", "button"], "packages/demo-ui/src")).toThrow(/already exists/);
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
    const src = componentTemplate({ pascalName: "DemoWidget", kebabName: "demo-widget", nested: true });
    expect(src).toContain(`import { cx } from "../../lib/cx";`);
    expect(src).not.toContain(`from "../lib/cx"`);
  });
});

describe("storiesTemplate", () => {
  it("emits a StoryMeta + typed Playground story", () => {
    const src = storiesTemplate({
      pascalName: "DemoWidget",
      kebabName: "demo-widget",
      category: "Layout",
      uiPackageName: UI_PACKAGE_NAME,
    });
    expect(src).toContain(`import { DemoWidget, type DemoWidgetProps } from "./demo-widget";`);
    expect(src).toContain('category: "Layout",');
    expect(src).toContain(`import { DemoWidget } from "${UI_PACKAGE_NAME}";`);
    expect(src).toContain("export const Playground: Story<DemoWidgetProps> = {");
    expect(src).toContain('prop: "variant"');
    expect(src).toContain(`from "../stories/types"`);
  });

  it("uses a one-deeper relative stories/types import when nested (category-dir scaffold)", () => {
    const src = storiesTemplate({
      pascalName: "DemoWidget",
      kebabName: "demo-widget",
      category: "Layout",
      uiPackageName: UI_PACKAGE_NAME,
      nested: true,
    });
    expect(src).toContain(`import type { StoryMeta, Story } from "../../stories/types";`);
    expect(src).not.toContain('from "../stories/types"');
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
    const result = insertBarrelExport(FIXTURE, { pascalName: "Stat", kebabName: "stat", category: "Data Display" });
    expect(result).toContain(
      `export { Badge } from "./badge/badge";\nexport type { BadgeProps, BadgeTone, BadgeVariant } from "./badge/badge";\n\n` +
        `export { Stat } from "./stat/stat";\nexport type { StatProps, StatVariant } from "./stat/stat";\n\n` +
        `// ── Utilities`,
    );
  });

  it("sorts alphabetically within the section (inserts before a later name)", () => {
    const result = insertBarrelExport(FIXTURE, { pascalName: "Avatar", kebabName: "avatar", category: "Actions" });
    const avatarIdx = result.indexOf("export { Avatar }");
    const buttonIdx = result.indexOf("export { Button }");
    const linkIdx = result.indexOf("export { Link }");
    expect(avatarIdx).toBeGreaterThan(-1);
    expect(avatarIdx).toBeLessThan(buttonIdx);
    expect(buttonIdx).toBeLessThan(linkIdx);
  });

  it("sorts a LAST-alphabetical name to the END even past a `default as` re-export block", () => {
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
    expect(zebraIdx).toBeGreaterThan(textareaIdx);
    expect(zebraIdx).toBeLessThan(utilitiesIdx);
    expect(result).toContain(`export { Zebra } from "./forms/zebra/zebra";`);
  });

  it("matches the category case-insensitively against a differently-cased header", () => {
    const result = insertBarrelExport(FIXTURE, { pascalName: "Stat", kebabName: "stat", category: "Data Display" });
    expect(result).toContain("export { Stat }");
  });

  it("throws when no section header matches the category", () => {
    expect(() =>
      insertBarrelExport(FIXTURE, { pascalName: "NavMenu", kebabName: "nav-menu", category: "Navigation" }),
    ).toThrow(/no ".*" section header/);
  });

  it("keeps no blank line between a header and the first block", () => {
    const result = insertBarrelExport(FIXTURE, { pascalName: "Avatar", kebabName: "avatar", category: "Actions" });
    expect(result).toContain(
      `// ── Actions ──────────────────────────────────────────────────────────────\nexport { Avatar }`,
    );
  });

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
      const avatarIdx = result.indexOf("export { Avatar }");
      const buttonIdx = result.indexOf("export { Button }");
      expect(result).toContain(`export { Avatar } from "./actions/avatar/avatar";`);
      expect(avatarIdx).toBeGreaterThan(-1);
      expect(avatarIdx).toBeLessThan(buttonIdx);
    });

    it("defaults nested to false (flat import specifier) when omitted", () => {
      const result = insertBarrelExport(FIXTURE, { pascalName: "Stat", kebabName: "stat", category: "Data Display" });
      expect(result).toContain(`export { Stat } from "./stat/stat";`);
      expect(result).not.toContain("./data-display/stat/stat");
    });
  });

  describe("duplicate Pascal name across categories", () => {
    it("throws a clear, actionable error instead of inserting a colliding export", () => {
      expect(() =>
        insertBarrelExport(FIXTURE, { pascalName: "Badge", kebabName: "badge", category: "Actions", nested: true }),
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
      const result = insertBarrelExport(FIXTURE, { pascalName: "ButtonProps", kebabName: "button-props", category: "Actions" });
      expect(result).toContain(`export { ButtonProps } from "./button-props/button-props";`);
    });
  });
});
