import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runZudoSgCli } from "../../bin.js";
import type { ZudoSgConfig } from "../../config.js";
import { runGenTokenManifest, TokensConfigMissingError } from "../gen-token-manifest.js";

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
