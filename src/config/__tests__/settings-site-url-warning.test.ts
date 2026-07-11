/**
 * Guard (#194): both settings.ts modules (root + doc/) warn at module load
 * when siteUrl is falsy, since a missing siteUrl silently drops OGP absolute
 * image URLs and canonical link tags from build output.
 *
 * This exercises the REAL production modules rather than a stand-in, using
 * each workspace's actual current siteUrl:
 *   - root settings.ts: siteUrl is "" today → the warning must fire.
 *   - doc/ settings.ts: siteUrl is set today → the warning must stay silent
 *     (the guard exists there too, but is inert while siteUrl is set).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Each settings.ts module runs its warn check once at module-evaluation
  // time, so a fresh module instance is needed per test to observe it.
  vi.resetModules();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("settings siteUrl build warning", () => {
  it("fires when siteUrl is empty (root settings.ts)", async () => {
    const { settings } = await import("../settings");

    expect(settings.siteUrl).toBe("");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/siteUrl/i);
  });

  it("does not fire when siteUrl is set (doc/ settings.ts)", async () => {
    const { settings } = await import("../../../doc/src/config/settings");

    expect(settings.siteUrl).toBe("https://zudo-sg-doc.takazudomodular.com");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
