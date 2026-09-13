import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompilePreviewCssResult } from "../../preview-css/compile.js";
import { toForwardSlash } from "../../host-paths.js";
import previewCssPlugin, {
  DEFAULT_PREVIEW_CSS_URL,
  PLUGIN_NAME,
  createPreviewCssCache,
  createPreviewCssHandler,
  createPreviewCssPlugin,
  previewCssOutputPath,
  previewCssRoute,
  resolvePreviewCssPluginOptions,
  writePreviewCss,
} from "../preview-css.js";

type DevCtx = Parameters<NonNullable<typeof previewCssPlugin.devMiddleware>>[0];
type BuildCtx = Parameters<NonNullable<typeof previewCssPlugin.postBuild>>[0];
type Handler = Parameters<DevCtx["register"]>[1];

let root: string;
let entry: string;
let dep: string;
let sourceFile: string;

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** Sets an mtime `offsetSec` seconds in the past (or future, when positive). */
function touch(path: string, offsetSec: number) {
  const time = new Date(Date.now() + offsetSec * 1000);
  utimesSync(path, time, time);
}

function fakeCompiler(css: () => string = () => "a{}") {
  return vi.fn(
    async (): Promise<CompilePreviewCssResult> => ({
      css: css(),
      dependencies: [toForwardSlash(entry), toForwardSlash(dep)],
      sourceFiles: [toForwardSlash(sourceFile)],
      candidateCount: 1,
    }),
  );
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "zudo-sg-preview-css-"));
  mkdirSync(join(root, "src/styles"), { recursive: true });
  mkdirSync(join(root, "components"), { recursive: true });
  entry = join(root, "src/styles/preview-entry.css");
  dep = join(root, "src/styles/tokens.css");
  sourceFile = join(root, "components/button.tsx");
  writeFileSync(entry, '@import "./tokens.css";\n');
  writeFileSync(dep, ":root { --a: 1; }\n");
  writeFileSync(sourceFile, "export const x = 'bg-accent';\n");
  // Every input (and its directory) starts safely in the past so the
  // "edited during compile" guard does not fire.
  for (const path of [entry, dep, sourceFile, join(root, "src/styles"), join(root, "components")]) touch(path, -60);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("resolvePreviewCssPluginOptions", () => {
  it("resolves previewStyles and defaults previewCssUrl", () => {
    expect(resolvePreviewCssPluginOptions(root, { previewStyles: "./src/styles/preview-entry.css" })).toEqual({
      previewStyles: toForwardSlash(entry),
      previewCssUrl: "/_zudo-sg/preview.css",
    });
    expect(DEFAULT_PREVIEW_CSS_URL).toBe("/_zudo-sg/preview.css");
  });

  it("fails fast naming the option and path", () => {
    expect(() => resolvePreviewCssPluginOptions(root, {})).toThrow(/option "previewStyles" is required/);
    expect(() => resolvePreviewCssPluginOptions(root, { previewStyles: "./nope.css" })).toThrow(
      /option "previewStyles" = "\.\/nope\.css" resolved to .*nope\.css .* which is not a file/,
    );
    expect(() => resolvePreviewCssPluginOptions(root, { previewStyles: entry, previewCssUrl: "x.css" })).toThrow(
      /previewCssUrl/,
    );
    expect(() => resolvePreviewCssPluginOptions(root, { previewStyles: entry, previewCssUrl: "/a/../b.css" })).toThrow(
      /previewCssUrl/,
    );
    expect(() => resolvePreviewCssPluginOptions(root, { previewStyles: entry, bogus: 1 })).toThrow(/unknown option "bogus"/);
  });

  it("setup throws on a missing entry", () => {
    const ctx = { command: "build", projectRoot: root, config: {}, options: { previewStyles: "./missing.css" } };
    expect(() => previewCssPlugin.setup?.(ctx as never)).toThrow(/previewStyles/);
  });
});

