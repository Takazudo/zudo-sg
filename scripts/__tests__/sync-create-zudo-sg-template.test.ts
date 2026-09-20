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
      !/(?:^|[/\\])(?:node_modules|dist|\.zfb-build|\.tarball)(?:[/\\]|$)/.test(
        source,
      ) && !/(?:^|[/\\])pnpm-lock\.yaml$/.test(source),
  });
  cpSync(
    STYLEGUIDE_PACKAGE_PATH,
    join(sandbox, "packages", "styleguide", "package.json"),
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
    expect(readFileSync(join(target, "zfb.config.ts"), "utf8")).toContain(
      'base: "/"',
    );
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
    writeFileSync(join(sandbox, "fixtures", "engine-host", "pnpm-lock.yaml"), "lockfile\n");

    expect(run(sandbox).status).toBe(0);
    const files = readOutputFiles(outputDir(sandbox));
    expect(files).not.toContain("dist/stale.js");
    expect(files).not.toContain(".tarball/engine.tgz");
    expect(files).not.toContain("pnpm-lock.yaml");
  });
});
