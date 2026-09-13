import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { missingDistTargets } from "../ensure-styleguide-build.mjs";

let pkgDir: string | undefined;

function touch(rel: string, content = ""): void {
  const file = join(pkgDir!, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function fakePackage(): void {
  pkgDir = mkdtempSync(join(tmpdir(), "ensure-styleguide-build-"));
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

afterEach(() => {
  if (pkgDir) rmSync(pkgDir, { recursive: true, force: true });
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
