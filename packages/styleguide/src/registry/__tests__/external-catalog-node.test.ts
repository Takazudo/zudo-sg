// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync, lstatSync, realpathSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join, resolve } from "node:path";
import { absoluteComponents } from "../catalog-path.js";
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
function pageDouble(): ExternalCapturePage {
  const identity = { slug: "button", variant: "Default", sessionId: "standalone-session", documentId: "actual-document", generation: 0 };
  return { goto: vi.fn(async () => {}), setViewportSize: vi.fn(async () => {}),
    whenStable: vi.fn(async () => ({ ...identity })), getSnapshot: vi.fn(async () => ({ identity: { ...identity }, ready: true, error: null })),
    screenshot: vi.fn(async () => png()) };
}
function optionsFor(projectRoot: string, assetRoot: string, page = pageDouble()) {
  return { manifest: [row()], projectRoot, assetRoot, origin: "http://127.0.0.1:4700", base: "/styleguide/", previewUrl: "/frame/", page };
}
/** Real directory reached only through a sibling symlink. The symlink is an extra alias, not TMPDIR. */
function realUnderAlias() {
  const base = mkdtempSync(join(tmpdir(), "sg-alias-")); temporary.push(base);
  const physical = join(base, "physical"); const decoy = join(base, "decoy");
  mkdirSync(physical); mkdirSync(decoy);
  const alias = join(base, "alias"); symlinkSync(physical, alias);
  const projectRoot = join(alias, "project"); mkdirSync(projectRoot);
  writeFileSync(join(projectRoot, "fixture.tsx"), "export const Button = () => null;");
  return { physical, decoy, alias, projectRoot, canonicalProject: join(physical, "project") };
}
function imageRow(src: string) {
  const entry = row();
  if (entry.capture.kind !== "image") throw new Error("expected image capture");
  entry.capture.src = src;
  return entry;
}

