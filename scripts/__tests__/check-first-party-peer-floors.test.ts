// Validator cases run against in-memory manifests; the CLI cases copy the real
// script into a temp sandbox with fixture manifests, so the real checkout's
// package.json files are never read for mutation or written.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkRepo,
  resolveRootPin,
  validatePeerFloors,
} from "../check-first-party-peer-floors.mjs";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(THIS_DIR, "..", "..");
const SCRIPT_SRC = join(THIS_DIR, "..", "check-first-party-peer-floors.mjs");

type Manifest = Record<string, unknown>;

function currentFixture() {
  const rootManifest: Manifest = {
    dependencies: {
      "@takazudo/zdtp": "0.8.6",
      "@takazudo/zfb": "4.3.3",
      "@takazudo/zudo-doc": "6.1.1",
      "@takazudo/zudo-sg": "workspace:*",
    },
    devDependencies: { "@takazudo/mdx-formatter": "1.3.0" },
  };
  const styleguide: Manifest = {
    devDependencies: {
      "@takazudo/zdtp": "0.8.6",
      "@takazudo/zfb": "4.3.3",
      "@takazudo/zudo-doc": "6.1.1",
    },
    peerDependencies: {
      "@takazudo/zfb": "^4.3.3",
      "@takazudo/zdtp": "^0.8.6",
      "@takazudo/zudo-doc": "^6.1.1",
    },
  };
  const demoUi: Manifest = {
    dependencies: { "@takazudo/zudo-sg": "workspace:*" },
    devDependencies: { "@takazudo/zfb": "4.3.3" },
    peerDependencies: { "@takazudo/zfb": "^4.3.3" },
  };
  return { rootManifest, styleguide, demoUi };
}

function run(f: ReturnType<typeof currentFixture>) {
  return validatePeerFloors({
    rootManifest: f.rootManifest,
    owners: [
      { path: "packages/styleguide/package.json", manifest: f.styleguide },
      { path: "packages/demo-ui/package.json", manifest: f.demoUi },
    ],
  });
}

const deps = (m: Manifest, section: string) => m[section] as Record<string, string>;

