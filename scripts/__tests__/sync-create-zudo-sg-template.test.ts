import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildTemplate } from "../sync-create-zudo-sg-template.mjs";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(TEST_DIR, "../..");
const SCRIPT_PATH = join(PROJECT_ROOT, "scripts", "sync-create-zudo-sg-template.mjs");
const FIXTURE_PATH = join(PROJECT_ROOT, "fixtures", "engine-host");
const STYLEGUIDE_PACKAGE_PATH = join(
  PROJECT_ROOT,
  "packages",
  "styleguide",
  "package.json",
);
const ZFB_PACKAGE_PATH = join(
  PROJECT_ROOT,
  "node_modules",
  "@takazudo",
  "zfb",
  "package.json",
);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function makeSandbox(): string {
  const sandbox = mkdtempSync(join(tmpdir(), "sync-create-zudo-sg-template-"));
  temporaryDirectories.push(sandbox);
  mkdirSync(join(sandbox, "scripts"), { recursive: true });
  mkdirSync(join(sandbox, "fixtures"), { recursive: true });
  mkdirSync(join(sandbox, "packages", "styleguide"), { recursive: true });
  mkdirSync(
    join(sandbox, "packages", "create-zudo-sg", "templates"),
    { recursive: true },
  );
  cpSync(SCRIPT_PATH, join(sandbox, "scripts", "sync-create-zudo-sg-template.mjs"));
  cpSync(FIXTURE_PATH, join(sandbox, "fixtures", "engine-host"), {
    recursive: true,
    filter: (source) =>
      !/(?:^|[/\\])(?:node_modules|dist|\.zfb-build|\.zfb|\.tarball)(?:[/\\]|$)/.test(
        source,
      ) && !/(?:^|[/\\])pnpm-lock\.yaml$/.test(source),
  });
  cpSync(
    STYLEGUIDE_PACKAGE_PATH,
    join(sandbox, "packages", "styleguide", "package.json"),
  );
  mkdirSync(join(sandbox, "node_modules", "@takazudo", "zfb"), {
    recursive: true,
  });
  cpSync(
    ZFB_PACKAGE_PATH,
    join(sandbox, "node_modules", "@takazudo", "zfb", "package.json"),
  );
  return sandbox;
}

function run(sandbox: string, ...args: string[]) {
  // Keeping the spawn in one helper makes the test's subprocess boundary
  // explicit: it exercises the exact CLI used by root package scripts.
  return spawnSync(
    process.execPath,
    [join(sandbox, "scripts", "sync-create-zudo-sg-template.mjs"), ...args],
    { cwd: sandbox, encoding: "utf8" },
  );
}

function outputDir(sandbox: string): string {
  return join(sandbox, "packages", "create-zudo-sg", "templates", "default");
}

function readOutputFiles(directory: string): string[] {
  const files: string[] = [];
  const visit = (current: string, prefix = "") => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path, relative);
      else files.push(relative);
    }
  };
  visit(directory);
  return files.sort();
}

function readOutputText(directory: string): string {
  return readOutputFiles(directory)
    .map((relativePath) => readFileSync(join(directory, relativePath), "utf8"))
    .join("\n");
}

function readReleaseAgeExcludes(directory: string): string[] {
  return readFileSync(join(directory, "pnpm-workspace.yaml"), "utf8")
    .split(/\r?\n/u)
    .filter((line) => /^\s+-\s+"[^"\n]+"$/u.test(line))
    .map((line) => line.replace(/^\s+-\s+"|"$/gu, ""));
}

