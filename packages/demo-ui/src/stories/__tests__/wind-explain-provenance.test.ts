import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getWindCompilerVersion } from "../../../scripts/authored-class-coverage";
import {
  canonicalize,
  hashWindExplainProvenance,
  loadWindExplainProvenance,
  projectWindExplainProvenance,
} from "../../../scripts/wind-explain-provenance";

const REPO_ROOT = resolve(__dirname, "../../../../../");
const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempProject(config: unknown): string {
  const root = mkdtempSync(join(tmpdir(), "wind-provenance-"));
  tempRoots.push(root);
  writeFileSync(join(root, "zfb.config.json"), `${JSON.stringify(config)}\n`);
  writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  return root;
}

function rewriteConfig(root: string, config: unknown): void {
  writeFileSync(join(root, "zfb.config.json"), `${JSON.stringify(config)}\n`);
}

interface ProvenanceFixture {
  presets: Array<{
    plugins?: Array<{ name: string }>;
    wind: {
      tokens: { colors: Record<string, string> };
      breakpoints?: Record<string, { minWidthPx: number }>;
      sources?: { classHelpers: string[] };
      manifests?: Record<string, { path: string }>;
      safelist?: { owner: string[] };
    };
  }>;
  wind: {
    tokens: { colors: Record<string, string> };
    breakpoints: Record<string, { minWidthPx: number }>;
    strict: boolean;
    dark: false | { attribute: string; value: string };
    reset: string;
    utilities: { placement: string };
    authoredClasses: Record<string, true>;
    sources: { roots: string[]; classHelpers: string[] };
    manifests: Record<string, { path: string }>;
  };
}

function presetAt(config: ProvenanceFixture, index: number): ProvenanceFixture["presets"][number] {
  const preset = config.presets[index];
  if (!preset) throw new Error(`missing preset ${index}`);
  return preset;
}

const baseConfig: ProvenanceFixture = {
  presets: [
    {
      plugins: [{ name: "preset-a" }],
      wind: {
        tokens: { colors: { accent: "from-preset-a", kept: "same" } },
        breakpoints: { sm: { minWidthPx: 640 } },
        sources: { classHelpers: ["cx"] },
        manifests: { "preset-a": { path: "./a.json" } },
      },
    },
    {
      wind: {
        tokens: { colors: { accent: "from-preset-b", extra: "gold" } },
        safelist: { owner: ["one", "two"] },
      },
    },
  ],
  wind: {
    tokens: { colors: { accent: "host-final", kept: "same" } },
    breakpoints: { sm: { minWidthPx: 640 }, md: { minWidthPx: 768 } },
    strict: true,
    dark: false,
    reset: "owned-v1",
    utilities: { placement: "before-authored" },
    authoredClasses: { "zc-card": true },
    sources: { roots: ["src"], classHelpers: ["cx", "cn"] },
    manifests: { host: { path: "./host.json" } },
  },
};

