// Ported from the host's former scripts/__tests__/gen-sg-registry.test.ts.
// Exercises the #224 recursive-discovery rewrite specifically: the old
// one-level layout (`<name>/<name>.stories.tsx`) must still resolve to
// byte-identical identifiers, and the new category-nested layout
// (`<category>/<name>/<name>.stories.tsx`) must resolve to DISTINCT
// identifiers even when two categories scaffold a same-named component —
// never a silent overwrite. Calls `runGenRegistry` directly against a temp
// sandbox instead of spawning the old standalone script.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as ts from "typescript";
import type { ZudoSgConfig } from "../../config.js";
import { runGenRegistry, SgRegistryDriftError } from "../gen-registry.js";

const REGISTRY_SEED = `// seed
// GENERATED:SG_REGISTRY_BEGIN
// GENERATED:SG_REGISTRY_END
`;

const STORY_MODULES_SEED = `// seed
// GENERATED:SG_REGISTRY_BEGIN
// GENERATED:SG_REGISTRY_END
`;

const STORY_BODY = (exportNames: string[]) =>
  exportNames.map((name) => `export const ${name} = { name: "${name}" };\n`).join("");

let sandbox: string;

function baseConfig(): ZudoSgConfig {
  return {
    componentsRoots: [{ dir: "packages/demo-ui/src", importBase: "@zudo-sg/demo-ui/src" }],
    registryOut: "src/styleguide/sg-registry.ts",
    categoryOrder: [],
    uiPackageName: "@zudo-sg/demo-ui",
    barrelIndex: null,
    previewStyles: "unused-preview.css",
  };
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "gen-registry-"));
  mkdirSync(join(sandbox, "packages", "demo-ui", "src", "stories", "__tests__"), { recursive: true });
  mkdirSync(join(sandbox, "src", "styleguide"), { recursive: true });
  writeFileSync(join(sandbox, "src", "styleguide", "sg-registry.ts"), REGISTRY_SEED);
  writeFileSync(
    join(sandbox, "packages", "demo-ui", "src", "stories", "__tests__", "story-modules.ts"),
    STORY_MODULES_SEED,
  );
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function writeStory(relDir: string, stem: string, exportNames: string[] = ["Playground"]) {
  const dir = join(sandbox, "packages", "demo-ui", "src", relDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${stem}.stories.tsx`), STORY_BODY(exportNames));
}

function readRegistry() {
  return readFileSync(join(sandbox, "src", "styleguide", "sg-registry.ts"), "utf-8");
}

function registryPath() {
  return join(sandbox, "src", "styleguide", "sg-registry.ts");
}

function storyModulesPath() {
  return join(sandbox, "packages", "demo-ui", "src", "stories", "__tests__", "story-modules.ts");
}

function readStoryModules() {
  return readFileSync(
    join(sandbox, "packages", "demo-ui", "src", "stories", "__tests__", "story-modules.ts"),
    "utf-8",
  );
}

function expectValidModule(source: string) {
  const parsed = ts.createSourceFile("generated.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
  });
  expect(transpiled.diagnostics).toEqual([]);
  const names = parsed.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => statement.importClause?.namedBindings)
    .filter((bindings): bindings is ts.NamespaceImport => !!bindings && ts.isNamespaceImport(bindings))
    .map((binding) => binding.name.text);
  expect(new Set(names).size).toBe(names.length);
  expect(names).not.toContain("StoryModule");
  expect(names).not.toContain("storyModules");
  expect(names).not.toContain("storyExportOrder");
  expect(names).not.toContain("STORY_MODULES");
}

describe("runGenRegistry — old one-level layout (backward compatibility)", () => {
  it("derives the same identifier shape as before a flat component", () => {
    writeStory("badge", "badge", ["Playground", "Soft"]);
    writeStory("button", "button");

    const result = runGenRegistry(sandbox, baseConfig());
    expect(result.entryCount).toBe(2);

    const registry = readRegistry();
    expect(registry).toContain('import type { StoryModule } from "@takazudo/zudo-sg/stories";');
    expect(registry).not.toContain('import type { StoryModule } from "@zudo-sg/demo-ui";');
    expect(registry).toContain('import * as badge from "@zudo-sg/demo-ui/src/badge/badge.stories.tsx";');
    expect(registry).toContain('"./demo-ui/src/badge/badge.stories.tsx": badge as unknown as StoryModule,');
    expect(registry).toContain('"./demo-ui/src/badge/badge.stories.tsx": ["Playground", "Soft"],');

    const storyModules = readStoryModules();
    expect(storyModules).toContain('import * as badge from "../../badge/badge.stories";');
    expect(storyModules).toContain('"badge/badge.stories.tsx": badge as unknown as StoryModule,');
  });

  it("is idempotent for the flat layout", () => {
    writeStory("badge", "badge");
    runGenRegistry(sandbox, baseConfig());
    const second = runGenRegistry(sandbox, baseConfig());
    expect(second.changed).toEqual([]);
  });
});

describe("runGenRegistry — category-nested layout (#224)", () => {
  it("discovers a nested `<category>/<name>/<name>.stories.tsx` file", () => {
    writeStory("layout/badge-icon", "badge-icon");

    runGenRegistry(sandbox, baseConfig());

    const registry = readRegistry();
    expect(registry).toContain(
      'import * as layoutBadgeIcon from "@zudo-sg/demo-ui/src/layout/badge-icon/badge-icon.stories.tsx";',
    );
    expect(registry).toContain(
      '"./demo-ui/src/layout/badge-icon/badge-icon.stories.tsx": layoutBadgeIcon as unknown as StoryModule,',
    );

    const storyModules = readStoryModules();
    expect(storyModules).toContain(
      'import * as layoutBadgeIcon from "../../layout/badge-icon/badge-icon.stories";',
    );
    expect(storyModules).toContain(
      '"layout/badge-icon/badge-icon.stories.tsx": layoutBadgeIcon as unknown as StoryModule,',
    );
  });

  it("handles a same-named component across two categories with distinct identifiers and NO silent overwrite", () => {
    writeStory("layout/badge", "badge");
    writeStory("forms/badge", "badge");

    runGenRegistry(sandbox, baseConfig());

    const registry = readRegistry();
    expect(registry).toContain('import * as layoutBadge from "@zudo-sg/demo-ui/src/layout/badge/badge.stories.tsx";');
    expect(registry).toContain('import * as formsBadge from "@zudo-sg/demo-ui/src/forms/badge/badge.stories.tsx";');
    expect(registry).toContain(
      '"./demo-ui/src/layout/badge/badge.stories.tsx": layoutBadge as unknown as StoryModule,',
    );
    expect(registry).toContain(
      '"./demo-ui/src/forms/badge/badge.stories.tsx": formsBadge as unknown as StoryModule,',
    );
  });

  it("mixes flat and nested layouts in one discovery pass, sorted deterministically", () => {
    writeStory("badge", "badge");
    writeStory("content", "content-not-a-component", []);
    writeStory("landing/hero-band", "hero-band");

    runGenRegistry(sandbox, baseConfig());
    const registry = readRegistry();

    const badgeIdx = registry.indexOf('"./demo-ui/src/badge/badge.stories.tsx"');
    const contentIdx = registry.indexOf('"./demo-ui/src/content/content-not-a-component.stories.tsx"');
    const heroIdx = registry.indexOf('"./demo-ui/src/landing/hero-band/hero-band.stories.tsx"');
    expect(badgeIdx).toBeGreaterThan(-1);
    expect(contentIdx).toBeGreaterThan(-1);
    expect(heroIdx).toBeGreaterThan(-1);
    expect(badgeIdx).toBeLessThan(contentIdx);
    expect(contentIdx).toBeLessThan(heroIdx);
  });

  it("skips hidden and underscore-prefixed directories at every depth", () => {
    writeStory("badge", "badge");
    writeStory("badge/__tests__", "badge-fixture");
    writeStory("_shared/section-heading", "section-heading");

    runGenRegistry(sandbox, baseConfig());
    const registry = readRegistry();
    expect(registry).toContain('"./demo-ui/src/badge/badge.stories.tsx"');
    expect(registry).not.toContain("badge-fixture");
    expect(registry).not.toContain("section-heading");
  });

  it("allocates full-identity bindings when distinct directories fold to one name", () => {
    writeStory("foo-bar/baz", "baz");
    writeStory("foo/bar-baz", "bar-baz");

    expect(runGenRegistry(sandbox, baseConfig()).entryCount).toBe(2);
    expectValidModule(readRegistry());
    expectValidModule(readStoryModules());
    expect(readRegistry()).toContain('"./demo-ui/src/foo-bar/baz/baz.stories.tsx"');
    expect(readRegistry()).toContain('"./demo-ui/src/foo/bar-baz/bar-baz.stories.tsx"');
  });
});

describe("runGenRegistry — import bindings (#823)", () => {
  it("keeps sibling stories and both complete generated modules in sync", () => {
    writeStory("controls", "button", ["Primary", "Secondary"]);
    writeStory("controls", "input", ["Empty"]);
    runGenRegistry(sandbox, baseConfig());

    const registry = readRegistry();
    const modules = readStoryModules();
    expectValidModule(registry);
    expectValidModule(modules);
    for (const stem of ["button", "input"]) {
      expect(registry).toContain(`"./demo-ui/src/controls/${stem}.stories.tsx"`);
      expect(modules).toContain(`"controls/${stem}.stories.tsx"`);
    }
    expect(registry).toContain('"./demo-ui/src/controls/button.stories.tsx": ["Primary", "Secondary"]');
    expect(() => runGenRegistry(sandbox, baseConfig(), { check: true })).not.toThrow();

    writeStory("controls", "slider");
    const before = [readRegistry(), readStoryModules()];
    expect(() => runGenRegistry(sandbox, baseConfig(), { check: true })).toThrow(SgRegistryDriftError);
    expect([readRegistry(), readStoryModules()]).toEqual(before);
    expect(runGenRegistry(sandbox, baseConfig()).entryCount).toBe(3);
    expectValidModule(readRegistry());
    expectValidModule(readStoryModules());
  });

  it("uses root identity for identical relative paths and ignores root order", () => {
    writeStory("button", "button");
    const secondRoot = join(sandbox, "packages", "other-ui", "src");
    mkdirSync(join(secondRoot, "button"), { recursive: true });
    mkdirSync(join(secondRoot, "stories", "__tests__"), { recursive: true });
    writeFileSync(join(secondRoot, "button", "button.stories.tsx"), STORY_BODY(["Other"]));
    writeFileSync(join(secondRoot, "stories", "__tests__", "story-modules.ts"), STORY_MODULES_SEED);
    const config = baseConfig();
    config.componentsRoots.push({ dir: "packages/other-ui/src", importBase: "@other-ui/src" });

    runGenRegistry(sandbox, config);
    const registry = readRegistry();
    const firstModules = readStoryModules();
    const otherModules = readFileSync(join(secondRoot, "stories", "__tests__", "story-modules.ts"), "utf8");
    expectValidModule(registry);
    expectValidModule(firstModules);
    expectValidModule(otherModules);
    expect(registry).toContain('"./demo-ui/src/button/button.stories.tsx"');
    expect(registry).toContain('"./other-ui/src/button/button.stories.tsx"');
    config.componentsRoots.reverse();
    expect(runGenRegistry(sandbox, config).changed).toEqual([]);
  });

  it("sanitizes invalid and reserved names while protecting legacy and generated bindings", () => {
    writeStory("class", "class");
    writeStory("storyModules", "storyModules");
    writeStory("storyExportOrder", "storyExportOrder");
    writeStory("StoryModule", "StoryModule");
    writeStory("STORY_MODULES", "STORY_MODULES");
    writeStory("9-patch", "9-patch");
    writeStory("foo.bar", "foo.bar");
    writeStory("demoUiSrcClassClass", "demoUiSrcClassClass");
    runGenRegistry(sandbox, baseConfig());

    const registry = readRegistry();
    expectValidModule(registry);
    expectValidModule(readStoryModules());
    expect(registry).toContain('import * as demoUiSrcClassClass from "@zudo-sg/demo-ui/src/demoUiSrcClassClass/demoUiSrcClassClass.stories.tsx";');
    expect(registry).toContain('import * as demoUiSrcClassClass_2 from "@zudo-sg/demo-ui/src/class/class.stories.tsx";');
    expect(() => runGenRegistry(sandbox, baseConfig(), { check: true })).not.toThrow();
  });

  it("rejects duplicate public map keys without writing either target", () => {
    writeStory("button", "button");
    const config = baseConfig();
    config.componentsRoots.push({ ...config.componentsRoots[0]! });
    expect(() => runGenRegistry(sandbox, config)).toThrow(/duplicate story map key/);
    expect(readRegistry()).toBe(REGISTRY_SEED);
    expect(readStoryModules()).toBe(STORY_MODULES_SEED);
  });
});

describe("runGenRegistry — check mode with nested entries", () => {
  it("passes when the committed generated blocks already reflect a nested layout", () => {
    writeStory("layout/badge-icon", "badge-icon");
    runGenRegistry(sandbox, baseConfig());

    expect(() => runGenRegistry(sandbox, baseConfig(), { check: true })).not.toThrow();
  });

  it("fails when a nested story file is added but the generated blocks weren't regenerated", () => {
    writeStory("badge", "badge");
    runGenRegistry(sandbox, baseConfig());

    writeStory("layout/badge-icon", "badge-icon");

    expect(() => runGenRegistry(sandbox, baseConfig(), { check: true })).toThrow(SgRegistryDriftError);
  });
});

describe("runGenRegistry — registry bootstrap", () => {
  it("creates a missing registry", () => {
    rmSync(registryPath());
    writeStory("badge", "badge");

    const result = runGenRegistry(sandbox, baseConfig());

    expect(result.changed).toEqual([registryPath(), storyModulesPath()]);
    expect(readRegistry()).toContain("// GENERATED:SG_REGISTRY_BEGIN — do not hand-edit; run `zudo-sg gen-registry`.");
    expect(runGenRegistry(sandbox, baseConfig()).changed).toEqual([]);
    expect(() => runGenRegistry(sandbox, baseConfig(), { check: true })).not.toThrow();
  });

  it("creates missing registry parent directories", () => {
    rmSync(join(sandbox, "src", "styleguide"), { recursive: true, force: true });
    writeStory("badge", "badge");

    runGenRegistry(sandbox, baseConfig());

    expect(existsSync(registryPath())).toBe(true);
    expect(readRegistry()).toContain('"./demo-ui/src/badge/badge.stories.tsx"');
  });

  it("replaces a whitespace-only registry as a whole file", () => {
    writeFileSync(registryPath(), " \n\t");
    writeStory("badge", "badge");

    runGenRegistry(sandbox, baseConfig());

    const registry = readRegistry();
    expect(registry).toContain('"./demo-ui/src/badge/badge.stories.tsx"');
    expect(registry).not.toMatch(/^\s+\/\//);
  });

  it("rejects non-empty registry content without markers without writing", () => {
    const handAuthored = "export const handAuthored = true;\n";
    writeFileSync(registryPath(), handAuthored);
    writeStory("badge", "badge");
    const storyModulesBefore = readFileSync(storyModulesPath(), "utf8");

    expect(() => runGenRegistry(sandbox, baseConfig())).toThrow(/Could not find GENERATED:SG_REGISTRY_BEGIN/);
    expect(readRegistry()).toBe(handAuthored);
    expect(readFileSync(storyModulesPath(), "utf8")).toBe(storyModulesBefore);
  });

  it("propagates non-ENOENT registry read errors", () => {
    rmSync(registryPath());
    mkdirSync(registryPath());
    writeStory("badge", "badge");

    expect(() => runGenRegistry(sandbox, baseConfig())).toThrow(/EISDIR|directory/);
  });

  it("reports a missing registry as drift in check mode without writing", () => {
    rmSync(registryPath());
    writeStory("badge", "badge");

    expect(() => runGenRegistry(sandbox, baseConfig(), { check: true })).toThrow(SgRegistryDriftError);
    try {
      runGenRegistry(sandbox, baseConfig(), { check: true });
    } catch (error) {
      expect(error).toBeInstanceOf(SgRegistryDriftError);
      expect((error as SgRegistryDriftError).driftedPaths).toEqual([registryPath(), storyModulesPath()]);
      expect((error as Error).message).toContain("Run `zudo-sg gen-registry`");
    }
    expect(existsSync(registryPath())).toBe(false);
    expect(readFileSync(storyModulesPath(), "utf8")).toBe(STORY_MODULES_SEED);
  });

  it("reports a whitespace-only registry as drift in check mode without writing", () => {
    const whitespace = " \n\t";
    writeFileSync(registryPath(), whitespace);
    writeStory("badge", "badge");

    expect(() => runGenRegistry(sandbox, baseConfig(), { check: true })).toThrow(SgRegistryDriftError);
    expect(readRegistry()).toBe(whitespace);
    expect(readFileSync(storyModulesPath(), "utf8")).toBe(STORY_MODULES_SEED);
  });

  it("validates secondary files before creating a missing registry", () => {
    rmSync(registryPath());
    writeFileSync(storyModulesPath(), "export const handAuthored = true;\n");
    writeStory("badge", "badge");

    expect(() => runGenRegistry(sandbox, baseConfig())).toThrow(/Could not find GENERATED:SG_REGISTRY_BEGIN/);
    expect(existsSync(registryPath())).toBe(false);
  });
});