describe("sync-create-zudo-sg-template.mjs", () => {
  it("generates a clean starter tree and is idempotent", () => {
    const sandbox = makeSandbox();

    const first = run(sandbox);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain("Wrote create-zudo-sg template");

    const target = outputDir(sandbox);
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(join(target, "package.json"), "utf8")).toContain(
      '"name": "__PROJECT_NAME__"',
    );
    expect(JSON.parse(readFileSync(join(target, "package.json"), "utf8"))).toMatchObject({
      name: "__PROJECT_NAME__",
      version: "0.1.0",
      dependencies: {
        "@takazudo/zudo-sg": `^${JSON.parse(readFileSync(STYLEGUIDE_PACKAGE_PATH, "utf8")).version}`,
      },
    });
    expect(readFileSync(join(target, "_gitignore"), "utf8")).not.toContain(
      ".tarball",
    );
    const generatedGitignore = readFileSync(join(target, "_gitignore"), "utf8");
    expect(generatedGitignore).not.toContain("pnpm-lock.yaml");
    expect(generatedGitignore).toContain(".zfb/");
    expect(generatedGitignore).toContain(".zfb-esbuild-entry-*.tsx");
    expect(generatedGitignore).toContain(".zfb-islands-tsconfig-*.json");
    expect(generatedGitignore).toContain(".zfb-virtual-*.mjs");
    expect(readFileSync(join(target, "zfb.config.ts"), "utf8")).toContain(
      'base: "/"',
    );
    expect(readReleaseAgeExcludes(target)).toEqual([
      "@takazudo/zdtp@0.8.0",
      "@takazudo/zfb-darwin-arm64@2.20.0",
      "@takazudo/zfb-darwin-x64@2.20.0",
      "@takazudo/zfb-linux-arm64-gnu@2.20.0",
      "@takazudo/zfb-linux-x64-gnu@2.20.0",
      "@takazudo/zfb-md-wasm@2.20.0",
      "@takazudo/zfb-runtime@2.20.0",
      "@takazudo/zfb-win32-x64-msvc@2.20.0",
      "@takazudo/zfb@2.20.0",
      "@takazudo/zudo-doc@5.26.2",
      "@takazudo/zudo-sg@0.2.0",
    ]);
    expect(readFileSync(join(target, "pages/index.tsx"), "utf8")).toContain(
      'href="/components"',
    );
    expect(readFileSync(join(target, "ui/button/button.stories.tsx"), "utf8")).toContain(
      'from "./ui/button/button"',
    );
    expect(readFileSync(join(target, "src/styleguide/sg-registry.ts"), "utf8")).toContain(
      '"./ui/button/button.stories.tsx": button as unknown as StoryModule,',
    );
    const generatedText = readOutputText(target);
    for (const forbidden of [
      "engine-host",
      "file:",
      ".tarball",
      'base: "/styleguide/"',
      'href="/styleguide/',
    ]) {
      expect(generatedText).not.toContain(forbidden);
    }

    const second = run(sandbox);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("already up to date");

    const check = run(sandbox, "--check");
    expect(check.status).toBe(0);
    expect(check.stdout).toContain("up to date");
  });

  it("reports drift without writing and refreshes it on the next sync", () => {
    const sandbox = makeSandbox();
    expect(run(sandbox).status).toBe(0);

    const target = outputDir(sandbox);
    const page = join(target, "pages/index.tsx");
    const before = readFileSync(page, "utf8");
    writeFileSync(page, `${before}\n// accidental edit\n`);

    const check = run(sandbox, "--check");
    expect(check.status).toBe(1);
    expect(check.stderr).toContain("pages/index.tsx");
    expect(readFileSync(page, "utf8")).toContain("accidental edit");

    expect(run(sandbox).status).toBe(0);
    expect(readFileSync(page, "utf8")).toBe(before);

    const sourcePage = join(sandbox, "fixtures", "engine-host", "pages/index.tsx");
    const sourceBefore = readFileSync(sourcePage, "utf8");
    writeFileSync(sourcePage, `${sourceBefore}\n// source edit\n`);
    const sourceCheck = run(sandbox, "--check");
    expect(sourceCheck.status).toBe(1);
    expect(sourceCheck.stderr).toContain("pages/index.tsx");
    expect(readFileSync(page, "utf8")).toBe(before);
    writeFileSync(sourcePage, sourceBefore);
    expect(run(sandbox, "--check").status).toBe(0);
  });

  it("does not copy excluded build artifacts or the fixture lockfile", () => {
    const sandbox = makeSandbox();
    mkdirSync(join(sandbox, "fixtures", "engine-host", "dist"), { recursive: true });
    writeFileSync(join(sandbox, "fixtures", "engine-host", "dist", "stale.js"), "stale\n");
    mkdirSync(join(sandbox, "fixtures", "engine-host", ".tarball"), { recursive: true });
    writeFileSync(
      join(sandbox, "fixtures", "engine-host", ".tarball", "engine.tgz"),
      "stale\n",
    );
    mkdirSync(join(sandbox, "fixtures", "engine-host", ".zfb"), { recursive: true });
    writeFileSync(
      join(sandbox, "fixtures", "engine-host", ".zfb", "graph.bin"),
      "stale\n",
    );
    for (const file of [
      ".zfb-esbuild-entry-x.tsx",
      ".zfb-islands-tsconfig-x.json",
      ".zfb-virtual-x.mjs",
    ]) {
      writeFileSync(join(sandbox, "fixtures", "engine-host", file), "stale\n");
    }
    writeFileSync(join(sandbox, "fixtures", "engine-host", "pnpm-lock.yaml"), "lockfile\n");

    expect(run(sandbox).status).toBe(0);
    const files = readOutputFiles(outputDir(sandbox));
    expect(files).not.toContain("dist/stale.js");
    expect(files).not.toContain(".tarball/engine.tgz");
    expect(files).not.toContain(".zfb/graph.bin");
    expect(files).not.toContain(".zfb-esbuild-entry-x.tsx");
    expect(files).not.toContain(".zfb-islands-tsconfig-x.json");
    expect(files).not.toContain(".zfb-virtual-x.mjs");
    expect(files).not.toContain("pnpm-lock.yaml");
  });

  it("fails when a pinned release-age version is not exact", () => {
    const sandbox = makeSandbox();
    const fixturePackagePath = join(
      sandbox,
      "fixtures",
      "engine-host",
      "package.json",
    );
    const fixturePackage = JSON.parse(readFileSync(fixturePackagePath, "utf8"));
    fixturePackage.dependencies["@takazudo/zfb"] = "^2.19.0";
    writeFileSync(fixturePackagePath, `${JSON.stringify(fixturePackage, null, 2)}\n`);

    const result = run(sandbox);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected an exact semver");
  });

  it("accepts an injected zfb metadata path without a sandbox node_modules", async () => {
    const sandbox = makeSandbox();
    const injectedMetadataPath = join(sandbox, "metadata", "zfb-package.json");
    mkdirSync(join(sandbox, "metadata"), { recursive: true });
    cpSync(
      join(sandbox, "node_modules", "@takazudo", "zfb", "package.json"),
      injectedMetadataPath,
    );
    rmSync(join(sandbox, "node_modules"), { recursive: true, force: true });

    const files = await buildTemplate({
      sourceDir: join(sandbox, "fixtures", "engine-host"),
      styleguidePackagePath: join(
        sandbox,
        "packages",
        "styleguide",
        "package.json",
      ),
      zfbPackagePath: injectedMetadataPath,
    });
    expect(files.get("pnpm-workspace.yaml")?.toString()).toContain(
      "@takazudo/zfb@2.20.0",
    );
  });

  it("fails when zfb metadata is missing", () => {
    const sandbox = makeSandbox();
    rmSync(join(sandbox, "node_modules", "@takazudo", "zfb", "package.json"));

    const result = run(sandbox);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ENOENT");
  });

  it("fails when zfb metadata does not match the fixture pin", () => {
    const sandbox = makeSandbox();
    const zfbPackagePath = join(
      sandbox,
      "node_modules",
      "@takazudo",
      "zfb",
      "package.json",
    );
    const zfbPackage = JSON.parse(readFileSync(zfbPackagePath, "utf8"));
    zfbPackage.version = "2.18.0";
    writeFileSync(zfbPackagePath, `${JSON.stringify(zfbPackage, null, 2)}\n`);

    const result = run(sandbox);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "metadata version 2.18.0 does not match the fixture pin",
    );
  });

  it("fails when an optional zfb package is not pinned to zfb", () => {
    const sandbox = makeSandbox();
    const zfbPackagePath = join(
      sandbox,
      "node_modules",
      "@takazudo",
      "zfb",
      "package.json",
    );
    const zfbPackage = JSON.parse(readFileSync(zfbPackagePath, "utf8"));
    zfbPackage.optionalDependencies["@takazudo/zfb-linux-x64-gnu"] = "2.18.0";
    writeFileSync(zfbPackagePath, `${JSON.stringify(zfbPackage, null, 2)}\n`);

    const result = run(sandbox);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "optional dependency version 2.18.0 does not match",
    );
  });
});
