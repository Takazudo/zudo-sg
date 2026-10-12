// Node-only prebuild/capture API. Never import from zfb.config or browser code.
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { absoluteComponents } from "./catalog-path.js";
import { inflateSync } from "node:zlib";
import { isExternalRuntimeIdentity, isJsonValue, matchesExternalRuntimeIdentity, type ExternalRuntimeIdentity } from "../preview/external-runtime.js";
import type { ExternalRuntimeSnapshot } from "../preview/runtime-controller.js";
import { validateStoryDescriptors, type ThumbnailDescriptor } from "./descriptors.js";
import { externalCatalogKey, validateExternalCatalogManifest, type DescriptorSource, type ExternalCatalogEntry, type ExternalCatalogLoader, type ExternalCaptureDisposition } from "./external-catalog.js";

function fail(message: string): never { throw new Error(`[zudo-sg] external catalog: ${message}`); }
function hash(bytes: string | Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }

function keyed<T extends { key: string }>(values: readonly T[], label: string): Map<string, T> {
  if (!Array.isArray(values) || !isJsonValue(values as unknown)) fail(`${label} must be a dense serializable array`);
  const result = new Map<string, T>();
  for (const value of values) {
    if (!value || typeof value.key !== "string" || result.has(value.key)) fail(`${label} has a missing or duplicate key`);
    result.set(value.key, value);
  }
  return result;
}
function sameKeys(expected: readonly string[], actual: Map<string, unknown>, label: string): void {
  const missing = expected.filter((key) => !actual.has(key));
  const wanted = new Set(expected);
  const extra = [...actual.keys()].filter((key) => !wanted.has(key));
  if (missing.length || extra.length) fail(`${label} key mismatch; missing: ${missing.join(", ")}; extra: ${extra.join(", ")}`);
}

/** A failed promise is an error, never an intentional placeholder. */
export function thumbnailFromExternalCapture(capture: ExternalCaptureDisposition): ThumbnailDescriptor {
  if (capture.kind === "failed") fail(`capture failed for ${capture.key}: ${capture.note}`);
  if (capture.kind !== "image") return { kind: "placeholder", note: capture.note };
  if (!/\.png$/i.test(capture.src)) fail(`captured image must use a .png emitted path: ${capture.src}`);
  return { kind: "image", src: capture.src, width: capture.width, height: capture.height };
}

export interface ExternalCatalogOutputs {
  manifest: unknown;
  descriptors: unknown;
  /** Actual metadata emitted beside the external bundle's generated loader functions. */
  loaders: readonly ExternalCatalogLoader[];
  /** Actual displayed-source output; compare content as well as identity. */
  sources: readonly DescriptorSource[];
}

/** Compare the entire generated catalog, including extras and duplicate identities. */
export function validateExternalCatalogOutputs(input: ExternalCatalogOutputs): ExternalCatalogEntry[] {
  const manifest = validateExternalCatalogManifest(input.manifest);
  if (!isJsonValue(input.descriptors)) fail("descriptors must be dense serializable data");
  const descriptors = validateStoryDescriptors(input.descriptors);
  const variants = keyed(descriptors.flatMap((d) => d.variants.map((v) => ({
    key: externalCatalogKey(d.slug, v.exportName), source: v.source ?? null,
  }))), "descriptors");
  const loaders = keyed(input.loaders, "loaders");
  const sources = keyed(input.sources, "sources");
  const keys = manifest.map((row) => row.loader.key);
  sameKeys(keys, variants, "descriptors"); sameKeys(keys, loaders, "loaders"); sameKeys(keys, sources, "sources");
  for (const row of manifest) {
    const key = row.loader.key;
    const actual = loaders.get(key)!;
    if (actual.module !== row.loader.module || actual.exportName !== row.loader.exportName) fail(`loader differs for ${key}`);
    if (sources.get(key)?.code !== row.source.code || variants.get(key)?.source?.code !== row.source.code ||
      variants.get(key)?.source?.key !== key) fail(`displayed source differs for ${key}`);
    thumbnailFromExternalCapture(row.capture);
  }
  const byKey = new Map(manifest.map((row) => [row.loader.key, row]));
  for (const descriptor of descriptors) {
    // One catalog tile represents the first authored variant; every variant's
    // capture is independently checked below, even when it is not that tile.
    const row = byKey.get(externalCatalogKey(descriptor.slug, descriptor.variants[0]!.exportName))!;
    const expected = thumbnailFromExternalCapture(row.capture);
    const actual = descriptor.thumbnail;
    if (!actual || actual.kind !== expected.kind || (actual.kind === "image" && expected.kind === "image"
      ? actual.src !== expected.src || actual.width !== expected.width || actual.height !== expected.height
      : actual.kind === "placeholder" && expected.kind === "placeholder" && actual.note !== expected.note)) {
      fail(`catalog thumbnail differs for ${descriptor.slug}`);
    }
  }
  return manifest;
}