describe("validatePeerFloors", () => {
  it("passes the current matching manifests", () => {
    expect(run(currentFixture())).toEqual([]);
  });

  it("passes the real checkout manifests", () => {
    expect(checkRepo(REPO_ROOT)).toEqual([]);
  });

  it("fails a root-only bump, then passes once root, owner pin and floor move together", () => {
    const f = currentFixture();
    deps(f.rootManifest, "dependencies")["@takazudo/zudo-doc"] = "6.2.0";
    const problems = run(f);
    expect(problems.map((p) => [p.name, p.field, p.actual, p.expected])).toEqual([
      ["@takazudo/zudo-doc", "peerDependencies", "^6.1.1", "^6.2.0"],
      ["@takazudo/zudo-doc", "devDependencies", "6.1.1", "6.2.0"],
    ]);
    expect(problems[0].fix).toContain("below the root pin 6.2.0");

    deps(f.styleguide, "devDependencies")["@takazudo/zudo-doc"] = "6.2.0";
    deps(f.styleguide, "peerDependencies")["@takazudo/zudo-doc"] = "^6.2.0";
    expect(run(f)).toEqual([]);
  });

  it("fails the historical stale engine doc ^6.0.0 and demo-ui zfb ^4.3.1 floors", () => {
    const f = currentFixture();
    deps(f.styleguide, "peerDependencies")["@takazudo/zudo-doc"] = "^6.0.0";
    deps(f.demoUi, "peerDependencies")["@takazudo/zfb"] = "^4.3.1";
    const problems = run(f);
    expect(problems.map((p) => [p.owner, p.name, p.actual, p.expected])).toEqual([
      ["packages/styleguide/package.json", "@takazudo/zudo-doc", "^6.0.0", "^6.1.1"],
      ["packages/demo-ui/package.json", "@takazudo/zfb", "^4.3.1", "^4.3.3"],
    ]);
  });

  it("fails a floor above the root pin", () => {
    const f = currentFixture();
    deps(f.styleguide, "peerDependencies")["@takazudo/zdtp"] = "^0.9.0";
    const [p, ...rest] = run(f);
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ name: "@takazudo/zdtp", actual: "^0.9.0", expected: "^0.8.6" });
    expect(p.fix).toContain("above the root pin");
  });

  it.each([
    ">=4.3.3",
    "~4.3.3",
    "*",
    "^4.3.3 || ^5.0.0",
    ">=4.3.3 <5",
    "^4.3",
    "^4.3.3-next.1",
    "workspace:^",
    "npm:@takazudo/zfb@^4.3.3",
    " ^4.3.3",
    "4.3.3",
  ])("rejects the unsupported peer range form %j without extracting a version", (range) => {
    const f = currentFixture();
    deps(f.demoUi, "peerDependencies")["@takazudo/zfb"] = range;
    const problems = run(f);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ actual: range, expected: "^4.3.3" });
    expect(problems[0].fix).toContain("unsupported range form");
  });

  it("fails a missing root reference visibly", () => {
    const f = currentFixture();
    delete deps(f.rootManifest, "dependencies")["@takazudo/zdtp"];
    const problems = run(f);
    expect(problems).toHaveLength(1);
    expect(problems[0].name).toBe("@takazudo/zdtp");
    expect(problems[0].fix).toContain("no root declaration");
  });

  it.each([
    ["^4.3.3", "is a range"],
    ["4.3.3-next.2", "prerelease/build suffix"],
    ["04.3.3", "malformed"],
    ["4.3", "malformed"],
    ["workspace:*", '"workspace:" specifier'],
    ["npm:@takazudo/zfb@4.3.3", '"npm:" specifier'],
  ])("fails the non-exact/malformed root reference %j", (spec, reason) => {
    const f = currentFixture();
    deps(f.rootManifest, "dependencies")["@takazudo/zfb"] = spec;
    const problems = run(f);
    // zfb is a peer of both owners, so both report the bad reference.
    expect(problems.map((p) => p.owner)).toEqual([
      "packages/styleguide/package.json",
      "packages/demo-ui/package.json",
    ]);
    for (const p of problems) expect(p.fix).toContain(reason);
  });

  it("resolves root pins from devDependencies and optionalDependencies", () => {
    expect(resolveRootPin({ devDependencies: { "@takazudo/x": "1.2.3" } }, "@takazudo/x")).toEqual({
      pin: "1.2.3",
    });
    expect(
      resolveRootPin({ optionalDependencies: { "@takazudo/x": "1.2.3" } }, "@takazudo/x"),
    ).toEqual({ pin: "1.2.3" });
  });

  it("passes identical duplicate root declarations and fails conflicting ones", () => {
    const f = currentFixture();
    f.rootManifest.devDependencies = { "@takazudo/zfb": "4.3.3" };
    expect(run(f)).toEqual([]);

    f.rootManifest.optionalDependencies = { "@takazudo/zfb": "4.3.4" };
    const problems = run(f);
    expect(problems).toHaveLength(2);
    for (const p of problems) {
      expect(p.fix).toContain("conflicting root declarations");
      expect(p.fix).toContain('devDependencies="4.3.3"');
      expect(p.fix).toContain('optionalDependencies="4.3.4"');
    }
  });

  it("discovers a newly added first-party peer automatically", () => {
    const f = currentFixture();
    deps(f.styleguide, "peerDependencies")["@takazudo/zfb-runtime"] = "^4.3.2";
    deps(f.rootManifest, "dependencies")["@takazudo/zfb-runtime"] = "4.3.3";
    const problems = run(f);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ name: "@takazudo/zfb-runtime", expected: "^4.3.3" });

    deps(f.styleguide, "peerDependencies")["@takazudo/zfb-runtime"] = "^4.3.3";
    expect(run(f)).toEqual([]);
  });

  it("ignores third-party peers", () => {
    const f = currentFixture();
    deps(f.styleguide, "peerDependencies").preact = ">=10 <12 || ^9.0.0-beta";
    f.styleguide.peerDependenciesMeta = { react: { optional: true } };
    expect(run(f)).toEqual([]);
  });

  it("checks optional first-party peers and leaves their optionality alone", () => {
    const f = currentFixture();
    deps(f.styleguide, "peerDependencies")["@takazudo/zdtp"] = "^0.8.5";
    f.styleguide.peerDependenciesMeta = { "@takazudo/zdtp": { optional: true } };
    const before = JSON.stringify(f.styleguide);
    const problems = run(f);
    expect(problems).toHaveLength(1);
    expect(problems[0].field).toBe("peerDependencies (optional peer)");
    expect(JSON.stringify(f.styleguide)).toBe(before);

    deps(f.styleguide, "peerDependencies")["@takazudo/zdtp"] = "^0.8.6";
    expect(run(f)).toEqual([]);
  });

  it("fails an optional first-party peer declared only in peerDependenciesMeta", () => {
    const f = currentFixture();
    f.demoUi.peerDependenciesMeta = { "@takazudo/zdtp": { optional: true } };
    const problems = run(f);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      owner: "packages/demo-ui/package.json",
      name: "@takazudo/zdtp",
      actual: "(no peerDependencies entry)",
    });
  });

  it.each(["dependencies", "devDependencies", "optionalDependencies"])(
    "fails an owner %s copy that disagrees with the root pin",
    (section) => {
      const f = currentFixture();
      f.demoUi[section] = { ...(f.demoUi[section] as object), "@takazudo/zfb": "4.3.1" };
      const problems = run(f);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatchObject({
        owner: "packages/demo-ui/package.json",
        field: section,
        actual: "4.3.1",
        expected: "4.3.3",
      });
    },
  );

  it("reports every mismatch, not just the first", () => {
    const f = currentFixture();
    deps(f.styleguide, "peerDependencies")["@takazudo/zfb"] = "^4.0.0";
    deps(f.styleguide, "peerDependencies")["@takazudo/zdtp"] = "~0.8.6";
    deps(f.demoUi, "devDependencies")["@takazudo/zfb"] = "4.3.0";
    expect(run(f)).toHaveLength(3);
  });
});

