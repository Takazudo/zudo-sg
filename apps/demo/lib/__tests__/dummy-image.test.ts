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

    return Array.from(readFileSync(path, "utf8").matchAll(/!\[[^\]]*\]\((placeholder-[^)]+)\)/g), (match) =>
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

  it("resolves each known source category to its dedicated local asset", () => {
    expect(resolveDummyImage("placeholder-ceo.jpg").src).toBe("/images/dummy/corporate.webp");
    expect(resolveDummyImage("placeholder-vacuum-1.jpg").src).toBe("/images/dummy/vacuum.webp");
    expect(resolveDummyImage("placeholder-process-1.jpg").src).toBe("/images/dummy/process.webp");
    expect(resolveDummyImage("placeholder-laser-welding.jpg").src).toBe("/images/dummy/laser.webp");
    expect(resolveDummyImage("placeholder-meeting-1.jpg").src).toBe("/images/dummy/meeting.webp");
    expect(resolveDummyImage("placeholder-beauty-balance-lotion.jpg").src).toBe(
      "/images/dummy/beauty.webp",
    );
    expect(resolveDummyImage("placeholder-sustainability.jpg").src).toBe(
      "/images/dummy/sustainability.webp",
    );
  });

  it("maps every current MDX source to a shipped asset and uses corporate as the fallback", () => {
    const sources = collectMdxImageSources(contentRoot);

    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(Object.values(DUMMY_IMAGE_MANIFEST)).toContainEqual(resolveDummyImage(source));
    }

    expect(resolveDummyImage("future-unmapped-image.jpg")).toEqual(DUMMY_IMAGE_MANIFEST.corporate);
    expect(resolveDummyImage(undefined)).toEqual(DUMMY_IMAGE_MANIFEST.corporate);
  });
});
