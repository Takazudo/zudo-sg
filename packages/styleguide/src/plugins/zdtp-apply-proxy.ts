// zfb plugin module: @takazudo/zudo-sg/plugins/zdtp-apply-proxy.
//
// Wires @takazudo/zdtp's apply pipeline (zdtp README §3 "Apply pipeline") into
// `zfb dev` so a browser tweak in the preview design-token panel can persist
// back to CSS source on disk, and hands the preview panel island its host data.
//
// Integration shape: an in-process `devMiddleware` handler instead of the
// standalone `zdtp-server` bin (the shape zdtp's own zfb example uses, README
// §15). Benefits over a sidecar process:
//   - same-origin `/__zdtp/apply` fetch — no separate port, no CORS allow-list.
//   - dev-only BY CONSTRUCTION: `devMiddleware` never runs during `zfb build`.
//   - nothing to orphan on Ctrl-C — the handler lives inside `zfb dev`.
//
// Virtual module `virtual:zudo-sg-preview-token-panel` (read by the
// `@takazudo/zudo-sg/token-tweak/preview-token-panel-bootstrap` island):
//   - `tabs`: re-exported from the host `tabsModule` (always, or `undefined`).
//   - `applyEndpoint` / `applyRouting`: injected ONLY under `zfb dev`; a build
//     emits `undefined` for both so no apply wiring (not even the routing
//     map's file paths) enters the shipped bundle.
//
// `@takazudo/zdtp` is a required peer. This plugin retains rejection handling
// for failed server imports: apply fields become `undefined` and the endpoint
// answers 503, though the engine's /tokens route still requires the package.
//
// Routing (host `routingFile`, zdtp README §3.2 shape): prefix matching is
// `--{key}-` startsWith, longest-key-first; zdtp rewrites the first top-level
// `:root { … }` and `@theme { … }` block of each target file, and every target
// must resolve inside `writeRoot`. The pinned zdtp (>=0.4.7) coalesces a
// complete Apply by resolved target file (one computed write per file); below
// 0.4.7 same-file edits clobber each other. Reverse-order restoration on a
// failed later write is best-effort, not a transaction.

import { statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type {
  ZfbDevMiddlewareContext,
  ZfbDevMiddlewareRequest,
  ZfbDevMiddlewareResponse,
  ZfbPlugin,
  ZfbPluginLogger,
  ZfbSetupContext,
} from "@takazudo/zfb/plugins";
import type { ApplyRoutingMap } from "@takazudo/zdtp/server";
import { resolveHostModule, toForwardSlash } from "../host-paths.js";

type ZdtpServerModule = typeof import("@takazudo/zdtp/server");
type ZdtpServerImporter = () => Promise<ZdtpServerModule>;

export const PLUGIN_NAME = "@takazudo/zudo-sg/plugins/zdtp-apply-proxy";

/** Virtual module read by the preview token panel island. */
export const VIRTUAL_MODULE_ID = "virtual:zudo-sg-preview-token-panel";

/** Same-origin path the preview panel POSTs its apply diff to. */
export const APPLY_PATH = "/__zdtp/apply";

// `routingFile` and `writeRoot` are optional TOGETHER — either both (the Apply
// endpoint is enabled) or neither (`{ tabsModule }` alone resolves to
// `{ enabled: false, tabsModule }`, per `ResolvedZdtpApplyProxyOptions` below).
// Exactly one of the two still fails validation in `resolveZdtpApplyProxyOptions`.
export type ZdtpApplyProxyOptions =
  | {
      /** Project-root-relative routing JSON (e.g. `./zdtp-panel-routing.json`). */
      routingFile: string;
      /** Project-root-relative write sandbox directory (e.g. `./packages/demo-ui/styles`). */
      writeRoot: string;
      /** Project-root-relative module exporting `tabs` (the manifest-derived zdtp tab set). */
      tabsModule?: string;
    }
  | {
      routingFile?: undefined;
      writeRoot?: undefined;
      /** Project-root-relative module exporting `tabs` (the manifest-derived zdtp tab set). */
      tabsModule?: string;
    };

export type ResolvedZdtpApplyProxyOptions =
  | { enabled: true; routingFile: string; writeRoot: string; tabsModule: string | undefined }
  /** Neither `routingFile` nor `writeRoot` given (`zudoSg()` without `zdtpApplyProxy`): no Apply endpoint. */
  | { enabled: false; tabsModule: string | undefined };

function isDirectory(absPath: string): boolean {
  try {
    return statSync(absPath).isDirectory();
  } catch {
    return false;
  }
}

/** Resolves the plugin options through the shared host-path contract; throws on invalid input. */
export function resolveZdtpApplyProxyOptions(
  projectRoot: string,
  options: Record<string, unknown>,
): ResolvedZdtpApplyProxyOptions {
  const str = (name: string): string | undefined => {
    const value = options[name];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string") {
      throw new Error(`[zudo-sg] option "${name}" must be a string (project-root-relative path)`);
    }
    return value;
  };

  const tabsModule = resolveHostModule(projectRoot, "tabsModule", str("tabsModule"), {
    example: "./src/config/preview-token-panel-tabs.ts",
  });
  const writeRootValue = str("writeRoot");
  if (str("routingFile") === undefined && writeRootValue === undefined) {
    return { enabled: false, tabsModule };
  }

  const routingFile = resolveHostModule(projectRoot, "routingFile", str("routingFile"), {
    required: true,
    example: "./zdtp-panel-routing.json",
  });

  if (writeRootValue === undefined) {
    throw new Error(
      `[zudo-sg] option "writeRoot" is required (project-root-relative path, e.g. "./packages/demo-ui/styles")`,
    );
  }
  const writeRoot = toForwardSlash(
    isAbsolute(writeRootValue) ? resolve(writeRootValue) : resolve(projectRoot, writeRootValue),
  );
  if (writeRootValue === "" || !isDirectory(writeRoot)) {
    throw new Error(
      `[zudo-sg] option "writeRoot" = "${writeRootValue}" resolved to ${writeRoot} (relative to projectRoot ${toForwardSlash(resolve(projectRoot))}), which is not a directory`,
    );
  }

  return { enabled: true, routingFile, writeRoot, tabsModule };
}

let warnedMissingZdtp = false;

/** Loads the zdtp server entry; resolves `null` (warning once) if its import fails. */
export async function loadZdtpServer(
  logger?: Pick<ZfbPluginLogger, "warn">,
  importer: ZdtpServerImporter = () => import("@takazudo/zdtp/server"),
): Promise<ZdtpServerModule | null> {
  try {
    return await importer();
  } catch (error) {
    if (!warnedMissingZdtp) {
      warnedMissingZdtp = true;
      const message = `[zudo-sg] @takazudo/zdtp is not installed; the preview token panel Apply endpoint is disabled (${String(error)})`;
      if (logger) logger.warn(message);
      else console.warn(message);
    }
    return null;
  }
}

/** Test seam: re-arms the one-shot missing-peer warning. */
export function __resetZdtpWarningForTests(): void {
  warnedMissingZdtp = false;
}

/**
 * Convert a zfb devMiddleware request into a standard Fetch API `Request`.
 * zdtp's handler only calls `req.json()`, so any absolute URL works.
 */
export function toFetchRequest(zfbReq: ZfbDevMiddlewareRequest): Request {
  const hasBody = zfbReq.method !== "GET" && zfbReq.method !== "HEAD";
  return new Request(new URL(zfbReq.url, "http://127.0.0.1"), {
    method: zfbReq.method,
    headers: zfbReq.headers,
    body: hasBody ? zfbReq.body : undefined,
  });
}

/** Convert a standard Fetch API `Response` into a zfb devMiddleware response. */
export async function fromFetchResponse(res: Response): Promise<ZfbDevMiddlewareResponse> {
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return { status: res.status, headers, body: await res.text(), bodyEncoding: "utf8" };
}

// Shared by the OPTIONS and 405 branches so the advertised `Allow` can't drift.
const ALLOWED_METHODS = "POST, OPTIONS";