describe("registered URL respects base", () => {
  it("computes the full route", () => {
    expect(previewCssRoute("/", DEFAULT_PREVIEW_CSS_URL)).toBe("/_zudo-sg/preview.css");
    expect(previewCssRoute(undefined, DEFAULT_PREVIEW_CSS_URL)).toBe("/_zudo-sg/preview.css");
    expect(previewCssRoute("/spike/", DEFAULT_PREVIEW_CSS_URL)).toBe("/spike/_zudo-sg/preview.css");
  });

  for (const [hook, base, expected] of [
    ["devMiddleware", "/", "/_zudo-sg/preview.css"],
    ["devMiddleware", "/spike/", "/spike/_zudo-sg/preview.css"],
    ["previewMiddleware", "/", "/_zudo-sg/preview.css"],
    ["previewMiddleware", "/spike/", "/spike/_zudo-sg/preview.css"],
  ] as const) {
    it(`${hook} registers ${expected} for base ${base}`, async () => {
      const compile = fakeCompiler(() => ".served{}");
      const plugin = createPreviewCssPlugin({ compile });
      const registered = new Map<string, Handler>();
      await plugin[hook]?.({
        projectRoot: root,
        config: { base } as DevCtx["config"],
        options: { previewStyles: "./src/styles/preview-entry.css" },
        logger: makeLogger(),
        register: (path, handler) => registered.set(path, handler),
      });
      expect([...registered.keys()]).toEqual([expected]);

      const handler = registered.get(expected)!;
      const res = await handler({ method: "GET", url: `${expected}?v=1`, headers: {} });
      expect(res).toMatchObject({
        status: 200,
        headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" },
        body: ".served{}",
      });
      if (base !== "/") {
        expect(await handler({ method: "GET", url: "/_zudo-sg/preview.css", headers: {} })).toBeUndefined();
      }
    });
  }
});

describe("createPreviewCssHandler", () => {
  it("falls through for other paths and rejects non-GET methods", async () => {
    const handler = createPreviewCssHandler({
      route: "/_zudo-sg/preview.css",
      cache: { get: async () => "a{}" },
    });
    expect(await handler({ method: "GET", url: "/_zudo-sg/preview.cssx", headers: {} })).toBeUndefined();
    expect(await handler({ method: "POST", url: "/_zudo-sg/preview.css", headers: {} })).toMatchObject({ status: 405 });
    expect(await handler({ method: "HEAD", url: "/_zudo-sg/preview.css", headers: {} })).toMatchObject({
      status: 200,
      body: "",
    });
  });

  it("answers 500 and logs when the compile fails", async () => {
    const logger = makeLogger();
    const handler = createPreviewCssHandler({
      route: "/p.css",
      cache: { get: async () => Promise.reject(new Error("boom")) },
      logger,
    });
    expect(await handler({ method: "GET", url: "/p.css", headers: {} })).toMatchObject({ status: 500 });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });
});

describe("createPreviewCssCache", () => {
  it("serves the cache while dependencies are unchanged", async () => {
    const compile = fakeCompiler();
    const cache = createPreviewCssCache(entry, compile);
    await cache.get();
    await cache.get();
    await cache.get();
    expect(compile).toHaveBeenCalledTimes(1);
  });

  it("recompiles when an @import dependency mtime changes", async () => {
    let version = 1;
    const compile = fakeCompiler(() => `v${version}`);
    const cache = createPreviewCssCache(entry, compile);
    expect(await cache.get()).toBe("v1");
    version = 2;
    touch(dep, -30);
    expect(await cache.get()).toBe("v2");
    expect(compile).toHaveBeenCalledTimes(2);
    expect(await cache.get()).toBe("v2");
    expect(compile).toHaveBeenCalledTimes(2);
  });

  it("recompiles when a scanned source file changes or disappears", async () => {
    const compile = fakeCompiler();
    const cache = createPreviewCssCache(entry, compile);
    await cache.get();
    touch(sourceFile, -30);
    await cache.get();
    expect(compile).toHaveBeenCalledTimes(2);
    rmSync(sourceFile);
    await cache.get();
    expect(compile).toHaveBeenCalledTimes(3);
  });

  it("recompiles when a scanned directory gains a file", async () => {
    const compile = fakeCompiler();
    const cache = createPreviewCssCache(entry, compile);
    await cache.get();
    writeFileSync(join(root, "components/card.tsx"), "export const y = 'p-hsp-md';\n");
    touch(join(root, "components"), -30);
    await cache.get();
    expect(compile).toHaveBeenCalledTimes(2);
  });

  it("dedupes concurrent requests into one compile", async () => {
    const compile = fakeCompiler();
    const cache = createPreviewCssCache(entry, compile);
    await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(compile).toHaveBeenCalledTimes(1);
  });

  it("does not trust a compile whose inputs changed while it ran", async () => {
    const compile = vi.fn(async (): Promise<CompilePreviewCssResult> => {
      touch(dep, 1);
      return { css: "a{}", dependencies: [toForwardSlash(dep)], sourceFiles: [], candidateCount: 0 };
    });
    const cache = createPreviewCssCache(entry, compile);
    await cache.get();
    await cache.get();
    expect(compile).toHaveBeenCalledTimes(2);
  });

  it("retries after a failed compile", async () => {
    let fail = true;
    const compile = vi.fn(async (): Promise<CompilePreviewCssResult> => {
      if (fail) throw new Error("syntax");
      return { css: "ok{}", dependencies: [toForwardSlash(entry)], sourceFiles: [], candidateCount: 0 };
    });
    const cache = createPreviewCssCache(entry, compile);
    await expect(cache.get()).rejects.toThrow("syntax");
    fail = false;
    expect(await cache.get()).toBe("ok{}");
  });
});

