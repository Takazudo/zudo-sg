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
  componentTemplate,
  insertBarrelExport,
  storiesTemplate,
  testTemplate,
  toPascalCase,
} from "../lib/component-scaffold.mjs";

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
});

describe("storiesTemplate", () => {
  it("emits a StoryMeta + typed Playground story", () => {
    const src = storiesTemplate({ pascalName: "DemoWidget", kebabName: "demo-widget", category: "Layout" });
    expect(src).toContain(`import { DemoWidget, type DemoWidgetProps } from "./demo-widget";`);
    expect(src).toContain('category: "Layout",');
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
});