function errno(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

/** Canonical directory, after ancestor aliases are resolved. ENOENT is the only swallowed failure. */
function canonicalDirectory(path: string): string {
  let canonical: string;
  try { canonical = realpathSync(path); }
  catch (error) { if (errno(error) !== "ENOENT") throw error; return fail(`catalog root is not a directory: ${path}`); }
  try {
    const listed = lstatSync(canonical);
    if (!listed.isSymbolicLink() && listed.isDirectory()) return canonical;
  } catch (error) { if (errno(error) !== "ENOENT") throw error; }
  return fail(`catalog root is not a directory: ${path}`);
}

/**
 * One canonical boundary for a capture or validation. A symlink at the
 * configured root is rejected before realpath, including a dangling root.
 * Ancestor aliases above that root may resolve. A missing root keeps its
 * missing suffix and is not created here.
 */
function resolveCatalogRoot(root: string): string {
  const absolute = resolve(root);
  try {
    const listed = lstatSync(absolute);
    if (listed.isSymbolicLink()) fail(`symlink is not allowed: ${absolute}`);
    if (!listed.isDirectory()) fail(`catalog root is not a directory: ${absolute}`);
    return canonicalDirectory(absolute);
  } catch (error) {
    if (errno(error) !== "ENOENT") throw error;
  }
  const missing: string[] = [];
  let cursor = absolute;
  for (;;) {
    const parent = dirname(cursor);
    if (parent === cursor) fail(`catalog root has no existing ancestor: ${absolute}`);
    missing.unshift(basename(cursor));
    cursor = parent;
    try {
      const listed = lstatSync(cursor);
      if (listed.isSymbolicLink()) {
        let target: string;
        try { target = realpathSync(cursor); }
        catch (error) { if (errno(error) !== "ENOENT") throw error; return fail(`symlink is not allowed: ${cursor}`); }
        return resolve(canonicalDirectory(target), ...missing);
      }
      if (!listed.isDirectory()) fail(`catalog root is not a directory: ${cursor}`);
      return resolve(canonicalDirectory(cursor), ...missing);
    } catch (error) { if (errno(error) !== "ENOENT") throw error; }
  }
}

/** Segment containment against an already canonical boundary. Does not realpath the candidate or the boundary. */
function containedPath(boundary: string, path: string, createParents = false): string {
  const candidate = resolve(boundary, path);
  const rel = relative(boundary, candidate);
  if (!rel || isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) fail(`path escapes asset/project root: ${path}`);
  // lstat each component, including one that replaced the canonical root during capture.
  // Stop at the first absent component; do not create it yet.
  for (const cursor of absoluteComponents(candidate)) {
    try { if (lstatSync(cursor).isSymbolicLink()) fail(`symlink is not allowed: ${cursor}`); }
    catch (error) { if (errno(error) !== "ENOENT") throw error; break; }
  }
  if (createParents) mkdirSync(dirname(candidate), { recursive: true });
  return candidate;
}

function loaderHash(projectRoot: string, row: ExternalCatalogEntry): string {
  const path = containedPath(projectRoot, row.loader.module);
  try { return hash(readFileSync(path)); }
  catch { return fail(`loader module is missing or unreadable: ${row.loader.module}`); }
}

// Captures use noninterlaced 8-bit PNG, as emitted by browser screenshots.
// Check chunk checksums, complete image data, dimensions and row filters; a
// signature/header alone would accept a truncated or corrupt promised asset.
function pngDimensions(bytes: Uint8Array): { width: number; height: number } {
  const data = Buffer.from(bytes);
  if (data.length < 45 || data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") fail("invalid PNG signature/body");
  let at = 8, width = 0, height = 0, channels = 0, ended = false;
  const compressed: Buffer[] = [];
  while (at < data.length) {
    if (at + 12 > data.length) fail("truncated PNG chunk");
    const size = data.readUInt32BE(at), type = data.toString("latin1", at + 4, at + 8), end = at + 12 + size;
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)) fail("invalid PNG chunk type");
    if (/^[A-Z]/.test(type) && !["IHDR", "IDAT", "IEND"].includes(type)) fail("unsupported PNG critical chunk");
    if (end > data.length) fail("truncated PNG data");
    let crc = 0xffffffff;
    for (const byte of data.subarray(at + 4, end - 4)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    if (((crc ^ 0xffffffff) >>> 0) !== data.readUInt32BE(end - 4)) fail("invalid PNG checksum");
    if (at === 8) {
      if (type !== "IHDR" || size !== 13) fail("missing PNG IHDR");
      width = data.readUInt32BE(at + 8); height = data.readUInt32BE(at + 12);
      channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[data[at + 17]!] ?? 0;
      if (!width || !height || width * height > 16_777_216 || data[at + 16] !== 8 || !channels ||
        data[at + 18] !== 0 || data[at + 19] !== 0 || data[at + 20] !== 0) fail("unsupported PNG dimensions/encoding (8-bit, noninterlaced; at most 16M pixels)");
    } else if (type === "IHDR") fail("duplicate PNG IHDR");
    if (type === "IDAT") compressed.push(data.subarray(at + 8, end - 4));
    at = end;
    if (type === "IEND") { if (size !== 0 || at !== data.length) fail("invalid PNG end"); ended = true; break; }
  }
  if (!ended || !compressed.length) fail("incomplete PNG");
  const stride = width * channels + 1;
  let raw: Buffer;
  try { raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: stride * height }); }
  catch { return fail("invalid PNG compressed data"); }
  if (raw.length !== stride * height) fail("invalid PNG pixel data length");
  for (let y = 0; y < height; y++) if (raw[y * stride]! > 4) fail("invalid PNG row filter");
  return { width, height };
}

