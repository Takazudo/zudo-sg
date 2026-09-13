// zfb plugin module: @takazudo/zudo-sg/plugins/preview-css.
//
// Owns the lifecycle of the standalone preview stylesheet (ADR
// docs/adr/styleguide-engine.md decision 4); compilation itself lives in
// ../preview-css/compile.ts.
//
//   - setup:             resolves `previewStyles` through the host-path contract
//                        so a bad path fails the boot, not the first request.
//   - devMiddleware /    serve `${stripTrailingSlash(base)}${previewCssUrl}`
//     previewMiddleware: (zfb matches the FULL URL, base included), compiling
//                        lazily and recompiling when any compile input's mtime
//                        changed since the cached compile. zfb does not reuse a
//                        dev registration for preview, hence both hooks.
//   - postBuild:         writes `<outDir><previewCssUrl>` — NOT nested under the
//                        base segment, mirroring zfb's own `dist/assets/*`
//                        (linked as `<base>/assets/*`).
//
// Invalidation is a stamp (`<path>:<mtimeMs>` joined) over the compile's
// `dependencies` (entry + @imports), `sourceFiles` (the files the Tailwind
// scanner read — class edits in components change the utilities) and the
// directories holding those files (a new component file bumps its parent
// directory's mtime). No file watcher is registered: every request re-stamps.

import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  ZfbBuildHookContext,
  ZfbDevMiddlewareHandler,
  ZfbDevMiddlewareRequest,
  ZfbDevMiddlewareResponse,
  ZfbPlugin,
  ZfbPluginLogger,
  ZfbSetupContext,
} from "@takazudo/zfb/plugins";
import { resolveHostModule, toForwardSlash, withBaseUrl } from "../host-paths.js";
import { compilePreviewCss, type CompilePreviewCssResult } from "../preview-css/compile.js";
import { DEFAULT_PREVIEW_CSS_URL } from "../sg-context.js";

export const PLUGIN_NAME = "@takazudo/zudo-sg/plugins/preview-css";

export { DEFAULT_PREVIEW_CSS_URL };

export interface PreviewCssPluginOptions {
  /** Project-root-relative preview stylesheet entry (e.g. `./src/styles/preview-entry.css`). */
  previewStyles: string;
  /** Root-absolute URL path, before the base prefix. Default `/_zudo-sg/preview.css`. */
  previewCssUrl?: string;
}

export interface ResolvedPreviewCssPluginOptions {
  /** Forward-slash absolute path of the entry file. */
  previewStyles: string;
  previewCssUrl: string;
}

export type PreviewCssCompiler = (entryAbsPath: string) => Promise<CompilePreviewCssResult>;

type Logger = Pick<ZfbPluginLogger, "info" | "error">;

const OPTION_KEYS = new Set(["previewStyles", "previewCssUrl"]);

function fail(message: string): never {
  throw new Error(`[zudo-sg] ${message}`);
}

