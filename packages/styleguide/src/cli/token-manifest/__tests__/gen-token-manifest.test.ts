import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runZudoSgCli } from "../../bin.js";
import type { ZudoSgConfig } from "../../config.js";
import { runGenTokenManifest, TokensConfigMissingError } from "../gen-token-manifest.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../..");
const TOKENS_CSS = readFileSync(resolve(REPO_ROOT, "packages/demo-ui/styles/tokens.css"), "utf8");
const COLORS_CSS = readFileSync(resolve(REPO_ROOT, "packages/demo-ui/styles/colors.css"), "utf8");

const CONFIG_WITHOUT_TOKENS: ZudoSgConfig = vi.hoisted(() => ({
  componentsRoots: [{ dir: "packages/demo-ui/src", importBase: "@zudo-sg/demo-ui/src" }],
  registryOut: "src/styleguide/sg-registry.ts",
  categoryOrder: [],
  uiPackageName: "@zudo-sg/demo-ui",
  barrelIndex: null,
  previewStyles: "preview.css",
}));

vi.mock("../../config.js", () => ({
  loadZudoSgConfig: async () => CONFIG_WITHOUT_TOKENS,
}));

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "gen-token-manifest-"));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function writeTokenInputs(cssFiles: [string, string]): void {
  const tokensCssPath = resolve(sandbox, cssFiles[0]);
  const colorsCssPath = resolve(sandbox, cssFiles[1]);
  mkdirSync(dirname(tokensCssPath), { recursive: true });
  mkdirSync(dirname(colorsCssPath), { recursive: true });
  if (tokensCssPath === colorsCssPath) {
    writeFileSync(tokensCssPath, `${TOKENS_CSS}\n${COLORS_CSS}`);
    return;
  }
  writeFileSync(tokensCssPath, TOKENS_CSS);
  writeFileSync(colorsCssPath, COLORS_CSS);
}

describe("gen-token-manifest without a tokens config", () => {
  it("runGenTokenManifest throws TokensConfigMissingError", () => {
    expect(() => runGenTokenManifest(sandbox, CONFIG_WITHOUT_TOKENS)).toThrow(TokensConfigMissingError);
    expect(() => runGenTokenManifest(sandbox, CONFIG_WITHOUT_TOKENS, { check: true })).toThrow(
      /needs a `tokens` entry in zudo-sg\.config\.mjs/,
    );
  });

  it("the CLI exits 1 with the missing-config message instead of a stack trace", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((msg: unknown) => {
      errors.push(String(msg));
    });

    expect(await runZudoSgCli(["gen-token-manifest"], sandbox)).toBe(1);
    expect(errors.join("\n")).toMatch(/gen-token-manifest needs a `tokens` entry/);
  });
});

describe("gen-token-manifest provenance", () => {
  it.each([
    ["./src/styles/ui-tokens.css", "./src/styles/ui-tokens.css"],
    ["./node_modules/@example/ui/styles/tokens.css", "./node_modules/@example/ui/styles/colors.css"],
  ] as Array<[string, string]>)
    ("passes configured paths through to the generated comments: %s, %s", (tokensCssPath, colorsCssPath) => {
      const cssFiles: [string, string] = [tokensCssPath, colorsCssPath];
      writeTokenInputs(cssFiles);
      const config: ZudoSgConfig = {
        ...CONFIG_WITHOUT_TOKENS,
        tokens: { cssFiles, manifestOut: "./manifest.ts" },
      };

      expect(runGenTokenManifest(sandbox, config)).toMatchObject({ changed: true });
      const rendered = readFileSync(resolve(sandbox, "manifest.ts"), "utf8");
      const normalizedPaths = cssFiles.map((path) => path.replace(/^\.\//, ""));
      for (const path of new Set(normalizedPaths)) expect(rendered).toContain(path);
      expect(rendered).not.toMatch(/demo-ui|pnpm gen:|pnpm check:/);
    });

  it("uses the public CLI command in drift errors", () => {
    const cssFiles: [string, string] = ["./src/styles/ui-tokens.css", "./src/styles/ui-tokens.css"];
    writeTokenInputs(cssFiles);
    const config: ZudoSgConfig = {
      ...CONFIG_WITHOUT_TOKENS,
      tokens: { cssFiles, manifestOut: "./manifest.ts" },
    };
    runGenTokenManifest(sandbox, config);
    writeFileSync(resolve(sandbox, "manifest.ts"), "stale");

    expect(() => runGenTokenManifest(sandbox, config, { check: true })).toThrow(
      /Run `zudo-sg gen-token-manifest` and commit the result\./,
    );
  });
});

describe("gen-token-manifest with a host spec", () => {
  const cssFiles: [string, string] = ["tokens.css", "colors.css"];
  const spec = {
    palette: [{ id: "brand", label: "Brand", tokens: [{ cssVar: "--brand-100" }, { cssVar: "--brand-500" }] }],
    color: [{ id: "roles", label: "Roles", tokens: [{ cssVar: "--ink" }] }],
  };
  const config: ZudoSgConfig = {
    ...CONFIG_WITHOUT_TOKENS,
    tokens: { cssFiles, manifestOut: "manifest.ts", spec },
  };

  beforeEach(() => {
    writeFileSync(resolve(sandbox, cssFiles[0]), ":root { --space-small: 4px; }");
    writeFileSync(resolve(sandbox, cssFiles[1]), ":root { --brand-100: #eef; --brand-500: #369; --ink: var(--brand-500); }");
  });

  it("writes an ordered foreign vocabulary and check mode only reads", () => {
    expect(runGenTokenManifest(sandbox, config)).toMatchObject({ changed: true, tokenCount: 3 });
    const first = readFileSync(resolve(sandbox, "manifest.ts"), "utf8");
    expect(first.indexOf("--brand-100")).toBeLessThan(first.indexOf("--brand-500"));
    expect(first).toContain("UI_TOKEN_GROUPS");
    expect(runGenTokenManifest(sandbox, config, { check: true })).toMatchObject({ changed: false });
    expect(readFileSync(resolve(sandbox, "manifest.ts"), "utf8")).toBe(first);
    writeFileSync(resolve(sandbox, "manifest.ts"), "stale");
    expect(() => runGenTokenManifest(sandbox, config, { check: true })).toThrow(/drift detected/);
    expect(readFileSync(resolve(sandbox, "manifest.ts"), "utf8")).toBe("stale");
  });

  it("validates before writing and leaves an existing manifest intact", () => {
    writeFileSync(resolve(sandbox, "manifest.ts"), "prior content");
    const bad: ZudoSgConfig = { ...config, tokens: { ...config.tokens!, spec: { palette: [{ id: "brand", label: "Brand", tokens: [{ cssVar: "--absent" }] }] } } };
    expect(() => runGenTokenManifest(sandbox, bad)).toThrow(/tokens\.spec\.palette\[0\]\.tokens\[0\]\.cssVar.*--absent/);
    expect(readFileSync(resolve(sandbox, "manifest.ts"), "utf8")).toBe("prior content");
  });
});