export interface ExternalCaptureReceipt {
  key: string;
  fixture: { module: string; exportName: string };
  src: string;
  width: number;
  height: number;
  imageSha256: string;
  loaderSha256: string;
  sourceSha256: string;
  runtime: ExternalRuntimeIdentity;
  stability: "runtime.whenStable";
}

export interface ExternalCatalogAssetsOptions {
  manifest: unknown;
  projectRoot: string;
  /** Directory containing capture paths: public/ before build; dist/ or dist/<base>/ after build. */
  assetRoot: string;
  captures: readonly ExternalCaptureReceipt[];
}

function validateResolvedCatalogAssets(options: ExternalCatalogAssetsOptions, projectRoot: string, assetRoot: string): void {
  const manifest = validateExternalCatalogManifest(options.manifest);
  const receipts = keyed(options.captures, "capture receipts");
  sameKeys(manifest.filter((row) => row.capture.kind === "image").map((row) => row.loader.key), receipts, "capture receipts");
  for (const row of manifest) {
    thumbnailFromExternalCapture(row.capture);
    const currentLoaderHash = loaderHash(projectRoot, row);
    if (row.capture.kind !== "image") continue;
    const capture = row.capture, receipt = receipts.get(capture.key)!;
    if (!isExternalRuntimeIdentity(receipt.runtime) || receipt.runtime.slug !== row.slug || receipt.runtime.variant !== row.variant ||
      receipt.stability !== "runtime.whenStable" || receipt.fixture?.module !== row.loader.module || receipt.fixture.exportName !== row.loader.exportName ||
      receipt.src !== capture.src || receipt.width !== capture.width || receipt.height !== capture.height ||
      receipt.loaderSha256 !== currentLoaderHash || receipt.sourceSha256 !== hash(row.source.code)) fail(`stale/mismatched capture receipt for ${capture.key}`);
    const path = containedPath(assetRoot, `.${capture.src}`);
    let image: Buffer;
    try { image = readFileSync(path); } catch { return fail(`promised image is missing: ${capture.src}`); }
    const dimensions = pngDimensions(image);
    if (dimensions.width !== capture.width || dimensions.height !== capture.height || hash(image) !== receipt.imageSha256) fail(`image bytes/dimensions differ for ${capture.key}`);
  }
}

