// zfb plugin module: @takazudo/zudo-sg/plugins/preview-css.
//
// Owns the lifecycle of the standalone preview stylesheet (ADR
// docs/adr/styleguide-engine.md decision 4); compilation itself lives in
// ../preview-css/compile.ts.
//
//   - setup:             resolves `previewStyles` through the host-path contract
//                        so a bad path fails the boot, not the first request.
//   - devMiddleware /    serve `${stripTrailingSlash(base)}${previewCssUrl}`
//     previewMiddleware: (zfb mounts unprefixed registrations under base), compiling
//                        lazily and recompiling when any compile input's content
//                        changed since the cached compile. zfb does not reuse a
//                        dev registration for preview, hence both hooks.
//   - postBuild:         writes `<outDir><previewCssUrl>` — NOT nested under the
//                        base segment, mirroring zfb's own `dist/assets/*`
//                        (linked as `<base>/assets/*`).
//
// Every request re-enumerates source roots and hashes contents plus the resolved
// compiler inputs. Host config graph edits require reload/restart; CSS/source
// edits refresh in the same process. Generated preview files are excluded.

import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
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
import { compilePreviewCss, type CompilePreviewCssResult, type CompilePreviewCssOptions, contentStamp, inputGraph, sourceInputs, snapshotWind, resolveZfbCli, resolveInput } from "../preview-css/compile.js";
import { DEFAULT_PREVIEW_CSS_URL } from "../sg-context.js";

export const PLUGIN_NAME = "@takazudo/zudo-sg/plugins/preview-css";

export { DEFAULT_PREVIEW_CSS_URL };

export interface PreviewCssPluginOptions {
  /** Project-root-relative preview stylesheet entry (e.g. `./src/styles/preview-entry.css`). */
  previewStyles: string;
  /** Root-absolute URL path, before the base prefix. Default `/_zudo-sg/preview.css`. */
  previewCssUrl?: string;
  wind?: Record<string, unknown>;
  componentsRoots?: ReadonlyArray<{ dir: string }>;
}

export interface ResolvedPreviewCssPluginOptions {
  /** Forward-slash absolute path of the entry file. */
  previewStyles: string;
  previewCssUrl: string;
}

export type PreviewCssCompiler = (entryAbsPath: string, options?: CompilePreviewCssOptions) => Promise<CompilePreviewCssResult>;

type Logger = Pick<ZfbPluginLogger, "info" | "error">;

const OPTION_KEYS = new Set(["previewStyles", "previewCssUrl", "wind", "componentsRoots"]);

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

/** Include parent roots to discover nested additions and removals. */
export function watchedPaths(result: Pick<CompilePreviewCssResult, "dependencies" | "sourceFiles">): string[] {
  const files = [...result.dependencies, ...result.sourceFiles];
  return [...new Set([...files, ...files.map(dirname)])];
}
export function computeStamp(paths: readonly string[]): string { return contentStamp(paths); }
export interface PreviewCssCache { get(): Promise<string>; }