describe("check-first-party-peer-floors CLI", () => {
  let sandbox: string;
  let elsewhere: string;

  const write = (rel: string, data: unknown) => {
    const file = join(sandbox, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  };

  const runCli = () =>
    spawnSync(process.execPath, [join(sandbox, "scripts", "check-first-party-peer-floors.mjs")], {
      cwd: elsewhere,
      encoding: "utf8",
    });

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "peer-floors-"));
    elsewhere = mkdtempSync(join(tmpdir(), "peer-floors-cwd-"));
    mkdirSync(join(sandbox, "scripts"));
    copyFileSync(SCRIPT_SRC, join(sandbox, "scripts", "check-first-party-peer-floors.mjs"));
    const f = currentFixture();
    write("package.json", f.rootManifest);
    write("packages/styleguide/package.json", f.styleguide);
    write("packages/demo-ui/package.json", f.demoUi);
  });

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
    rmSync(elsewhere, { recursive: true, force: true });
  });

  it("locates manifests relative to the script from another cwd and exits 0", () => {
    const result = runCli();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("match the root pins");
  });

  it("exits 1 with an actionable report and leaves inputs untouched", () => {
    const f = currentFixture();
    deps(f.demoUi, "peerDependencies")["@takazudo/zfb"] = "^4.3.1";
    write("packages/demo-ui/package.json", f.demoUi);
    const files = ["package.json", "packages/styleguide/package.json", "packages/demo-ui/package.json"];
    const before = files.map((rel) => readFileSync(join(sandbox, rel), "utf8"));

    const result = runCli();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("packages/demo-ui/package.json → @takazudo/zfb [peerDependencies]");
    expect(result.stderr).toContain("actual:   ^4.3.1");
    expect(result.stderr).toContain("expected: ^4.3.3");
    expect(files.map((rel) => readFileSync(join(sandbox, rel), "utf8"))).toEqual(before);
  });

  it("exits 1 when an owner manifest cannot be parsed", () => {
    writeFileSync(join(sandbox, "packages/demo-ui/package.json"), "{ not json");
    const result = runCli();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("cannot read packages/demo-ui/package.json");
  });
});
