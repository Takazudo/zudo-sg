import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DUMMY_IMAGE_CATEGORIES,
  DUMMY_IMAGE_MANIFEST,
  resolveDummyImage,
} from "../dummy-image";

const appRoot = resolve(process.cwd(), "apps/demo");
const contentRoot = `${appRoot}/content`;

function collectMdxImageSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return collectMdxImageSources(path);
    if (!entry.isFile() || (!entry.name.endsWith(".md") && !entry.name.endsWith(".mdx"))) return [];

    return Array.from(readFileSync(path, "utf8").matchAll(/!\[[^\]]*\]\(([^)]+)\)/g), (match) =>
      match[1] as string,
    );
  });
}

describe("dummy image manifest", () => {
  it("ships the complete local 16:10 catalog", () => {
    expect(DUMMY_IMAGE_CATEGORIES).toEqual([
      "corporate",
      "vacuum",
      "process",
      "laser",
      "meeting",
      "beauty",
      "sustainability",
    ]);

    for (const asset of Object.values(DUMMY_IMAGE_MANIFEST)) {
      expect(asset.width).toBe(1600);
      expect(asset.height).toBe(1000);
      expect(existsSync(`${appRoot}/public${asset.src}`)).toBe(true);
    }
  });

  it("resolves each local source category to its dedicated asset", () => {
    for (const asset of Object.values(DUMMY_IMAGE_MANIFEST)) {
      expect(resolveDummyImage(asset.src)).toEqual(asset);
    }
  });

  it("keeps every current MDX source local and uses corporate as the fallback", () => {
    const sources = collectMdxImageSources(contentRoot);

    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source).toMatch(/^\/images\/dummy\/(corporate|vacuum|process|laser|meeting|beauty|sustainability)\.webp$/);
      expect(resolveDummyImage(source)).toEqual(
        Object.values(DUMMY_IMAGE_MANIFEST).find((asset) => asset.src === source),
      );
    }

    expect(resolveDummyImage("/images/dummy/future-unmapped-image.webp")).toEqual(
      DUMMY_IMAGE_MANIFEST.corporate,
    );
    expect(resolveDummyImage(undefined)).toEqual(DUMMY_IMAGE_MANIFEST.corporate);
  });
});