describe("absolute catalog components", () => {
  it("walks a Windows drive and a UNC path through each real component", () => {
    const win = path.win32;
    expect(absoluteComponents("C:\\catalog\\captures\\button.png", win)).toEqual([
      "C:\\catalog",
      "C:\\catalog\\captures",
      "C:\\catalog\\captures\\button.png",
    ]);
    expect(absoluteComponents("\\\\server\\share\\catalog\\button.png", win)).toEqual([
      "\\\\server\\share\\catalog",
      "\\\\server\\share\\catalog\\button.png",
    ]);
  });
});

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
  it("captures and validates project and asset roots below a synthetic ancestor alias", async () => {
    const { projectRoot, canonicalProject, alias } = realUnderAlias();
    const assetRoot = join(alias, "project", "public"); mkdirSync(assetRoot);
    const receipts = await captureExternalCatalogImages(optionsFor(projectRoot, assetRoot));
    const written = join(canonicalProject, "public", "captures", "button.png");
    expect(existsSync(written)).toBe(true);
    expect(existsSync(join(assetRoot, "captures", "button.png"))).toBe(true);
    expect(() => validateExternalCatalogAssets({ manifest: [row()], projectRoot, assetRoot, captures: receipts })).not.toThrow();
  });
  it("creates a missing multi-level asset root only after a successful capture", async () => {
    const { projectRoot, canonicalProject, alias } = realUnderAlias();
    const assetRoot = join(alias, "project", "a", "b");
    const page = pageDouble();
    page.screenshot = async () => { expect(existsSync(join(canonicalProject, "a"))).toBe(false); return png(); };
    const receipts = await captureExternalCatalogImages(optionsFor(projectRoot, assetRoot, page));
    expect(existsSync(join(canonicalProject, "a", "b", "captures", "button.png"))).toBe(true);
    expect(() => validateExternalCatalogAssets({ manifest: [row()], projectRoot, assetRoot, captures: receipts })).not.toThrow();
  });
  it("resolves a missing asset root whose nearest ancestor is itself a symlink", async () => {
    const base = mkdtempSync(join(tmpdir(), "sg-alias-")); temporary.push(base);
    const physical = join(base, "physical"); mkdirSync(physical);
    const alias = join(base, "alias"); symlinkSync(physical, alias);
    const projectRoot = join(base, "project"); mkdirSync(projectRoot);
    writeFileSync(join(projectRoot, "fixture.tsx"), "export const Button = () => null;");
    const assetRoot = join(alias, "a", "b");
    const page = pageDouble();
    page.screenshot = async () => { expect(existsSync(join(physical, "a"))).toBe(false); return png(); };
    await captureExternalCatalogImages(optionsFor(projectRoot, assetRoot, page));
    expect(existsSync(join(physical, "a", "b", "captures", "button.png"))).toBe(true);
  });
  it("leaves a missing output tree absent when stability or the screenshot fails", async () => {
    for (const field of ["whenStable", "screenshot"] as const) {
      const { projectRoot, canonicalProject, alias } = realUnderAlias();
      const assetRoot = join(alias, "project", "a", "b");
      const page = pageDouble(); page[field] = async () => { throw new Error("fixture failure"); };
      await expect(captureExternalCatalogImages(optionsFor(projectRoot, assetRoot, page))).rejects.toThrow("fixture failure");
      expect(existsSync(join(canonicalProject, "a"))).toBe(false);
    }
  });
  it("rejects a dangling symlink at the configured project or asset root", async () => {
    for (const mode of ["asset", "project"] as const) {
      const { options, page, projectRoot, assetRoot } = setup();
      const outside = mkdtempSync(join(tmpdir(), "sg-outside-")); temporary.push(outside);
      if (mode === "asset") { rmSync(assetRoot, { recursive: true }); symlinkSync(join(outside, "absent"), assetRoot); }
      else { rmSync(projectRoot, { recursive: true }); symlinkSync(join(outside, "absent"), projectRoot); }
      await expect(captureExternalCatalogImages(options)).rejects.toThrow(/symlink/);
      expect(page.goto).not.toHaveBeenCalled(); expect(existsSync(join(outside, "button.png"))).toBe(false);
    }
  });
  it("rejects a live symlink at the configured project root", async () => {
    const { options, page, projectRoot } = setup();
    const outside = mkdtempSync(join(tmpdir(), "sg-outside-")); temporary.push(outside);
    const relocated = join(outside, "project"); mkdirSync(relocated);
    writeFileSync(join(relocated, "fixture.tsx"), "export const Button = () => null;");
    rmSync(projectRoot, { recursive: true }); symlinkSync(relocated, projectRoot);
    await expect(captureExternalCatalogImages(options)).rejects.toThrow(/symlink/);
    expect(page.goto).not.toHaveBeenCalled(); expect(existsSync(join(relocated, "captures"))).toBe(false);
  });
  it("rejects descendant symlinks that point back inside the catalog root", async () => {
    for (const mode of ["directory", "file", "loader"] as const) {
      const { options, page, projectRoot, assetRoot } = setup();
      if (mode === "directory") { const inside = join(assetRoot, "inside"); mkdirSync(inside); symlinkSync(inside, join(assetRoot, "captures")); }
      if (mode === "file") {
        mkdirSync(join(assetRoot, "captures")); const inside = join(assetRoot, "inside.png"); writeFileSync(inside, png());
        symlinkSync(inside, join(assetRoot, "captures", "button.png"));
      }
      if (mode === "loader") {
        const inside = join(projectRoot, "inside.tsx"); writeFileSync(inside, "export const Button = () => null;");
        rmSync(join(projectRoot, "fixture.tsx")); symlinkSync(inside, join(projectRoot, "fixture.tsx"));
      }
      await expect(captureExternalCatalogImages(options)).rejects.toThrow(/symlink/);
      expect(page.goto).not.toHaveBeenCalled(); expect(existsSync(join(assetRoot, "inside", "button.png"))).toBe(false);
    }
  });
  it("does not create a missing asset root when independent validation fails", () => {
    const { options, projectRoot } = setup();
    const assetRoot = join(projectRoot, "missing", "deeper");
    expect(() => validateExternalCatalogAssets({ manifest: options.manifest, projectRoot, assetRoot, captures: [] })).toThrow(/key mismatch/);
    expect(existsSync(join(projectRoot, "missing"))).toBe(false);
  });
  it("rejects a symlinked promised image during validation without following it", async () => {
    const { options, assetRoot } = setup();
    const receipts = await captureExternalCatalogImages(options);
    const image = join(assetRoot, "captures", "button.png"); const inside = join(assetRoot, "inside.png");
    writeFileSync(inside, png()); const before = readFileSync(inside);
    rmSync(image); symlinkSync(inside, image);
    expect(() => validateExternalCatalogAssets({ ...options, captures: receipts })).toThrow(/symlink/);
    expect(readFileSync(inside).equals(before)).toBe(true);
  });
  it("rejects a prefix-looking sibling path and does not create that sibling", async () => {
    const { options, page, assetRoot } = setup();
    options.manifest = [imageRow("/../public-other/file.png")];
    await expect(captureExternalCatalogImages(options)).rejects.toThrow(/asset path/);
    expect(page.goto).not.toHaveBeenCalled(); expect(existsSync(resolve(assetRoot, "../public-other"))).toBe(false);
  });
  it("writes a legitimate ..safe directory name without treating it as a parent segment", async () => {
    const { options, assetRoot, projectRoot } = setup();
    options.manifest = [imageRow("/..safe/file.png")];
    const receipts = await captureExternalCatalogImages(options);
    expect(existsSync(join(assetRoot, "..safe", "file.png"))).toBe(true);
    expect(existsSync(join(projectRoot, "file.png"))).toBe(false);
    expect(() => validateExternalCatalogAssets({ ...options, captures: receipts })).not.toThrow();
  });
  it("keeps the original canonical destination when an ancestor alias is retargeted during capture", async () => {
    const { projectRoot, canonicalProject, alias, decoy } = realUnderAlias();
    const assetRoot = join(alias, "project", "public"); mkdirSync(assetRoot);
    mkdirSync(join(decoy, "project", "public"), { recursive: true });
    writeFileSync(join(decoy, "project", "fixture.tsx"), "export const Button = () => null;");
    const page = pageDouble();
    page.screenshot = async () => { unlinkSync(alias); symlinkSync(decoy, alias); return png(); };
    const receipts = await captureExternalCatalogImages(optionsFor(projectRoot, assetRoot, page));
    expect(existsSync(join(canonicalProject, "public", "captures", "button.png"))).toBe(true);
    expect(existsSync(join(decoy, "project", "public", "captures", "button.png"))).toBe(false);
    expect(() => validateExternalCatalogAssets({ manifest: [row()], projectRoot, assetRoot, captures: receipts })).toThrow(/promised image is missing/);
  });
  it("rejects a missing asset root replaced by a symlink during capture and does not write through it", async () => {
    const { projectRoot, canonicalProject } = realUnderAlias();
    const outside = mkdtempSync(join(tmpdir(), "sg-outside-")); temporary.push(outside);
    const canonicalRoot = join(canonicalProject, "public");
    const page = pageDouble();
    page.screenshot = async () => { symlinkSync(outside, canonicalRoot); return png(); };
    await expect(captureExternalCatalogImages(optionsFor(projectRoot, join(projectRoot, "public"), page))).rejects.toThrow(/symlink/);
    expect(existsSync(join(outside, "captures"))).toBe(false); expect(existsSync(join(outside, "button.png"))).toBe(false);
    expect(lstatSync(canonicalRoot).isSymbolicLink()).toBe(true);
  });
  it("rejects a dangling ancestor above a missing catalog root without creating it", async () => {
    const base = mkdtempSync(join(tmpdir(), "sg-dangle-")); temporary.push(base);
    const link = join(base, "dangling"); symlinkSync(join(base, "missing-target"), link);
    const projectRoot = join(link, "project"); const page = pageDouble();
    await expect(captureExternalCatalogImages(optionsFor(projectRoot, join(projectRoot, "public"), page))).rejects.toThrow(/symlink/);
    expect(page.goto).not.toHaveBeenCalled(); expect(existsSync(projectRoot)).toBe(false);
  });
  // macOS /var and /tmp alias /private. This observes that native alias; the synthetic tests above are the portable regression.
  it("captures under the process temporary directory, including a native ancestor alias", async () => {
    if (process.platform === "darwin") {
      expect(lstatSync("/var").isSymbolicLink()).toBe(true);
      expect(realpathSync(tmpdir())).not.toBe(resolve(tmpdir()));
    }
    const { options, assetRoot } = setup();
    await captureExternalCatalogImages(options);
    expect(existsSync(join(assetRoot, "captures", "button.png"))).toBe(true);
    expect(realpathSync(assetRoot).startsWith(realpathSync(tmpdir()))).toBe(true);
  });
});
