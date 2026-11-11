/**
 * Guard (#194): root settings warn at module load when siteUrl is falsy,
 * since a missing siteUrl silently drops OGP absolute image URLs and
 * canonical link tags from build output.
 *
 * This exercises the real production configuration rather than a stand-in.
 * #1063 sets the showcase origin so og:image is emitted; the warning stays
 * for a future empty value and must not fire while the origin is set.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Root settings.ts runs its warning check once at module-evaluation time,
  // so a fresh module instance is needed to observe it deterministically.
  vi.resetModules();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("siteUrl configuration", () => {
  it("uses the showcase origin and does not warn (root settings.ts)", async () => {
    const { settings } = await import("../settings");

    expect(settings.siteUrl).toBe("https://zudo-sg.takazudomodular.com");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
