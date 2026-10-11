// Canonical, renderer-free metadata for opt-in external preview catalogs.
// File existence, emitted image dimensions and actual runtime capture belong
// to build/capture tooling, not this import-safe data validator.
import { isSerializableProps } from "../preview/external-runtime.js";

/** Tuple encoding avoids collisions even when an authored variant contains '/'. */
export function externalCatalogKey(slug: string, variant: string): string {
  return JSON.stringify([slug, variant]);
}

/** Verbatim source text, never an HTML fragment, filesystem include or render function. */
export interface DescriptorSource {
  key: string;
  code: string;
}

export interface ExternalFixtureReference {
  /** Project-root-relative module path used by the host's generated loader. */
  module: string;
  exportName: string;
}

export interface ExternalCatalogLoader extends ExternalFixtureReference {
  key: string;
}

/** An image declaration promises a real capture; shape validation is not capture evidence. */
export type ExternalCaptureDisposition =
  | {
      kind: "image";
      key: string;
      fixture: ExternalFixtureReference;
      /** Root-absolute emitted asset URL, before adding the site's base. */
      src: string;
      width: number;
      height: number;
    }
  | { kind: "placeholder" | "failed"; key: string; note: string };

export interface ExternalCatalogEntry {
  slug: string;
  variant: string;
  loader: ExternalCatalogLoader;
  source: DescriptorSource;
  capture: ExternalCaptureDisposition;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isDescriptorSource(value: unknown): value is DescriptorSource {
  return isSerializableProps(value) && nonEmpty(value.key) && typeof value.code === "string";
}

function fixtureReference(value: unknown): value is ExternalFixtureReference {
  if (!isSerializableProps(value) || !nonEmpty(value.module) || !nonEmpty(value.exportName)) return false;
  const segments = value.module.slice(2).split("/");
  return value.module.startsWith("./") && !/[\\?#%\s]/u.test(value.module) &&
    segments.every((segment) => segment !== "" && segment !== "." && segment !== "..") &&
    /^[A-Za-z_$][\w$]*$/u.test(value.exportName);
}

function assetPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !/[\\?#%\s]/u.test(value) &&
    value.slice(1).split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function positiveDimension(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/**
 * Validate one canonical generator input and return normalized copies. Every
 * row owns exactly one descriptor/loader/source/capture identity. Runtimes
 * import generated loader code separately; this manifest never imports it.
 * This does NOT inspect files or claim that a promised capture has succeeded.
 */
export function validateExternalCatalogManifest(input: unknown): ExternalCatalogEntry[] {
  if (!Array.isArray(input)) throw new Error("[zudo-sg] external catalog manifest must be an array");
  const keys = new Set<string>();
  const assets = new Set<string>();
  return input.map((raw: unknown, index) => {
    const fail = (message: string): never => { throw new Error(`[zudo-sg] external catalog[${index}]: ${message}`); };
    if (!isSerializableProps(raw)) return fail("entry must contain only serializable data");
    if (!nonEmpty(raw.slug) || /[\s/\\?#%]/u.test(raw.slug) || raw.slug === "." || raw.slug === "..") return fail("invalid slug");
    if (!nonEmpty(raw.variant)) return fail("variant must be a non-empty string");
    const key = externalCatalogKey(raw.slug, raw.variant);
    if (keys.has(key)) return fail(`duplicate identity ${key}`);
    keys.add(key);
    if (!isSerializableProps(raw.loader) || !fixtureReference(raw.loader) || raw.loader.key !== key) return fail(`loader must name ${key} and a valid module/export`);
    if (!isDescriptorSource(raw.source) || raw.source.key !== key) return fail(`source must name ${key} and provide code text`);
    const capture = raw.capture;
    if (!isSerializableProps(capture) || capture.key !== key) return fail(`capture must name ${key}`);
    let normalizedCapture: ExternalCaptureDisposition;
    if (capture.kind === "image") {
      if (!fixtureReference(capture.fixture) || capture.fixture.module !== raw.loader.module ||
        capture.fixture.exportName !== raw.loader.exportName) return fail("capture fixture differs from loader");
      if (!assetPath(capture.src)) return fail("capture image needs a root-absolute emitted asset path without traversal/query/hash");
      if (!positiveDimension(capture.width) || !positiveDimension(capture.height)) return fail("capture image needs positive integer dimensions");
      if (assets.has(capture.src)) return fail(`capture asset is owned by multiple variants: ${capture.src}`);
      assets.add(capture.src);
      normalizedCapture = {
        kind: "image", key, src: capture.src, width: capture.width, height: capture.height,
        fixture: { module: capture.fixture.module, exportName: capture.fixture.exportName },
      };
    } else if ((capture.kind === "placeholder" || capture.kind === "failed") && nonEmpty(capture.note)) {
      normalizedCapture = { kind: capture.kind, key, note: capture.note };
    } else return fail("capture must be an image promise or a labelled placeholder/failed disposition");
    return {
      slug: raw.slug,
      variant: raw.variant,
      loader: { key, module: raw.loader.module, exportName: raw.loader.exportName },
      source: { key, code: raw.source.code },
      capture: normalizedCapture,
    };
  });
}
