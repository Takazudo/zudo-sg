import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  resolveHostModule,
  stripTrailingSlash,
  toForwardSlash,
  withBaseUrl,
} from "../host-paths.js";

const REGISTRY = "./src/styleguide/sg-registry.ts";

function touch(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "export {};\n");
}

// Three host layouts the engine must support. In each, the package lives
// somewhere different, but host paths must resolve against the HOST project
// root only — never against the package location or process.cwd().
let sandbox: string;
const layouts: Record<string, { projectRoot: string; packageDir: string }> = {};

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), "zudo-sg-host-paths-"));

  // Workspace: package linked from a sibling workspace dir.
  const ws = join(sandbox, "workspace");
  layouts.workspace = { projectRoot: ws, packageDir: join(ws, "packages/styleguide") };

  // Packed pnpm install: realpath under node_modules/.pnpm.
  const pnpmHost = join(sandbox, "pnpm-host");
  layouts["packed-pnpm"] = {
    projectRoot: pnpmHost,
    packageDir: join(
      pnpmHost,
      "node_modules/.pnpm/@takazudo+zudo-sg@file+zudo-sg-0.1.0.tgz/node_modules/@takazudo/zudo-sg",
    ),
  };

  // Plain npm install: flat node_modules.
  const npmHost = join(sandbox, "npm-host");
  layouts["plain-npm"] = { projectRoot: npmHost, packageDir: join(npmHost, "node_modules/@takazudo/zudo-sg") };

  for (const { projectRoot, packageDir } of Object.values(layouts)) {
    touch(join(projectRoot, "src/styleguide/sg-registry.ts"));
    mkdirSync(join(projectRoot, "src/styles"), { recursive: true });
    // A decoy with the same relative path inside the package must never win.
    touch(join(packageDir, "src/styleguide/sg-registry.ts"));
  }
});

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("resolveHostModule", () => {
  for (const name of ["workspace", "packed-pnpm", "plain-npm"]) {
    describe(`${name} layout`, () => {
      it("resolves a project-root-relative path to a forward-slash absolute host file", () => {
        const { projectRoot, packageDir } = layouts[name]!;
        const abs = resolveHostModule(projectRoot, "registryModule", REGISTRY, { required: true });
        expect(abs).toBe(toForwardSlash(resolve(projectRoot, REGISTRY)));
        expect(abs).not.toContain(toForwardSlash(packageDir));
        expect(abs).not.toContain("\\");
      });

      it("accepts a bare relative path and an absolute path", () => {
        const { projectRoot } = layouts[name]!;
        const expected = toForwardSlash(resolve(projectRoot, REGISTRY));
        expect(resolveHostModule(projectRoot, "registryModule", "src/styleguide/sg-registry.ts")).toBe(expected);
        expect(resolveHostModule(projectRoot, "registryModule", resolve(projectRoot, REGISTRY))).toBe(expected);
      });
    });
  }

  it("throws the not-a-file error for a missing file", () => {
    const { projectRoot } = layouts.workspace!;
    const root = toForwardSlash(resolve(projectRoot));
    expect(() => resolveHostModule(projectRoot, "previewStyles", "./src/styles/missing.css")).toThrow(
      `[zudo-sg] option "previewStyles" = "./src/styles/missing.css" resolved to ${root}/src/styles/missing.css (relative to projectRoot ${root}), which is not a file`,
    );
  });

  it("throws the not-a-file error for a directory", () => {
    const { projectRoot } = layouts.workspace!;
    const root = toForwardSlash(resolve(projectRoot));
    expect(() => resolveHostModule(projectRoot, "previewStyles", "./src/styles")).toThrow(
      `[zudo-sg] option "previewStyles" = "./src/styles" resolved to ${root}/src/styles (relative to projectRoot ${root}), which is not a file`,
    );
  });

  it("throws the not-a-file error for an empty string, even when not required", () => {
    const { projectRoot } = layouts.workspace!;
    const root = toForwardSlash(resolve(projectRoot));
    expect(() => resolveHostModule(projectRoot, "registryModule", "")).toThrow(
      `[zudo-sg] option "registryModule" = "" resolved to ${root} (relative to projectRoot ${root}), which is not a file`,
    );
  });

  it("throws the required error when absent and required", () => {
    const { projectRoot } = layouts.workspace!;
    expect(() =>
      resolveHostModule(projectRoot, "registryModule", undefined, { required: true, example: REGISTRY }),
    ).toThrow(
      `[zudo-sg] option "registryModule" is required (project-root-relative path, e.g. "${REGISTRY}")`,
    );
    expect(() => resolveHostModule(projectRoot, "registryModule", null, { required: true })).toThrow(
      /is required/,
    );
  });

  it("returns undefined when absent and optional", () => {
    expect(resolveHostModule(layouts.workspace!.projectRoot, "registryModule", undefined)).toBeUndefined();
  });
});

describe("withBaseUrl", () => {
  it("joins the base (trailing slashes stripped) and a root-absolute path", () => {
    expect(withBaseUrl("/", "/_zudo-sg/preview.css")).toBe("/_zudo-sg/preview.css");
    expect(withBaseUrl("", "/_zudo-sg/preview.css")).toBe("/_zudo-sg/preview.css");
    expect(withBaseUrl("/spike/", "/_zudo-sg/preview.css")).toBe("/spike/_zudo-sg/preview.css");
    expect(withBaseUrl("/spike", "/components")).toBe("/spike/components");
    expect(stripTrailingSlash("/a//")).toBe("/a");
  });
});
