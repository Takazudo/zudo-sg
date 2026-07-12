// Spawns the real gen-sg-registry.mjs as a child process against a temp
// sandbox. The script derives ROOT/UI_SRC_DIR/REGISTRY_PATH/STORY_MODULES_PATH
// from its own file location (import.meta.url) plus scripts/lib/scaffold-
// config.mjs, so we copy both into a fresh temp dir with fixture
// `*.stories.tsx` files and seeded generated-block targets per test —
// hermetic, no network, and the real project's files are never touched. See
// gen-story-categories.test.ts / gen-z-index.test.ts for the same pattern.
//
// These tests exercise the #224 recursive-discovery rewrite specifically:
// the old one-level layout (`<name>/<name>.stories.tsx`) must still resolve
// to byte-identical identifiers, and the new category-nested layout
// (`<category>/<name>/<name>.stories.tsx`) must resolve to DISTINCT
// identifiers even when two categories scaffold a same-named component —
// never a silent overwrite.
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Avoid the `new URL(literal, import.meta.url)` shape — Vite's static asset
// transform rewrites that exact pattern into a served-asset URL even in
// vitest's SSR transform, which breaks plain file-path resolution here.
const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT_SRC = join(THIS_DIR, "..", "gen-sg-registry.mjs");
const SCAFFOLD_CONFIG_SRC = join(THIS_DIR, "..", "lib", "scaffold-config.mjs");

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

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "gen-sg-registry-"));
  mkdirSync(join(sandbox, "scripts", "lib"), { recursive: true });
  mkdirSync(join(sandbox, "packages", "ui", "src", "stories", "__tests__"), { recursive: true });
  mkdirSync(join(sandbox, "src", "styleguide", "data"), { recursive: true });
  copyFileSync(SCRIPT_SRC, join(sandbox, "scripts", "gen-sg-registry.mjs"));
  copyFileSync(SCAFFOLD_CONFIG_SRC, join(sandbox, "scripts", "lib", "scaffold-config.mjs"));
  writeFileSync(join(sandbox, "src", "styleguide", "data", "sg-registry.ts"), REGISTRY_SEED);
  writeFileSync(
    join(sandbox, "packages", "ui", "src", "stories", "__tests__", "story-modules.ts"),
    STORY_MODULES_SEED,
  );
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function writeStory(relDir: string, stem: string, exportNames: string[] = ["Playground"]) {
  const dir = join(sandbox, "packages", "ui", "src", relDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${stem}.stories.tsx`), STORY_BODY(exportNames));
}

function readRegistry() {
  return readFileSync(join(sandbox, "src", "styleguide", "data", "sg-registry.ts"), "utf-8");
}

function readStoryModules() {
  return readFileSync(
    join(sandbox, "packages", "ui", "src", "stories", "__tests__", "story-modules.ts"),
    "utf-8",
  );
}

function run(args: string[] = []) {
  return spawnSync(process.execPath, [join(sandbox, "scripts", "gen-sg-registry.mjs"), ...args], {
    cwd: sandbox,
    encoding: "utf-8",
  });
}

describe("gen-sg-registry.mjs — old one-level layout (backward compatibility)", () => {
  it("derives the same identifier shape as before a flat component", () => {
    writeStory("badge", "badge", ["Playground", "Soft"]);
    writeStory("button", "button");

    const result = run();
    expect(result.status).toBe(0);

    const registry = readRegistry();
    expect(registry).toContain('import * as badge from "@zudo-sg/ui/src/badge/badge.stories.tsx";');
    expect(registry).toContain('"./ui/src/badge/badge.stories.tsx": badge as unknown as StoryModule,');
    expect(registry).toContain('"./ui/src/badge/badge.stories.tsx": ["Playground", "Soft"],');

    const storyModules = readStoryModules();
    expect(storyModules).toContain('import * as badge from "../../badge/badge.stories";');
    expect(storyModules).toContain('"badge/badge.stories.tsx": badge as unknown as StoryModule,');
  });

  it("is idempotent for the flat layout", () => {
    writeStory("badge", "badge");
    run();
    const second = run();
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("already up to date");
  });
});

describe("gen-sg-registry.mjs — category-nested layout (#224)", () => {
  it("discovers a nested `<category>/<name>/<name>.stories.tsx` file", () => {
    writeStory("layout/badge-icon", "badge-icon");

    const result = run();
    expect(result.status).toBe(0);

    const registry = readRegistry();
    expect(registry).toContain(
      'import * as layoutBadgeIcon from "@zudo-sg/ui/src/layout/badge-icon/badge-icon.stories.tsx";',
    );
    expect(registry).toContain(
      '"./ui/src/layout/badge-icon/badge-icon.stories.tsx": layoutBadgeIcon as unknown as StoryModule,',
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

    const result = run();
    expect(result.status).toBe(0);

    const registry = readRegistry();
    // Both entries are present — neither overwrote the other.
    expect(registry).toContain('import * as layoutBadge from "@zudo-sg/ui/src/layout/badge/badge.stories.tsx";');
    expect(registry).toContain('import * as formsBadge from "@zudo-sg/ui/src/forms/badge/badge.stories.tsx";');
    expect(registry).toContain(
      '"./ui/src/layout/badge/badge.stories.tsx": layoutBadge as unknown as StoryModule,',
    );
    expect(registry).toContain(
      '"./ui/src/forms/badge/badge.stories.tsx": formsBadge as unknown as StoryModule,',
    );

    const storyModules = readStoryModules();
    expect(storyModules).toContain('"layout/badge/badge.stories.tsx": layoutBadge as unknown as StoryModule,');
    expect(storyModules).toContain('"forms/badge/badge.stories.tsx": formsBadge as unknown as StoryModule,');
  });

  it("mixes flat and nested layouts in one discovery pass, sorted deterministically", () => {
    writeStory("badge", "badge");
    writeStory("content", "content-not-a-component", []); // wrong depth, still discovered generically
    writeStory("landing/hero-band", "hero-band");

    const result = run();
    expect(result.status).toBe(0);
    const registry = readRegistry();

    const badgeIdx = registry.indexOf('"./ui/src/badge/badge.stories.tsx"');
    const contentIdx = registry.indexOf('"./ui/src/content/content-not-a-component.stories.tsx"');
    const heroIdx = registry.indexOf('"./ui/src/landing/hero-band/hero-band.stories.tsx"');
    expect(badgeIdx).toBeGreaterThan(-1);
    expect(contentIdx).toBeGreaterThan(-1);
    expect(heroIdx).toBeGreaterThan(-1);
    // Alphabetical by full relDirStem: badge/badge < content/... < landing/...
    expect(badgeIdx).toBeLessThan(contentIdx);
    expect(contentIdx).toBeLessThan(heroIdx);
  });

  it("skips hidden and underscore-prefixed directories at every depth", () => {
    writeStory("badge", "badge");
    // A co-located test dir that happens to contain a *.stories.tsx-suffixed
    // fixture must never be picked up.
    writeStory("badge/__tests__", "badge-fixture");
    // A future `_shared`-style helper dir (mirrors the reference layout's
    // convention) must never be picked up either.
    writeStory("_shared/section-heading", "section-heading");

    const result = run();
    expect(result.status).toBe(0);
    const registry = readRegistry();
    expect(registry).toContain('"./ui/src/badge/badge.stories.tsx"');
    expect(registry).not.toContain("badge-fixture");
    expect(registry).not.toContain("section-heading");
  });

  it("throws a clear, no-write error when two distinct directories fold to the same identifier", () => {
    // "foo-bar/baz" and "foo/bar-baz" both fold (via join("-") + camelCase)
    // to "fooBarBaz" — a real, if rare, ambiguity the generator must refuse
    // to resolve silently.
    writeStory("foo-bar/baz", "baz");
    writeStory("foo/bar-baz", "bar-baz");

    const result = run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("both derive the import identifier");
    expect(result.stderr).toContain("fooBarBaz");
    expect(result.stderr).toContain("foo-bar/baz");
    expect(result.stderr).toContain("foo/bar-baz");
    // No-write guarantee: the seed content must be untouched.
    expect(readRegistry()).toBe(REGISTRY_SEED);
    expect(readStoryModules()).toBe(STORY_MODULES_SEED);
  });
});

describe("gen-sg-registry.mjs — --check mode with nested entries", () => {
  it("passes when the committed generated blocks already reflect a nested layout", () => {
    writeStory("layout/badge-icon", "badge-icon");
    const first = run();
    expect(first.status).toBe(0);

    const result = run(["--check"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK");
  });

  it("fails when a nested story file is added but the generated blocks weren't regenerated", () => {
    writeStory("badge", "badge");
    run(); // seed committed state with only the flat component

    writeStory("layout/badge-icon", "badge-icon"); // add a nested one, don't regenerate

    const result = run(["--check"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("drift detected");
  });
});