export function validateExternalCatalogAssets(options: ExternalCatalogAssetsOptions): void {
  validateResolvedCatalogAssets(options, resolveCatalogRoot(options.projectRoot), resolveCatalogRoot(options.assetRoot));
}

/** Wrap a caller-owned browser page and its fixture-exposed runtime controller. */
export interface ExternalCapturePage {
  goto(url: string): Promise<unknown>;
  setViewportSize(size: { width: number; height: number }): Promise<unknown>;
  whenStable(): Promise<ExternalRuntimeIdentity>;
  getSnapshot(): Promise<ExternalRuntimeSnapshot>;
  screenshot(options: { type: "png"; scale: "css" }): Promise<Uint8Array>;
}
export interface CaptureExternalCatalogOptions {
  manifest: unknown;
  projectRoot: string;
  assetRoot: string;
  origin: string;
  base?: string;
  /** Root-absolute external document path, before the site base. */
  previewUrl: string;
  page: ExternalCapturePage;
}

/** Capture the actual external document; this never renders a fixture in Node. */
export async function captureExternalCatalogImages(options: CaptureExternalCatalogOptions): Promise<ExternalCaptureReceipt[]> {
  const manifest = validateExternalCatalogManifest(options.manifest);
  // Resolve once. Later checks reuse these paths so an ancestor alias retargeted
  // during browser awaits cannot move the write.
  const projectRoot = resolveCatalogRoot(options.projectRoot);
  const assetRoot = resolveCatalogRoot(options.assetRoot);
  const origin = new URL(options.origin);
  if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== options.origin || origin.username || origin.password) fail("origin must be an HTTP(S) origin without path or credentials");
  const base = options.base ?? "/";
  const portable = (path: string) => path.startsWith("/") && !path.startsWith("//") && !/[\\?#%\s]/u.test(path) && !path.split("/").some((part) => part === "." || part === "..");
  if (!portable(base) || !portable(options.previewUrl)) fail("base/previewUrl must be root-absolute portable paths");
  const receipts: ExternalCaptureReceipt[] = [];
  // Validate every path and failed disposition before any browser work/write.
  for (const row of manifest) {
    thumbnailFromExternalCapture(row.capture); loaderHash(projectRoot, row);
    if (row.capture.kind === "image") containedPath(assetRoot, `.${row.capture.src}`);
  }
  for (const row of manifest) {
    const capture = row.capture;
    if (capture.kind !== "image") continue;
    const initialLoaderHash = loaderHash(projectRoot, row);
    const url = new URL(base.replace(/\/$/, "") + options.previewUrl, origin);
    url.searchParams.set("slug", row.slug); url.searchParams.set("variant", row.variant);
    await options.page.setViewportSize({ width: capture.width, height: capture.height });
    await options.page.goto(url.href);
    const runtime = await options.page.whenStable();
    const check = async () => {
      const state = await options.page.getSnapshot();
      if (!isExternalRuntimeIdentity(runtime) || runtime.slug !== row.slug || runtime.variant !== row.variant ||
        !state.ready || state.error || !isExternalRuntimeIdentity(state.identity) || !matchesExternalRuntimeIdentity(state.identity, runtime)) fail(`runtime changed or failed during capture: ${capture.key}`);
    };
    await check();
    const image = await options.page.screenshot({ type: "png", scale: "css" });
    await check();
    const dimensions = pngDimensions(image);
    if (dimensions.width !== capture.width || dimensions.height !== capture.height) fail(`capture dimensions differ for ${capture.key}`);
    if (loaderHash(projectRoot, row) !== initialLoaderHash) fail(`loader changed during capture: ${capture.key}`);
    const path = containedPath(assetRoot, `.${capture.src}`, true);
    // A missing root replaced by a symlink during the browser await must still reject.
    containedPath(assetRoot, `.${capture.src}`);
    writeFileSync(path, image, { flag: "w" });
    receipts.push({ key: capture.key, fixture: { ...capture.fixture }, src: capture.src, ...dimensions,
      imageSha256: hash(image), loaderSha256: initialLoaderHash, sourceSha256: hash(row.source.code),
      runtime: { ...runtime }, stability: "runtime.whenStable" });
  }
  validateResolvedCatalogAssets({ ...options, captures: receipts }, projectRoot, assetRoot);
  return receipts;
}
