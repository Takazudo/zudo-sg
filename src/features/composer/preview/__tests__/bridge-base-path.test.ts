// The NON-ROOT base-path proof.
//
// `withBase` reads `settings.base` / `settings.trailingSlash` at module load, so
// each case re-mocks `@/config/settings` and re-imports the bridge through a
// fresh module graph. That exercises the REAL `withBase` (not a re-implementation
// of it) against a site served from a subdirectory — the deployment where an
// iframe `src` of `/composer/preview` would 404 and a wildcard `postMessage`
// would be the tempting "fix".

import { afterEach, describe, expect, it, vi } from "vitest";

interface SettingsOverrides {
  base?: string;
  trailingSlash?: boolean;
}

/** Re-import the bridge with only `base`/`trailingSlash` swapped; the rest of
 *  the real settings (locales, prefixes, …) stay intact. */
async function bridgeWithSettings(overrides: SettingsOverrides) {
  vi.resetModules();
  vi.doMock("@/config/settings", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/config/settings")>();
    return { ...actual, settings: { ...actual.settings, ...overrides } };
  });
  return import("../bridge");
}

afterEach(() => {
  vi.doUnmock("@/config/settings");
  vi.resetModules();
});

const ORIGIN = "https://docs.example.com";

describe("buildComposerPreviewUrl — non-root base path", () => {
  it("prefixes the configured base", async () => {
    const { buildComposerPreviewUrl } = await bridgeWithSettings({ base: "/zudo-sg/" });
    const location = buildComposerPreviewUrl(ORIGIN);
    expect(location.src).toBe("/zudo-sg/composer/preview");
    expect(location.targetOrigin).toBe(ORIGIN);
  });

  it("honours trailingSlash under a non-root base", async () => {
    const { buildComposerPreviewUrl } = await bridgeWithSettings({
      base: "/zudo-sg/",
      trailingSlash: true,
    });
    expect(buildComposerPreviewUrl(ORIGIN).src).toBe("/zudo-sg/composer/preview/");
  });

  it("honours trailingSlash under the root base", async () => {
    const { buildComposerPreviewUrl } = await bridgeWithSettings({
      base: "/",
      trailingSlash: true,
    });
    expect(buildComposerPreviewUrl(ORIGIN).src).toBe("/composer/preview/");
  });

  it("handles a base written without a trailing slash", async () => {
    const { buildComposerPreviewUrl } = await bridgeWithSettings({ base: "/zudo-sg" });
    expect(buildComposerPreviewUrl(ORIGIN).src).toBe("/zudo-sg/composer/preview");
  });

  it("handles a nested base", async () => {
    const { buildComposerPreviewUrl } = await bridgeWithSettings({
      base: "/team/zudo-sg/",
      trailingSlash: true,
    });
    expect(buildComposerPreviewUrl(ORIGIN).src).toBe("/team/zudo-sg/composer/preview/");
  });

  it("derives the EXACT target origin from the resolved URL — never '*'", async () => {
    const { buildComposerPreviewUrl } = await bridgeWithSettings({
      base: "/zudo-sg/",
      trailingSlash: true,
    });
    for (const origin of [ORIGIN, "http://localhost:4321", "https://preview.pages.dev"]) {
      const location = buildComposerPreviewUrl(origin);
      expect(location.targetOrigin).toBe(origin);
      expect(location.targetOrigin).not.toBe("*");
      // The origin must come off the resolved URL, so it never carries the path.
      expect(new URL(location.src, origin).origin).toBe(location.targetOrigin);
    }
  });

  it("the frame props carry the base-prefixed src", async () => {
    const { buildComposerPreviewUrl, composerPreviewFrameProps } = await bridgeWithSettings({
      base: "/zudo-sg/",
    });
    const props = composerPreviewFrameProps(buildComposerPreviewUrl(ORIGIN));
    expect(props.src).toBe("/zudo-sg/composer/preview");
    expect(props.title).not.toBe("");
  });
});
