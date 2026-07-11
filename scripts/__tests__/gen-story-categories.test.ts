// Spawns the real gen-story-categories.mjs as a child process against a temp
// sandbox. The script derives TYPES_PATH/TARGETS from its own file location
// (import.meta.url), so we copy it into a fresh temp dir with its own
// packages/ui/src/stories + src/styleguide/data + scripts/lib fixtures per
// test — hermetic, no network, and the real project's files are never
// touched.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Avoid the `new URL(literal, import.meta.url)` shape — Vite's static asset
// transform rewrites that exact pattern into a served-asset URL even in
// vitest's SSR transform, which breaks plain file-path resolution here.
const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT_SRC = join(THIS_DIR, "..", "gen-story-categories.mjs");

const TYPES_SRC = `export const STORY_CATEGORIES = ["Actions", "Typography", "Layout", "Data Display", "Forms", "Navigation"] as const;
export type StoryCategory = (typeof STORY_CATEGORIES)[number];
`;

const UP_TO_DATE_REGISTRY = `export const CATEGORY_ORDER = [
  // GENERATED:STORY_CATEGORIES_BEGIN — do not hand-edit; run pnpm gen:story-categories.
  // Source of truth: packages/ui/src/stories/types.ts (STORY_CATEGORIES).
  "Actions",
  "Typography",
  "Layout",
  "Data Display",
  "Forms",
  "Navigation",
  // GENERATED:STORY_CATEGORIES_END
];
`;

const UP_TO_DATE_SCAFFOLD = `export const VALID_CATEGORIES = [
  // GENERATED:STORY_CATEGORIES_BEGIN — do not hand-edit; run pnpm gen:story-categories.
  // Source of truth: packages/ui/src/stories/types.ts (STORY_CATEGORIES).
  "Actions",
  "Typography",
  "Layout",
  "Data Display",
  "Forms",
  "Navigation",
  // GENERATED:STORY_CATEGORIES_END
];
`;

const STALE_REGISTRY = `export const CATEGORY_ORDER = [
  // GENERATED:STORY_CATEGORIES_BEGIN
  // stale
  "Old",
  // GENERATED:STORY_CATEGORIES_END
];
`;

const STALE_SCAFFOLD = `export const VALID_CATEGORIES = [
  // GENERATED:STORY_CATEGORIES_BEGIN
  // stale
  "Old",
  // GENERATED:STORY_CATEGORIES_END
];
`;

const NO_MARKERS_REGISTRY = `export const CATEGORY_ORDER = [];\n`;

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "gen-story-categories-"));
  mkdirSync(join(sandbox, "scripts", "lib"), { recursive: true });
  mkdirSync(join(sandbox, "packages", "ui", "src", "stories"), { recursive: true });
  mkdirSync(join(sandbox, "src", "styleguide", "data"), { recursive: true });
  copyFileSync(SCRIPT_SRC, join(sandbox, "scripts", "gen-story-categories.mjs"));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function writeTypes(content: string) {
  writeFileSync(join(sandbox, "packages", "ui", "src", "stories", "types.ts"), content);
}

function writeRegistry(content: string) {
  writeFileSync(join(sandbox, "src", "styleguide", "data", "registry.ts"), content);
}

function writeScaffold(content: string) {
  writeFileSync(join(sandbox, "scripts", "lib", "component-scaffold.mjs"), content);
}

function readRegistry() {
  return readFileSync(join(sandbox, "src", "styleguide", "data", "registry.ts"), "utf-8");
}

function readScaffold() {
  return readFileSync(join(sandbox, "scripts", "lib", "component-scaffold.mjs"), "utf-8");
}

function run(args: string[] = []) {
  return spawnSync(process.execPath, [join(sandbox, "scripts", "gen-story-categories.mjs"), ...args], {
    cwd: sandbox,
    encoding: "utf-8",
  });
}