/** Validates the options block and resolves `previewStyles`; throws `[zudo-sg] …` on invalid input. */
export function resolvePreviewCssPluginOptions(
  projectRoot: string,
  options: Record<string, unknown>,
): ResolvedPreviewCssPluginOptions {
  for (const key of Object.keys(options)) {
    if (!OPTION_KEYS.has(key)) {
      fail(`unknown option "${key}" for ${PLUGIN_NAME} (expected one of ${[...OPTION_KEYS].join(", ")})`);
    }
  }

  const stylesValue = options.previewStyles;
  if (stylesValue !== undefined && stylesValue !== null && typeof stylesValue !== "string") {
    fail(`option "previewStyles" must be a string (project-root-relative path)`);
  }
  const previewStyles = resolveHostModule(projectRoot, "previewStyles", stylesValue, {
    required: true,
    example: "./src/styles/preview-entry.css",
  });

  const urlValue = options.previewCssUrl;
  let previewCssUrl = DEFAULT_PREVIEW_CSS_URL;
  if (urlValue !== undefined && urlValue !== null) {
    if (typeof urlValue !== "string" || urlValue === "") fail(`option "previewCssUrl" must be a non-empty string`);
    if (!urlValue.startsWith("/") || urlValue.endsWith("/") || /[?#]/.test(urlValue)) {
      fail(`option "previewCssUrl" = "${urlValue}" must be a root-absolute file URL path (e.g. "${DEFAULT_PREVIEW_CSS_URL}")`);
    }
    if (urlValue.split("/").some((segment) => segment === "." || segment === "..")) {
      fail(`option "previewCssUrl" = "${urlValue}" must not contain "." or ".." segments`);
    }
    previewCssUrl = urlValue;
  }

  return { previewStyles, previewCssUrl };
}

/** The full URL zfb must match: `"/"` → `/_zudo-sg/preview.css`, `"/spike/"` → `/spike/_zudo-sg/preview.css`. */
export function previewCssRoute(base: string | undefined, previewCssUrl: string): string {
  return withBaseUrl(base ?? "/", previewCssUrl);
}

/** `<outDir><previewCssUrl>` — the base segment is deliberately NOT part of the on-disk path. */
export function previewCssOutputPath(outDir: string, previewCssUrl: string): string {
  return join(outDir, ...previewCssUrl.split("/").filter(Boolean));
}

function mtimeOf(path: string): number | null {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

/** Every path whose mtime decides freshness: dependencies, scanned files and their directories. */
export function watchedPaths(result: Pick<CompilePreviewCssResult, "dependencies" | "sourceFiles">): string[] {
  const files = [...result.dependencies, ...result.sourceFiles];
  return [...new Set([...files, ...files.map((file) => toForwardSlash(dirname(file)))])];
}

/** `<path>:<mtimeMs>` joined; a missing file stamps as `<path>:missing`. */
export function computeStamp(paths: readonly string[]): string {
  return paths.map((path) => `${path}:${mtimeOf(path) ?? "missing"}`).join("\n");
}

export interface PreviewCssCache {
  /** Returns the current stylesheet, compiling only when an input changed. */
  get(): Promise<string>;
}

export function createPreviewCssCache(
  entry: string,
  compile: PreviewCssCompiler = compilePreviewCss,
  logger?: Logger,
): PreviewCssCache {
  let cached: { css: string; paths: string[]; stamp: string } | undefined;
  let inflight: Promise<string> | undefined;

  const recompile = async (): Promise<string> => {
    const startedAt = Date.now();
    const result = await compile(entry);
    const paths = watchedPaths(result);
    const stamp = computeStamp(paths);
    // An input edited while the compile ran may be missing from `css` yet
    // already carry its new mtime in `stamp`; poison the stamp so the next
    // request recompiles instead of serving that output forever.
    const touchedDuringCompile = paths.some((path) => (mtimeOf(path) ?? 0) >= startedAt);
    cached = { css: result.css, paths, stamp: touchedDuringCompile ? "" : stamp };
    logger?.info(
      `preview css compiled (${result.candidateCount} candidates, ${result.dependencies.length} deps, ${result.sourceFiles.length} source files)`,
    );
    return result.css;
  };

  return {
    get() {
      if (inflight) return inflight;
      if (cached && computeStamp(cached.paths) === cached.stamp) return Promise.resolve(cached.css);
      inflight = recompile().finally(() => {
        inflight = undefined;
      });
      return inflight;
    },
  };
}

const CSS_HEADERS = {
  "content-type": "text/css; charset=utf-8",
  "cache-control": "no-store",
} as const;

export interface PreviewCssHandlerOptions {
  /** Full URL (base included) — see `previewCssRoute`. */
  route: string;
  cache: PreviewCssCache;
  logger?: Logger;
}

/** Answers exactly `route` (query string ignored); anything else under the prefix falls through. */
export function createPreviewCssHandler({ route, cache, logger }: PreviewCssHandlerOptions): ZfbDevMiddlewareHandler {
  return async function handlePreviewCssRequest(
    req: ZfbDevMiddlewareRequest,
  ): Promise<ZfbDevMiddlewareResponse | undefined> {
    const pathname = new URL(req.url, "http://127.0.0.1").pathname;
    if (pathname !== route) return undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      return { status: 405, headers: { allow: "GET, HEAD" }, body: "Method Not Allowed" };
    }
    try {
      const css = await cache.get();
      return {
        status: 200,
        headers: { ...CSS_HEADERS },
        body: req.method === "HEAD" ? "" : css,
        bodyEncoding: "utf8",
      };
    } catch (error) {
      const message = `[zudo-sg] preview css compile failed: ${error instanceof Error ? error.message : String(error)}`;
      logger?.error(message);
      return {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        body: message,
        bodyEncoding: "utf8",
      };
    }
  };
}

/**
 * Removes any previous file at the target, then writes through a unique temp
 * file + rename so a concurrent reader (or a second build into the same
 * outDir) never observes a partially written stylesheet.
 */
export async function writePreviewCss(outDir: string, previewCssUrl: string, css: string): Promise<string> {
  const target = previewCssOutputPath(outDir, previewCssUrl);
  await rm(target, { force: true });
  await mkdir(dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}-${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(temp, css, "utf8");
    await rename(temp, target);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
  return target;
}

export interface CreatePreviewCssPluginOptions {
  compile?: PreviewCssCompiler;
}

export function createPreviewCssPlugin({ compile = compilePreviewCss }: CreatePreviewCssPluginOptions = {}): ZfbPlugin {
  // One cache per entry for the lifetime of the host process, shared by the
  // dev and preview registrations.
  const caches = new Map<string, PreviewCssCache>();
  const cacheFor = (entry: string, logger: Logger) => {
    let cache = caches.get(entry);
    if (!cache) {
      cache = createPreviewCssCache(entry, compile, logger);
      caches.set(entry, cache);
    }
    return cache;
  };

  const registerHandler = (ctx: {
    projectRoot: string;
    config: ZfbSetupContext["config"];
    options: Record<string, unknown>;
    logger: ZfbPluginLogger;
    register(path: string, handler: ZfbDevMiddlewareHandler): void;
  }) => {
    const resolved = resolvePreviewCssPluginOptions(ctx.projectRoot, ctx.options);
    const route = previewCssRoute(ctx.config.base, resolved.previewCssUrl);
    ctx.register(
      route,
      createPreviewCssHandler({ route, cache: cacheFor(resolved.previewStyles, ctx.logger), logger: ctx.logger }),
    );
  };

  return {
    name: PLUGIN_NAME,

    setup(ctx: ZfbSetupContext) {
      resolvePreviewCssPluginOptions(ctx.projectRoot, ctx.options);
    },

    devMiddleware: registerHandler,

    previewMiddleware: registerHandler,

    async postBuild(ctx: ZfbBuildHookContext) {
      const resolved = resolvePreviewCssPluginOptions(ctx.projectRoot, ctx.options);
      const target = previewCssOutputPath(ctx.outDir, resolved.previewCssUrl);
      // Drop the previous build's file before compiling, so a failed compile
      // cannot leave a stale stylesheet behind in outDir.
      await rm(target, { force: true });
      const result = await compile(resolved.previewStyles);
      await writePreviewCss(ctx.outDir, resolved.previewCssUrl, result.css);
      ctx.logger.info(
        `preview css written to ${toForwardSlash(target)} (${Buffer.byteLength(result.css)} bytes, ${result.candidateCount} candidates)`,
      );
    },
  };
}

export default createPreviewCssPlugin();