export interface DevMiddlewareHandlerOptions {
  rootDir: string;
  writeRoot: string;
  routing: ApplyRoutingMap;
  importer?: ZdtpServerImporter;
  logger?: Pick<ZfbPluginLogger, "warn">;
}

/**
 * Build the devMiddleware handler for the apply endpoint. zdtp is loaded on the
 * first real POST; a failed import disables this endpoint without rejecting.
 */
export function createDevMiddlewareHandler({
  rootDir,
  writeRoot,
  routing,
  importer,
  logger,
}: DevMiddlewareHandlerOptions): (zfbReq: ZfbDevMiddlewareRequest) => Promise<ZfbDevMiddlewareResponse> {
  let applyHandler: Promise<((req: Request) => Promise<Response>) | null> | undefined;

  return async function handleApplyRequest(zfbReq) {
    if (zfbReq.method === "OPTIONS") {
      // Benign capability probe (zdtp README §3.4 documents OPTIONS as part of
      // the endpoint contract); no write happens, so answer instead of 405.
      return { status: 204, headers: { allow: ALLOWED_METHODS } };
    }
    if (zfbReq.method !== "POST") {
      return { status: 405, headers: { allow: ALLOWED_METHODS }, body: "Method Not Allowed" };
    }

    applyHandler ??= loadZdtpServer(logger, importer).then((server) =>
      server ? server.createApplyHandler({ rootDir, writeRoot, routing }) : null,
    );
    const handler = await applyHandler;
    if (!handler) {
      return {
        status: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: false, error: "@takazudo/zdtp is not installed" }),
        bodyEncoding: "utf8",
      };
    }
    // Forward the complete payload once so zdtp can coalesce all routing
    // groups by resolved target file before it computes and writes.
    return fromFetchResponse(await handler(toFetchRequest(zfbReq)));
  };
}

/** Builds the `virtual:zudo-sg-preview-token-panel` source. */
export async function buildVirtualModuleSource(
  command: ZfbSetupContext["command"],
  resolved: ResolvedZdtpApplyProxyOptions,
  logger?: Pick<ZfbPluginLogger, "warn">,
  importer?: ZdtpServerImporter,
): Promise<string> {
  const lines = [
    resolved.tabsModule
      ? `export { tabs } from ${JSON.stringify(resolved.tabsModule)};`
      : "export const tabs = undefined;",
  ];
  const server = command === "dev" && resolved.enabled ? await loadZdtpServer(logger, importer) : null;
  if (server && resolved.enabled) {
    const routing = server.loadRoutingFromFile(resolved.routingFile);
    lines.push(
      `export const applyEndpoint = ${JSON.stringify(APPLY_PATH)};`,
      `export const applyRouting = ${JSON.stringify(routing)};`,
    );
  } else {
    lines.push("export const applyEndpoint = undefined;", "export const applyRouting = undefined;");
  }
  return `${lines.join("\n")}\n`;
}

export function createZdtpApplyProxyPlugin(importer?: ZdtpServerImporter): ZfbPlugin {
  return {
    name: PLUGIN_NAME,

    setup(ctx: ZfbSetupContext) {
      const resolved = resolveZdtpApplyProxyOptions(ctx.projectRoot, ctx.options);
      ctx.addVirtualModule(
        VIRTUAL_MODULE_ID,
        () => buildVirtualModuleSource(ctx.command, resolved, ctx.logger, importer),
        ctx.command === "dev" && resolved.enabled ? { watchFiles: [resolved.routingFile] } : undefined,
      );
    },

    async devMiddleware(ctx: ZfbDevMiddlewareContext) {
      const resolved = resolveZdtpApplyProxyOptions(ctx.projectRoot, ctx.options);
      if (!resolved.enabled) return;
      const server = await loadZdtpServer(ctx.logger, importer);
      ctx.register(
        APPLY_PATH,
        createDevMiddlewareHandler({
          rootDir: ctx.projectRoot,
          writeRoot: resolved.writeRoot,
          routing: server ? server.loadRoutingFromFile(resolved.routingFile) : {},
          importer,
          logger: ctx.logger,
        }),
      );
    },
  };
}

export default createZdtpApplyProxyPlugin();