describe("gen-story-categories.mjs", () => {
  it("rewrites stale blocks in both targets from the types.ts source of truth", () => {
    writeTypes(TYPES_SRC);
    writeRegistry(STALE_REGISTRY);
    writeScaffold(STALE_SCAFFOLD);

    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Wrote story category blocks");

    const registry = readRegistry();
    const scaffold = readScaffold();
    for (const src of [registry, scaffold]) {
      expect(src).toContain('"Actions",');
      expect(src).toContain('"Typography",');
      expect(src).toContain('"Layout",');
      expect(src).toContain('"Data Display",');
      expect(src).toContain('"Forms",');
      expect(src).toContain('"Navigation",');
      expect(src).not.toContain('"Old"');
    }
  });

  it("is idempotent: a second run reports no change", () => {
    writeTypes(TYPES_SRC);
    writeRegistry(STALE_REGISTRY);
    writeScaffold(STALE_SCAFFOLD);
    run();

    const second = run();
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("already up to date");
    expect(second.stdout).toContain("no change");
  });

  it("--check passes when both committed blocks match types.ts", () => {
    writeTypes(TYPES_SRC);
    writeRegistry(UP_TO_DATE_REGISTRY);
    writeScaffold(UP_TO_DATE_SCAFFOLD);

    const result = run(["--check"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK — story categories are up to date");
    // --check must not write.
    expect(readRegistry()).toBe(UP_TO_DATE_REGISTRY);
    expect(readScaffold()).toBe(UP_TO_DATE_SCAFFOLD);
  });

  it("--check fails when one target has drifted from types.ts", () => {
    writeTypes(TYPES_SRC);
    writeRegistry(STALE_REGISTRY);
    writeScaffold(UP_TO_DATE_SCAFFOLD);

    const result = run(["--check"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("story-categories codegen drift detected");
    expect(result.stderr).toContain("registry.ts");
    // --check must not write.
    expect(readRegistry()).toBe(STALE_REGISTRY);
    expect(readScaffold()).toBe(UP_TO_DATE_SCAFFOLD);
  });

  it("--check fails when both targets have drifted from types.ts", () => {
    writeTypes(TYPES_SRC);
    writeRegistry(STALE_REGISTRY);
    writeScaffold(STALE_SCAFFOLD);

    const result = run(["--check"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("registry.ts");
    expect(result.stderr).toContain("component-scaffold.mjs");
  });

  it("fails when the BEGIN/END markers are missing from a target", () => {
    writeTypes(TYPES_SRC);
    writeRegistry(NO_MARKERS_REGISTRY);
    writeScaffold(UP_TO_DATE_SCAFFOLD);

    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not find");
    expect(result.stderr).toContain("GENERATED:STORY_CATEGORIES_BEGIN");
  });

  it("fails when STORY_CATEGORIES cannot be located in types.ts", () => {
    writeTypes("export const SOMETHING_ELSE = [];\n");
    writeRegistry(UP_TO_DATE_REGISTRY);
    writeScaffold(UP_TO_DATE_SCAFFOLD);

    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not locate");
  });

  it("fails when STORY_CATEGORIES parses to an empty list", () => {
    writeTypes("export const STORY_CATEGORIES = [] as const;\n");
    writeRegistry(UP_TO_DATE_REGISTRY);
    writeScaffold(UP_TO_DATE_SCAFFOLD);

    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("parsed to an empty list");
  });

  it("ignores a quoted category name inside a // line comment (ghost category)", () => {
    writeTypes(`export const STORY_CATEGORIES = [
  "Actions",
  // "Ghost",
  "Typography",
] as const;
`);
    writeRegistry(STALE_REGISTRY);
    writeScaffold(STALE_SCAFFOLD);

    const result = run();
    expect(result.status).toBe(0);

    const registry = readRegistry();
    expect(registry).toContain('"Actions",');
    expect(registry).toContain('"Typography",');
    expect(registry).not.toContain('"Ghost"');
  });
});
