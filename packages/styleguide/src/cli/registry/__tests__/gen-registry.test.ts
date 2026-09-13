// Ported from the host's former scripts/__tests__/gen-sg-registry.test.ts.
// Exercises the #224 recursive-discovery rewrite specifically: the old
// one-level layout (`<name>/<name>.stories.tsx`) must still resolve to
// byte-identical identifiers, and the new category-nested layout
// (`<category>/<name>/<name>.stories.tsx`) must resolve to DISTINCT
// identifiers even when two categories scaffold a same-named component —
// never a silent overwrite. Calls `runGenRegistry` directly against a temp
// sandbox instead of spawning the old standalone script.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

function readStoryModules() {
  return readFileSync(
    join(sandbox, "packages", "demo-ui", "src", "stories", "__tests__", "story-modules.ts"),
    "utf-8",
  );
}

describe("runGenRegistry — old one-level layout (backward compatibility)", () => {
  it("derives the same identifier shape as before a flat component", () => {
    writeStory("badge", "badge", ["Playground", "Soft"]);
    writeStory("button", "button");

    const result = runGenRegistry(sandbox, baseConfig());
    expect(result.entryCount).toBe(2);

    const registry = readRegistry();
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

  it("throws a clear, no-write error when two distinct directories fold to the same identifier", () => {
    writeStory("foo-bar/baz", "baz");
    writeStory("foo/bar-baz", "bar-baz");

    expect(() => runGenRegistry(sandbox, baseConfig())).toThrow(/both derive the import identifier/);
    expect(() => runGenRegistry(sandbox, baseConfig())).toThrow(/fooBarBaz/);

    // No-write guarantee: the seed content must be untouched.
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
