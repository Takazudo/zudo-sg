import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Explicit-candidate `zfb wind explain` reads merged Wind settings, the
 * generation flag, and the token-override sidecar (preset index, previous
 * value, final value). Hashing only the merged token map misses a preset
 * change whose host override keeps the same CSS value. `sources` and
 * `manifests` are outside that read set (ZFB 4.3.1 `map_wind_config`; the
 * 4.3.3 and 4.4.0 releases do not change the explain or override read set).
 */
export const WIND_EXPLAIN_PROVENANCE_SCHEMA_VERSION = 1;

const EXPLAIN_IGNORED_WIND_KEYS = new Set(["sources", "manifests"]);

export type WindGeneration = "enabled" | "disabled" | "implicit-default";

export interface WindPresetContribution {
  index: number;
  wind: unknown;
}

export interface WindExplainProvenance {
  schemaVersion: typeof WIND_EXPLAIN_PROVENANCE_SCHEMA_VERSION;
  compilerVersion: string;
  generation: WindGeneration;
  presets: WindPresetContribution[];
  hostWind: unknown;
}

export async function hashWindExplainProvenance(repoRoot: string, compilerVersion: string): Promise<string> {
  const provenance = await loadWindExplainProvenance(repoRoot, compilerVersion);
  return createHash("sha256").update(canonicalize(provenance)).digest("hex");
}

export async function loadWindExplainProvenance(repoRoot: string, compilerVersion: string): Promise<WindExplainProvenance> {
  if (!compilerVersion.trim()) {
    throw new Error("Wind explain provenance requires the installed compiler version");
  }
  return projectWindExplainProvenance(await loadEvaluatedConfig(repoRoot), compilerVersion);
}

export function projectWindExplainProvenance(config: unknown, compilerVersion: string): WindExplainProvenance {
  if (!compilerVersion.trim()) {
    throw new Error("Wind explain provenance requires the installed compiler version");
  }
  const record = plainObject(config, "zfb config");
  return {
    schemaVersion: WIND_EXPLAIN_PROVENANCE_SCHEMA_VERSION,
    compilerVersion,
    generation: generationOf(record),
    presets: projectPresets(record.presets),
    hostWind: projectHostWind(record),
  };
}

async function loadEvaluatedConfig(repoRoot: string): Promise<unknown> {
  const tsConfig = resolve(repoRoot, "zfb.config.ts");
  const jsonConfig = resolve(repoRoot, "zfb.config.json");
  if (existsSync(tsConfig)) {
    const stamp = statSync(tsConfig, { bigint: true }).mtimeNs.toString();
    const imported = await import(freshConfigModuleUrl(tsConfig, stamp));
    if (!("default" in imported)) throw new Error(`zfb config has no default export: ${tsConfig}`);
    return imported.default;
  }
  if (existsSync(jsonConfig)) return JSON.parse(readFileSync(jsonConfig, "utf8")) as unknown;
  throw new Error(`Missing zfb config in ${repoRoot} (expected zfb.config.ts or zfb.config.json)`);
}

/**
 * Node caches an ESM module by its URL. The stamp makes a changed
 * `zfb.config.ts` load again in the same process. The separator is built at
 * runtime: zfb 4.4.0 still copies `packages/` into the bundle shadow and rejects a
 * dynamic import whose specifier text contains a query. Only a static
 * default raw-text import is accepted there.
 */
function freshConfigModuleUrl(tsConfig: string, stamp: string): string {
  return `${pathToFileURL(tsConfig).href}${String.fromCharCode(63)}wind-provenance=${stamp}`;
}

function generationOf(config: Record<string, unknown>): WindGeneration {
  if (!Object.prototype.hasOwnProperty.call(config, "wind") || config.wind === undefined) return "implicit-default";
  if (config.wind === false) return "disabled";
  if (isPlainObject(config.wind)) return "enabled";
  throw new Error(`Unsupported wind configuration: expected an object or false, received ${describe(config.wind)}`);
}

function projectHostWind(config: Record<string, unknown>): unknown {
  if (!Object.prototype.hasOwnProperty.call(config, "wind") || config.wind === undefined) return null;
  return projectWind(config.wind, "wind");
}

function projectPresets(presets: unknown): WindPresetContribution[] {
  if (presets === undefined) return [];
  if (!Array.isArray(presets)) throw new Error(`Unsupported presets: expected an array, received ${describe(presets)}`);
  return presets.map((preset, index) => {
    const record = plainObject(preset, `presets[${index}]`);
    const wind = Object.prototype.hasOwnProperty.call(record, "wind") ? projectWind(record.wind, `presets[${index}].wind`) : null;
    return { index, wind };
  });
}

function projectWind(wind: unknown, path: string): unknown {
  if (wind === false) return false;
  const record = plainObject(wind, path);
  const projected: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (EXPLAIN_IGNORED_WIND_KEYS.has(key)) continue;
    projected[key] = jsonValue(record[key], `${path}.${key}`);
  }
  return projected;
}

function plainObject(value: unknown, path: string): Record<string, unknown> {
  if (!isPlainObject(value)) throw new Error(`Unsupported ${path}: expected a plain object, received ${describe(value)}`);
  return value;
}

function jsonValue(value: unknown, path: string): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Unsupported ${path}: non-finite number`);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => jsonValue(entry, `${path}[${index}]`));
  if (isPlainObject(value)) {
    const projected: Record<string, unknown> = {};
    for (const key of Object.keys(value)) projected[key] = jsonValue(value[key], `${path}.${key}`);
    return projected;
  }
  throw new Error(`Unsupported ${path}: cannot represent ${describe(value)} in Wind explain provenance`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/** Object keys are ordered; array order is preserved. */
export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  if (isPlainObject(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}
