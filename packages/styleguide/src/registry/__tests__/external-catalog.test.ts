import { describe, expect, it } from "vitest";
import { externalCatalogKey, validateExternalCatalogManifest } from "../external-catalog.js";

function entry(variant = "Default") {
  const key = externalCatalogKey("editor", variant);
  const fixture = { module: "./preview/editor.tsx", exportName: "Editor" };
  return {
    slug: "editor", variant,
    loader: { key, ...fixture },
    source: { key, code: '<Editor label="Example" />' },
    capture: { kind: "image", key, fixture, src: `/captures/${variant}.png`, width: 320, height: 180 },
  };
}

describe("canonical external catalog manifest", () => {
  it("rejects sparse top-level manifests instead of silently skipping unvalidated rows", () => {
    expect(() => validateExternalCatalogManifest(new Array(1))).toThrow(/dense, serializable/);
    const sparse = [entry()];
    sparse.length = 2;
    expect(() => validateExternalCatalogManifest(sparse)).toThrow(/dense, serializable/);
  });
  it("normalizes independent copies without importing fixture modules", () => {
    const input = entry();
    const result = validateExternalCatalogManifest([{ ...input, extra: "dropped" }]);
    expect(result).toEqual([input]);
    expect(result[0]?.source).not.toBe(input.source);
    expect(result[0]?.capture).not.toBe(input.capture);
  });
  it("encodes stable keys without delimiter collisions", () => {
    expect(externalCatalogKey("one/two", "three")).not.toBe(externalCatalogKey("one", "two/three"));
    expect(externalCatalogKey("editor", "Default")).toBe('["editor","Default"]');
  });
  it.each(["placeholder", "failed"] as const)("accepts an explicitly labelled %s capture", (kind) => {
    const input = entry();
    expect(validateExternalCatalogManifest([{ ...input, capture: { kind, key: input.capture.key, note: "Capture deliberately unavailable" } }])[0]?.capture.kind).toBe(kind);
    expect(() => validateExternalCatalogManifest([{ ...input, capture: { kind, key: input.capture.key, note: "" } }])).toThrow(/labelled/);
  });
  it("rejects duplicate variants and capture asset owners", () => {
    expect(() => validateExternalCatalogManifest([entry(), entry()])).toThrow(/duplicate identity/);
    const other = entry("Other");
    other.capture.src = entry().capture.src;
    expect(() => validateExternalCatalogManifest([entry(), other])).toThrow(/multiple variants/);
  });
  it.each(["loader", "source", "capture"] as const)("rejects stale %s identity", (field) => {
    const input = entry();
    input[field].key = externalCatalogKey("editor", "Wrong");
    expect(() => validateExternalCatalogManifest([input])).toThrow(new RegExp(field));
  });
  it("rejects missing loader/source, fixture disagreement and nonserializable values", () => {
    expect(() => validateExternalCatalogManifest([{ ...entry(), loader: undefined }])).toThrow();
    expect(() => validateExternalCatalogManifest([{ ...entry(), source: null }])).toThrow(/source/);
    const input = entry();
    input.capture.fixture = { module: "./preview/other.tsx", exportName: "Editor" };
    expect(() => validateExternalCatalogManifest([input])).toThrow(/differs from loader/);
    expect(() => validateExternalCatalogManifest([{ ...entry(), callback() {} }])).toThrow(/serializable/);
  });
  it.each(["/../outside.png", "//other.test/a.png", "/thumbs/%2e%2e/a.png", "/thumbs/a.png?v=1", "/thumbs/a.png#x", "relative.png", "/", "/.", "/captures/.."])(
    "rejects a nonportable captured asset path %s", (src) => {
      const input = entry(); input.capture.src = src;
      expect(() => validateExternalCatalogManifest([input])).toThrow(/asset path/);
    },
  );
  it("accepts a file name that only begins with the parent-segment spelling", () => {
    const input = entry(); input.capture.src = "/..safe/file.png";
    expect(validateExternalCatalogManifest([input])[0]?.capture).toMatchObject({ src: "/..safe/file.png" });
  });
  it("rejects invalid dimensions and escaping loader paths", () => {
    for (const width of [0, -1, 2.5, Infinity]) {
      const input = entry(); input.capture.width = width;
      expect(() => validateExternalCatalogManifest([input])).toThrow();
    }
    for (const module of ["../outside.tsx", "./../outside.tsx", "/absolute.tsx", "./a/../../b.tsx"]) {
      const input = entry(); input.loader.module = module;
      expect(() => validateExternalCatalogManifest([input])).toThrow(/loader/);
    }
  });
});
