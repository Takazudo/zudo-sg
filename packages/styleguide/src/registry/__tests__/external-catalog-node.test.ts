// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { externalCatalogKey, type ExternalCatalogEntry } from "../external-catalog.js";
import { captureExternalCatalogImages, thumbnailFromExternalCapture, validateExternalCatalogAssets, validateExternalCatalogOutputs,
  type ExternalCapturePage, type ExternalCaptureReceipt } from "../external-catalog-node.js";

const key = externalCatalogKey("button", "Default");
function row(): ExternalCatalogEntry {
  return { slug: "button", variant: "Default", loader: { key, module: "./fixture.tsx", exportName: "Button" },
    source: { key, code: '<Button title="</script>" />' },
    capture: { kind: "image", key, fixture: { module: "./fixture.tsx", exportName: "Button" }, src: "/captures/button.png", width: 2, height: 1 } };
}
function outputs(entry = row()) {
  return { manifest: [entry], loaders: [entry.loader], sources: [entry.source], descriptors: [{
    id: "button", slug: "button", title: "Button", category: "Actions",
    variants: [{ exportName: "Default", name: "Default", source: { ...entry.source } }], thumbnail: thumbnailFromExternalCapture(entry.capture),
  }] };
}
// Small synthetic PNGs are validator fixtures only, never catalog artwork.
function png(width = 2, height = 1): Buffer {
  function chunk(type: string, payload: Buffer) {
    const out = Buffer.alloc(payload.length + 12); out.writeUInt32BE(payload.length); out.write(type, 4); payload.copy(out, 8);
    let crc = 0xffffffff;
    for (const byte of out.subarray(4, -4)) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4); return out;
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.alloc((width * 4 + 1) * height))), chunk("IEND", Buffer.alloc(0))]);
}
const temporary: string[] = [];
afterEach(() => { for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function setup() {
  const projectRoot = mkdtempSync(join(tmpdir(), "sg-capture-")); temporary.push(projectRoot);
  const assetRoot = join(projectRoot, "public"); mkdirSync(assetRoot); writeFileSync(join(projectRoot, "fixture.tsx"), "export const Button = () => null;");
  const identity = { slug: "button", variant: "Default", sessionId: "standalone-session", documentId: "actual-document", generation: 0 };
  const page: ExternalCapturePage = { goto: vi.fn(async () => {}), setViewportSize: vi.fn(async () => {}),
    whenStable: vi.fn(async () => ({ ...identity })), getSnapshot: vi.fn(async () => ({ identity: { ...identity }, ready: true, error: null })),
    screenshot: vi.fn(async () => png()) };
  const options = { manifest: [row()], projectRoot, assetRoot, origin: "http://127.0.0.1:4700", base: "/styleguide/", previewUrl: "/frame/", page };
  return { options, page, identity, projectRoot, assetRoot };
}

describe("generated external catalog agreement", () => {
  it("compares real descriptor/source/loader outputs and first-variant catalog thumbnail", () => {
    expect(validateExternalCatalogOutputs(outputs())).toEqual([row()]);
  });
  it.each(["loaders", "sources"] as const)("rejects missing, extra and duplicate %s keys", (field) => {
    for (const change of ["missing", "extra", "duplicate"]) {
      const data = outputs();
      if (change === "missing") data[field] = [];
      else data[field].push({ ...data[field][0]!, key: change === "extra" ? "extra" : key } as never);
      expect(() => validateExternalCatalogOutputs(data)).toThrow(/key/);
    }
  });
  it("rejects mismatched source text, loader refs, descriptor variants and thumbnails", () => {
    const source = outputs(); source.sources = [{ key, code: "stale" }];
    expect(() => validateExternalCatalogOutputs(source)).toThrow(/source/);
    const loader = outputs(); loader.loaders = [{ ...loader.loaders[0]!, exportName: "Other" }];
    expect(() => validateExternalCatalogOutputs(loader)).toThrow(/loader differs/);
    const descriptor = outputs(); descriptor.descriptors[0]!.variants.push({ exportName: "Extra", name: "Extra", source: { key: externalCatalogKey("button", "Extra"), code: "extra" } });
    expect(() => validateExternalCatalogOutputs(descriptor)).toThrow(/descriptors key mismatch/);
    const thumbnail = outputs(); thumbnail.descriptors[0]!.thumbnail = { kind: "placeholder", note: "not the promised image" };
    expect(() => validateExternalCatalogOutputs(thumbnail)).toThrow(/thumbnail differs/);
  });
  it("allows deliberate placeholders and fails explicit failed captures", () => {
    const entry = row(); entry.capture = { kind: "placeholder", key, note: "Intentionally no screenshot" };
    expect(validateExternalCatalogOutputs(outputs(entry))).toEqual([entry]);
    expect(() => thumbnailFromExternalCapture({ kind: "failed", key, note: "runtime crashed" })).toThrow(/capture failed.*runtime crashed/);
  });
  it("rejects a PNG promise under another format's emitted path", () => {
    const entry = row(); if (entry.capture.kind === "image") entry.capture.src = "/captures/button.svg";
    expect(() => validateExternalCatalogOutputs({ ...outputs(), manifest: [entry] })).toThrow(/\.png/);
  });
});

describe("runtime capture and emitted asset validation", () => {
  it("waits for the controller, binds identity/hashes, supports non-root URLs and validates copied build output", async () => {
    const { options, page, identity, projectRoot } = setup();
    const receipts = await captureExternalCatalogImages(options);
    expect(page.goto).toHaveBeenCalledWith("http://127.0.0.1:4700/styleguide/frame/?slug=button&variant=Default");
    expect(page.setViewportSize).toHaveBeenCalledWith({ width: 2, height: 1 });
    expect(page.whenStable).toHaveBeenCalledOnce(); expect(page.getSnapshot).toHaveBeenCalledTimes(2);
    expect(receipts[0]?.runtime).toEqual(identity);
    const dist = join(projectRoot, "dist/styleguide"); mkdirSync(join(dist, "captures"), { recursive: true });
    writeFileSync(join(dist, "captures/button.png"), readFileSync(join(options.assetRoot, "captures/button.png")));
    expect(() => validateExternalCatalogAssets({ ...options, assetRoot: dist, captures: receipts })).not.toThrow();
    expect(() => validateExternalCatalogAssets({ ...options, assetRoot: join(projectRoot, "dist"), captures: receipts })).toThrow(/promised image is missing/);
  });
  it("keeps root URLs unprefixed and emits no images for explicit placeholders", async () => {
    const { options, page } = setup(); options.base = "/";
    await captureExternalCatalogImages(options);
    expect(page.goto).toHaveBeenCalledWith("http://127.0.0.1:4700/frame/?slug=button&variant=Default");
    options.manifest[0]!.capture = { kind: "placeholder", key, note: "intentional" };
    expect(await captureExternalCatalogImages(options)).toEqual([]);
  });
  it("rejects a wrong/stale/error runtime, including changes during the screenshot", async () => {
    for (const mode of ["wrong", "error", "changed"]) {
      const { options, page, identity, assetRoot } = setup(); let reads = 0;
      page.getSnapshot = async () => ({ identity: { ...identity, generation: mode === "changed" ? reads++ : 0, slug: mode === "wrong" ? "other" : "button" },
        ready: true, error: mode === "error" ? { code: "render", message: "crash", recoverable: true } : null });
      await expect(captureExternalCatalogImages(options)).rejects.toThrow(/runtime changed or failed/);
      expect(existsSync(join(assetRoot, "captures/button.png"))).toBe(false);
    }
  });
  it("propagates failed stability and screenshot promises without successful output", async () => {
    for (const field of ["whenStable", "screenshot"] as const) {
      const { options, page, assetRoot } = setup(); page[field] = async () => { throw new Error("fixture failure"); };
      await expect(captureExternalCatalogImages(options)).rejects.toThrow("fixture failure");
      expect(existsSync(join(assetRoot, "captures/button.png"))).toBe(false);
    }
  });
  it("rejects malformed, truncated, bad-checksum and wrong-size screenshots", async () => {
    const corrupt = png(); corrupt[40] = corrupt[40]! ^ 1;
    for (const image of [Buffer.from("not png"), png().subarray(0, 24), corrupt, png(3, 1)]) {
      const { options, page } = setup(); page.screenshot = async () => image;
      await expect(captureExternalCatalogImages(options)).rejects.toThrow(/PNG|dimensions/);
    }
  });
  it("rejects checksummed invalid chunk names and unsupported critical chunks", async () => {
    for (const name of [Buffer.from([0xc9, 0x48, 0x44, 0x52]), Buffer.from("IHdR"), Buffer.from("ABCD")]) {
      const image = png(); name.copy(image, 12);
      let crc = 0xffffffff;
      for (const byte of image.subarray(12, 29)) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
      image.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 29);
      const { options, page, assetRoot } = setup(); page.screenshot = async () => image;
      await expect(captureExternalCatalogImages(options)).rejects.toThrow(/PNG.*chunk/);
      expect(existsSync(join(assetRoot, "captures/button.png"))).toBe(false);
    }
  });
  it("fails missing images, stale loader/source/receipt identity and missing/extra receipts", async () => {
    const { options, projectRoot, assetRoot } = setup(); const receipts = await captureExternalCatalogImages(options);
    const verify = (captures: ExternalCaptureReceipt[]) => validateExternalCatalogAssets({ ...options, captures });
    expect(() => verify([])).toThrow(/key mismatch/);
    expect(() => verify([...receipts, { ...receipts[0]!, key: "extra" }])).toThrow(/key mismatch/);
    expect(() => verify([{ ...receipts[0]!, sourceSha256: "stale" }])).toThrow(/receipt/);
    expect(() => verify([{ ...receipts[0]!, runtime: { ...receipts[0]!.runtime, variant: "Other" } }])).toThrow(/receipt/);
    writeFileSync(join(projectRoot, "fixture.tsx"), "changed"); expect(() => verify(receipts)).toThrow(/receipt/);
    writeFileSync(join(projectRoot, "fixture.tsx"), "export const Button = () => null;");
    writeFileSync(join(assetRoot, "captures/button.png"), png(3, 1)); expect(() => verify(receipts)).toThrow(/dimensions differ/);
    rmSync(join(assetRoot, "captures/button.png")); expect(() => verify(receipts)).toThrow(/promised image is missing/);
  });
  it("rejects missing loader files before opening a runtime", async () => {
    const { options, page, projectRoot } = setup(); rmSync(join(projectRoot, "fixture.tsx"));
    await expect(captureExternalCatalogImages(options)).rejects.toThrow(/loader module is missing/);
    expect(page.goto).not.toHaveBeenCalled();
  });
  it("rejects symlinked roots, parent directories, target files and loader modules before any write", async () => {
    for (const mode of ["root", "parent", "file", "loader"]) {
      const { options, page, projectRoot, assetRoot } = setup();
      const outside = mkdtempSync(join(tmpdir(), "sg-outside-")); temporary.push(outside);
      if (mode === "root") { rmSync(assetRoot, { recursive: true }); symlinkSync(outside, assetRoot); }
      if (mode === "parent") symlinkSync(outside, join(assetRoot, "captures"));
      if (mode === "file") { mkdirSync(join(assetRoot, "captures")); symlinkSync(join(outside, "image.png"), join(assetRoot, "captures/button.png")); }
      if (mode === "loader") { rmSync(join(projectRoot, "fixture.tsx")); symlinkSync(join(outside, "fixture.tsx"), join(projectRoot, "fixture.tsx")); }
      await expect(captureExternalCatalogImages(options)).rejects.toThrow(/symlink/);
      expect(page.goto).not.toHaveBeenCalled(); expect(existsSync(join(outside, "image.png"))).toBe(false);
      expect(existsSync(join(outside, "button.png"))).toBe(false);
    }
  });
});