describe("build emit", () => {
  it("writes <outDir><previewCssUrl> without the base segment", async () => {
    const outDir = join(root, "dist");
    const plugin = createPreviewCssPlugin({ compile: fakeCompiler(() => ".built{}") });
    const logger = makeLogger();
    await plugin.postBuild?.({
      projectRoot: root,
      outDir,
      config: { base: "/spike/" } as BuildCtx["config"],
      options: { previewStyles: "./src/styles/preview-entry.css" },
      logger,
    });
    expect(readFileSync(join(outDir, "_zudo-sg/preview.css"), "utf8")).toBe(".built{}");
    expect(existsSync(join(outDir, "spike"))).toBe(false);
    expect(previewCssOutputPath(outDir, "/_zudo-sg/preview.css")).toBe(join(outDir, "_zudo-sg", "preview.css"));
  });

  it("removes the stale file on rebuild, even when the compile fails", async () => {
    const outDir = join(root, "dist");
    const target = join(outDir, "_zudo-sg/preview.css");
    mkdirSync(join(outDir, "_zudo-sg"), { recursive: true });
    writeFileSync(target, ".stale{}");

    const ctx = {
      projectRoot: root,
      outDir,
      config: { base: "/" } as BuildCtx["config"],
      options: { previewStyles: "./src/styles/preview-entry.css" },
      logger: makeLogger(),
    };
    await createPreviewCssPlugin({ compile: fakeCompiler(() => ".fresh{}") }).postBuild?.(ctx);
    expect(readFileSync(target, "utf8")).toBe(".fresh{}");

    writeFileSync(target, ".stale{}");
    const failing = createPreviewCssPlugin({ compile: async () => Promise.reject(new Error("broken entry")) });
    await expect(failing.postBuild?.(ctx)).rejects.toThrow("broken entry");
    expect(existsSync(target)).toBe(false);
  });

  it("concurrent writes leave one complete file and no temp files", async () => {
    const outDir = join(root, "dist");
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => writePreviewCss(outDir, "/_zudo-sg/preview.css", `.w${i}{}`.repeat(1000))),
    );
    const files = readdirSync(join(outDir, "_zudo-sg"));
    expect(files).toEqual(["preview.css"]);
    expect(readFileSync(join(outDir, "_zudo-sg/preview.css"), "utf8")).toMatch(/^(\.w\d\{\})+$/);
  });

  it("is exported under the documented name", () => {
    expect(previewCssPlugin.name).toBe(PLUGIN_NAME);
    expect(PLUGIN_NAME).toBe("@takazudo/zudo-sg/plugins/preview-css");
  });
});

describe("real compiler end-to-end (temp host)", () => {
  it("serves compiled css and picks up an @import edit", async () => {
    writeFileSync(entry, '@import "./tokens.css";\n.x { color: var(--a); }\n');
    touch(entry, -60);
    const plugin = createPreviewCssPlugin();
    const registered = new Map<string, Handler>();
    await plugin.devMiddleware?.({
      projectRoot: root,
      config: { base: "/" } as DevCtx["config"],
      options: { previewStyles: "./src/styles/preview-entry.css" },
      logger: makeLogger(),
      register: (path, handler) => registered.set(path, handler),
    });
    const handler = registered.get("/_zudo-sg/preview.css")!;
    const first = await handler({ method: "GET", url: "/_zudo-sg/preview.css", headers: {} });
    expect(first?.body).toContain("--a:1");
    expect(first?.body).toContain(":root[data-sg-preview-doc]");

    writeFileSync(dep, ":root { --a: 2; }\n");
    touch(dep, -30);
    const second = await handler({ method: "GET", url: "/_zudo-sg/preview.css", headers: {} });
    expect(second?.body).toContain("--a:2");
  });
});
