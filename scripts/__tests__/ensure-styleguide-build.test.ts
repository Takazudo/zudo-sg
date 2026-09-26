import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildInputsHash, ensureStyleguideBuild, missingDistTargets } from "../ensure-styleguide-build.mjs";

// ensureStyleguideBuild resolves `packages/styleguide` under whatever `root`
// it's given, so the fake checkout nests pkgDir the same way under rootDir.
let rootDir: string | undefined;
let pkgDir: string | undefined;

const COMPLETE_BUILD_OUTPUTS = [
  "dist/config/index.d.ts",
  "dist/config/index.js",
  "routes-src/_context.ts",
  "routes-src/tokens.tsx",
  "virtual-modules.d.ts",
];

function touch(rel: string, content = ""): void {
  const file = join(pkgDir!, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function fakePackage(): void {
  rootDir = mkdtempSync(join(tmpdir(), "ensure-styleguide-build-"));
  pkgDir = join(rootDir, "packages/styleguide");
  touch(
    "package.json",
    JSON.stringify({
      exports: {
        "./config": { types: "./dist/config/index.d.ts", default: "./dist/config/index.js" },
        "./styles.css": "./styles.css",
      },
    }),
  );
  touch("src/routes/tokens.tsx");
  touch("src/routes/_context.ts");
  touch("src/routes/_virtual.d.ts");
  touch("src/routes/tokens.test.tsx");
}

/** A fake checkout whose dist/routes-src/virtual-modules outputs already exist (missingDistTargets → []). */
function completePackage(): void {
  fakePackage();
  for (const file of COMPLETE_BUILD_OUTPUTS) touch(file);
}

/** Writes `dist/.build-stamp` matching the package's current sources, as a real build would. */
function stampCurrentSources(): void {
  touch("dist/.build-stamp", `${buildInputsHash(pkgDir!)}\n`);
}

/** A `runBuild` stub that records its calls and reports success without touching disk. */
function fakeRunBuild() {
  const calls: string[] = [];
  const runBuild = (root: string) => {
    calls.push(root);
    return { status: 0 };
  };
  return { calls, runBuild };
}

afterEach(() => {
  if (rootDir) rmSync(rootDir, { recursive: true, force: true });
  rootDir = undefined;
  pkgDir = undefined;
});

describe("missingDistTargets", () => {
  it("reports dist exports, routes-src copies and virtual-modules.d.ts on a cold checkout", () => {
    fakePackage();
    expect(missingDistTargets(pkgDir!).sort()).toEqual(
      [
        "./dist/config/index.d.ts",
        "./dist/config/index.js",
        "./routes-src/_context.ts",
        "./routes-src/tokens.tsx",
        "./virtual-modules.d.ts",
      ].sort(),
    );
  });

  it("still requires the route sources when only dist/ exists", () => {
    fakePackage();
    touch("dist/config/index.d.ts");
    touch("dist/config/index.js");
    expect(missingDistTargets(pkgDir!).sort()).toEqual(
      ["./routes-src/_context.ts", "./routes-src/tokens.tsx", "./virtual-modules.d.ts"].sort(),
    );
  });

  it("is empty once every build output exists", () => {
    fakePackage();
    for (const file of [
      "dist/config/index.d.ts",
      "dist/config/index.js",
      "routes-src/_context.ts",
      "routes-src/tokens.tsx",
      "virtual-modules.d.ts",
    ]) {
      touch(file);
    }
    expect(missingDistTargets(pkgDir!)).toEqual([]);
  });
});

describe("ensureStyleguideBuild", () => {
  it("builds on a cold checkout (no dist)", () => {
    fakePackage();
    const { calls, runBuild } = fakeRunBuild();
    const code = ensureStyleguideBuild({ root: rootDir!, log: () => {}, runBuild });
    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it("skips the build when the stamp matches the current sources", () => {
    completePackage();
    stampCurrentSources();
    const { calls, runBuild } = fakeRunBuild();
    const code = ensureStyleguideBuild({ root: rootDir!, log: () => {}, runBuild });
    expect(code).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("rebuilds when a source file changes after the stamp was written", () => {
    completePackage();
    stampCurrentSources();
    touch("src/routes/tokens.tsx", "// changed since the stamp was written");
    const { calls, runBuild } = fakeRunBuild();
    const code = ensureStyleguideBuild({ root: rootDir!, log: () => {}, runBuild });
    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it("rebuilds regardless of a matching stamp when force is set", () => {
    completePackage();
    stampCurrentSources();
    const { calls, runBuild } = fakeRunBuild();
    const code = ensureStyleguideBuild({ root: rootDir!, force: true, log: () => {}, runBuild });
    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it("writes a stamp matching the current sources after a successful build", () => {
    fakePackage();
    const { runBuild } = fakeRunBuild();
    ensureStyleguideBuild({ root: rootDir!, log: () => {}, runBuild });
    const stamp = readFileSync(join(pkgDir!, "dist/.build-stamp"), "utf8").trim();
    expect(stamp).toBe(buildInputsHash(pkgDir!));
  });

  it("does not write a stamp and returns the exit code when the build fails", () => {
    completePackage();
    const runBuild = () => ({ status: 1 });
    const code = ensureStyleguideBuild({ root: rootDir!, log: () => {}, runBuild });
    expect(code).toBe(1);
  });
});