export function createPreviewCssCache(
  entry: string,
  compile: PreviewCssCompiler = compilePreviewCss,
  logger?: Logger,
  options: CompilePreviewCssOptions = {},
): PreviewCssCache {
  const root = options.projectRoot ?? dirname(entry);
  const wind = options.wind ?? {};
  const packageRoot = (name: string) => dirname(resolveInput(`${name}/package.json`, join(root, "package.json")) ?? resolve(root, "node_modules", name, "package.json"));
  const sourcesConfig = wind.sources as { roots?: string[]; packageRoots?: string[]; __zfb_source_package?: string } | undefined;
  const sourceAnchor = sourcesConfig?.__zfb_source_package ? packageRoot(sourcesConfig.__zfb_source_package) : root;
  const sources = [
    ...(options.sources ?? []).map(p => resolve(root, p)),
    ...(sourcesConfig?.roots ?? []).map(p => resolve(sourceAnchor, p)),
  ];
  const packageSources = (sourcesConfig?.packageRoots ?? []).map(p => p.startsWith(".") || isAbsolute(p) ? resolve(sourceAnchor, p) : packageRoot(p));
  const manifests = Object.values((wind.manifests ?? {}) as Record<string, { path: string; __zfb_source_package?: string }>).map(m => {
    const anchor = m.__zfb_source_package ? packageRoot(m.__zfb_source_package) : root;
    return resolveInput(m.path, join(anchor, "package.json")) ?? resolve(anchor, m.path);
  });
  const configEntries = ["zfb.config.ts", "zfb.config.js", "zfb.config.mjs"].map(p => resolve(root, p));
  const configPaths = () => inputGraph(configEntries);
  const initialConfig = contentStamp(configPaths());
  let previousPaths: string[] = [entry];
  const paths = () => [...inputGraph([entry]), ...previousPaths, ...sourceInputs(root, sources), ...sourceInputs(root, packageSources, true), ...inputGraph(manifests)];
  let compilerIdentity = "injected";
  if (compile === compilePreviewCss) {
    const compiler = resolveZfbCli(root);
    previousPaths.push(compiler.packageJson, compiler.cli);
    compilerIdentity = contentStamp([compiler.packageJson, compiler.cli]);
  }
  const data = JSON.stringify({ root, sources, packageSources, wind: snapshotWind(wind), compilerIdentity });
  const stamp = () => contentStamp(paths(), data);
  let cached: { css: string; stamp: string } | undefined;
  let inflight: Promise<string> | undefined;
  return {
    get() {
      if (contentStamp(configPaths()) !== initialConfig) return Promise.reject(new Error("[zudo-sg] host config changed; reload/restart zfb to resolve fresh wind config"));
      if (inflight) return inflight;
      const before = stamp();
      if (cached?.stamp === before) return Promise.resolve(cached.css);
      inflight = (async () => {
        // A failed compile must not expose the last successful output.
        cached = undefined;
        const result = await compile(entry, options);
        const afterOriginal = stamp();
        previousPaths = [...new Set([...previousPaths, ...watchedPaths(result)])];
        cached = { css: result.css, stamp: before === afterOriginal ? stamp() : "" };
        logger?.info(`preview css compiled (${result.dependencies.length} deps, ${result.sourceFiles.length} source inputs)`);
        return result.css;
      })().finally(() => { inflight = undefined; });
      return inflight;
    },
  };
}

const CSS_HEADERS = {
  "content-type": "text/css; charset=utf-8",
  "cache-control": "no-store",
} as const;

export interface PreviewCssHandlerOptions {
  /** Unprefixed middleware URL; zfb strips the mount base before dispatch. */
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

function compilerOptions(ctx: { projectRoot: string; options: Record<string, unknown>; config: unknown }): CompilePreviewCssOptions {
  const wind = (ctx.config as { wind?: Record<string, unknown> }).wind ?? ctx.options.wind as Record<string, unknown> | undefined;
  return { projectRoot: ctx.projectRoot, wind, sources: ((ctx.options.componentsRoots ?? []) as { dir: string }[]).map(r => r.dir) };
}

export function createPreviewCssPlugin({ compile = compilePreviewCss }: CreatePreviewCssPluginOptions = {}): ZfbPlugin {
  // One cache per entry for the lifetime of the host process, shared by the
  // dev and preview registrations.
  const caches = new Map<string, PreviewCssCache>();
  const cacheFor = (entry: string, logger: Logger, options: CompilePreviewCssOptions) => {
    const key = JSON.stringify([entry, options]);
    let cache = caches.get(key);
    if (!cache) {
      cache = createPreviewCssCache(entry, compile, logger, options);
      caches.set(key, cache);
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
    // zfb mounts the registration under config.base and passes unprefixed URLs.
    const route = resolved.previewCssUrl;
    ctx.register(
      route,
      createPreviewCssHandler({ route, cache: cacheFor(resolved.previewStyles, ctx.logger, compilerOptions(ctx)), logger: ctx.logger }),
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
      const result = await compile(resolved.previewStyles, compilerOptions(ctx));
      await writePreviewCss(ctx.outDir, resolved.previewCssUrl, result.css);
      ctx.logger.info(
        `preview css written to ${toForwardSlash(target)} (${Buffer.byteLength(result.css)} bytes)`,
      );
    },
  };
}

export default createPreviewCssPlugin();
