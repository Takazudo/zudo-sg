/**
 * Guard (#194): root settings warn at module load when siteUrl is falsy,
 * since a missing siteUrl silently drops OGP absolute image URLs and
 * canonical link tags from build output.
 *
 * This exercises the real production configuration rather than a stand-in:
 * root settings.ts: siteUrl is "" today → the warning must fire.
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
  it("fires when siteUrl is empty (root settings.ts)", async () => {
    const { settings } = await import("../settings");

    expect(settings.siteUrl).toBe("");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/siteUrl/i);
  });
});