describe("wind explain provenance", () => {
  it("imports the evaluated root preset and host wind, ignoring lockfile and engine version bytes", async () => {
    const compilerVersion = getWindCompilerVersion(REPO_ROOT);
    const provenance = await loadWindExplainProvenance(REPO_ROOT, compilerVersion);
    const hostWind = provenance.hostWind as { tokens: { colors: Record<string, string> }; sources?: unknown; manifests?: unknown };
    const presetWind = provenance.presets[0]?.wind as { tokens: { colors: Record<string, string> } };

    expect(provenance.compilerVersion).toBe(compilerVersion);
    expect(provenance.generation).toBe("enabled");
    expect(provenance.presets.map((preset) => preset.index)).toEqual([0]);
    expect(presetWind.tokens.colors["zd-bg"]).toBe("var(--color-zd-bg)");
    expect(hostWind.tokens.colors["sg-fg"]).toBe("var(--sg-fg)");
    expect(hostWind.tokens.colors.fg).toBe("var(--color-fg)");
    expect(hostWind.sources).toBeUndefined();
    expect(hostWind.manifests).toBeUndefined();

    const hash = await hashWindExplainProvenance(REPO_ROOT, compilerVersion);
    const lockPath = resolve(REPO_ROOT, "pnpm-lock.yaml");
    const manifestPath = resolve(REPO_ROOT, "packages/styleguide/package.json");
    const lock = readFileSync(lockPath, "utf8");
    const manifest = readFileSync(manifestPath, "utf8");
    try {
      writeFileSync(lockPath, `${lock}\n# wind-provenance-noise\n`);
      const parsed = JSON.parse(manifest) as { version: string };
      parsed.version = `${parsed.version}-provenance-noise`;
      writeFileSync(manifestPath, `${JSON.stringify(parsed, null, 2)}\n`);
      expect(await hashWindExplainProvenance(REPO_ROOT, compilerVersion)).toBe(hash);
    } finally {
      writeFileSync(lockPath, lock);
      writeFileSync(manifestPath, manifest);
    }
    expect(await hashWindExplainProvenance(REPO_ROOT, `${compilerVersion}-other`)).not.toBe(hash);
  });

  it("tracks preset position and overridden values through the config files the compiler loads", async () => {
    const root = tempProject(baseConfig);
    const original = await hashWindExplainProvenance(root, "4.3.1");

    writeFileSync(join(root, "pnpm-lock.yaml"), "unrelated: true\n");
    writeFileSync(join(root, "packages-styleguide-version.txt"), "0.0.0-noise\n");
    expect(await hashWindExplainProvenance(root, "4.3.1")).toBe(original);

    const ignoredMetadata = structuredClone(baseConfig);
    const ignoredPreset = presetAt(ignoredMetadata, 0);
    ignoredPreset.wind.sources = { classHelpers: ["only"] };
    ignoredPreset.wind.manifests = { "preset-a": { path: "./moved.json" } };
    ignoredMetadata.wind.sources.classHelpers = ["cn"];
    ignoredMetadata.wind.manifests.host = { path: "./moved.json" };
    rewriteConfig(root, ignoredMetadata);
    expect(await hashWindExplainProvenance(root, "4.3.1")).toBe(original);

    const reorderedKeys = {
      wind: {
        manifests: baseConfig.wind.manifests,
        authoredClasses: { "zc-card": true },
        utilities: { placement: "before-authored" },
        reset: "owned-v1",
        dark: false,
        strict: true,
        breakpoints: { md: { minWidthPx: 768 }, sm: { minWidthPx: 640 } },
        tokens: { colors: { kept: "same", accent: "host-final" } },
        sources: baseConfig.wind.sources,
      },
      presets: baseConfig.presets,
    };
    rewriteConfig(root, reorderedKeys);
    expect(await hashWindExplainProvenance(root, "4.3.1")).toBe(original);

    const presetValue = structuredClone(baseConfig);
    presetAt(presetValue, 0).wind.tokens.colors.accent = "from-preset-a-changed";
    rewriteConfig(root, presetValue);
    const presetValueHash = await hashWindExplainProvenance(root, "4.3.1");
    expect(presetValueHash).not.toBe(original);

    const swapped = structuredClone(baseConfig);
    swapped.presets.reverse();
    rewriteConfig(root, swapped);
    expect(await hashWindExplainProvenance(root, "4.3.1")).not.toBe(presetValueHash);

    const hostOverride = structuredClone(baseConfig);
    hostOverride.wind.tokens.colors.accent = "host-final-changed";
    rewriteConfig(root, hostOverride);
    expect(await hashWindExplainProvenance(root, "4.3.1")).not.toBe(original);

    for (const mutate of [
      (config: ProvenanceFixture) => {
        config.wind.breakpoints.md = { minWidthPx: 800 };
      },
      (config: ProvenanceFixture) => {
        config.wind.dark = { attribute: "data-theme", value: "dark" };
      },
      (config: ProvenanceFixture) => {
        config.wind.strict = false;
      },
      (config: ProvenanceFixture) => {
        config.wind.authoredClasses["zc-extra"] = true;
      },
      (config: ProvenanceFixture) => {
        config.wind.utilities.placement = "after-authored";
      },
      (config: ProvenanceFixture) => {
        const safelist = presetAt(config, 1).wind.safelist;
        if (!safelist) throw new Error("missing safelist");
        safelist.owner = ["two", "one"];
      },
    ]) {
      const next = structuredClone(baseConfig);
      mutate(next);
      rewriteConfig(root, next);
      expect(await hashWindExplainProvenance(root, "4.3.1")).not.toBe(original);
    }
  });

  it("keeps an unknown wind field and rejects a shape it cannot represent", () => {
    const withUnknown = projectWindExplainProvenance(
      { wind: { tokens: { colors: { fg: "black" } }, futureFlag: { mode: "keep" } } },
      "4.3.1",
    );
    const withoutUnknown = projectWindExplainProvenance({ wind: { tokens: { colors: { fg: "black" } } } }, "4.3.1");
    expect(canonicalize(withUnknown)).not.toBe(canonicalize(withoutUnknown));
    expect(canonicalize(withUnknown)).toContain("futureFlag");

    expect(() => projectWindExplainProvenance({ wind: true }, "4.3.1")).toThrow(/Unsupported wind configuration/);
    expect(() => projectWindExplainProvenance({ wind: { tokens: { colors: { fg() {} } } } }, "4.3.1")).toThrow(/cannot represent function/);
    expect(() => projectWindExplainProvenance({ presets: { wind: {} } }, "4.3.1")).toThrow(/Unsupported presets/);
    expect(() => projectWindExplainProvenance({}, " ")).toThrow(/installed compiler version/);
  });

  it("diagnoses a project without a compiler config file", async () => {
    const root = mkdtempSync(join(tmpdir(), "wind-provenance-missing-"));
    tempRoots.push(root);
    await expect(hashWindExplainProvenance(root, "4.3.1")).rejects.toThrow(/Missing zfb config/);
  });
});
