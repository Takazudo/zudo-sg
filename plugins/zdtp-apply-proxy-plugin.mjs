// @ts-check
// zfb plugin module: zdtp-apply-proxy.
//
// Wires @takazudo/zdtp's apply pipeline (node_modules/@takazudo/zdtp README
// §3 "Apply pipeline (the bin)") into `zfb dev` so a browser tweak in the
// preview design-token panel can persist back to CSS source on disk.
//
// Integration shape: instead of spawning the standalone `zdtp-server` bin as
// a sibling process (README §3.5 / §4.3 — the generic recipe for hosts with
// no native hook), this registers an in-process `devMiddleware` handler —
// the same integration zdtp's own `zudo-design-token-panel-example-zfb`
// worked example uses (README §15: "Uses the `devMiddleware` plugin hook for
// the apply proxy."). Benefits over a sidecar process:
//   - same-origin `/__zdtp/apply` fetch from the browser — no separate port,
//     no CORS `--allow-origin` allow-list needed.
//   - dev-only BY CONSTRUCTION, not merely "bound to localhost": there is no
//     HTTP dispatcher to invoke `devMiddleware` at all during `zfb build` —
//     the handler literally never runs outside `zfb dev`.
//   - nothing to orphan on Ctrl-C — the handler lives inside the `zfb dev`
//     process itself, not a separate PID.
//
// The client-side half (PanelConfig.applyEndpoint / applyRouting on
// src/config/preview-token-panel-config.ts) reads a virtual module
// ("virtual:zdtp-apply-config", registered by the `setup` hook below) so the
// endpoint path and routing map are injected ONLY for a dev build — a
// production build's virtual module resolves to `undefined` for both
// fields, so no apply wiring data (not even the routing map's file paths)
// enters the shipped bundle.
//
// SCOPE — only the "palette" prefix is routed today:
//   zdtp 0.4.5 can rewrite the first top-level `:root { ... }` block and the
//   first top-level `@theme { ... }` block of the target CSS file (see
//   node_modules/@takazudo/zdtp/dist/apply/apply-token-overrides.d.ts).
//   This host still routes only `--palette-*` to packages/ui/styles/colors.css.
//   Extending routing to `--spacing-*` / `--font-*` / `--radius-*` /
//   `--shadow-*` in tokens.css and semantic `--color-*` rows in colors.css is
//   tracked separately at Takazudo/zudo-sg#130 because it changes which shared
//   token families are apply-writable and needs its own review.
//
// Practical corollary: the panel POSTs every currently-dirty token across
// ALL tabs in one Apply request (see zdtp's `buildApplyOverrides`); if any
// dirty token's prefix isn't in the routing map the WHOLE request 400s
// ("Unsupported cssVar prefix") and nothing is written — so today, Apply
// only succeeds when the only dirty tokens are Palette swatches.

import { createApplyHandler, loadRoutingFromFile } from "@takazudo/zdtp/server";
import { resolve } from "node:path";

/** @import { ZfbDevMiddlewareContext, ZfbDevMiddlewareRequest, ZfbDevMiddlewareResponse, ZfbPlugin, ZfbSetupContext } from "@takazudo/zfb/plugins" */
/** @import { ApplyRoutingMap } from "@takazudo/zdtp/server" */

/** Same-origin path the preview panel POSTs its apply diff to. */
export const APPLY_PATH = "/__zdtp/apply";

/** Repo-relative path to the shared routing JSON (README §3.2 shape). */
export const ROUTING_FILE = "zdtp-panel-routing.json";

/** Write-sandbox — every routing entry must resolve strictly inside this dir. */
const WRITE_ROOT_REL = "packages/ui/styles";

/**
 * Convert a zfb devMiddleware request into a standard Fetch API `Request`.
 * `createApplyHandler`'s returned function only calls `req.json()` — the URL
 * itself is never inspected — so any well-formed absolute URL works here.
 *
 * @param {ZfbDevMiddlewareRequest} zfbReq
 * @returns {Request}
 */
export function toFetchRequest(zfbReq) {
  const hasBody = zfbReq.method !== "GET" && zfbReq.method !== "HEAD";
  return new Request(new URL(zfbReq.url, "http://127.0.0.1"), {
    method: zfbReq.method,
    headers: zfbReq.headers,
    body: hasBody ? zfbReq.body : undefined,
  });
}

/**
 * Convert a standard Fetch API `Response` into a zfb devMiddleware response.
 *
 * @param {Response} res
 * @returns {Promise<ZfbDevMiddlewareResponse>}
 */
export async function fromFetchResponse(res) {
  /** @type {Record<string, string>} */
  const headers = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return { status: res.status, headers, body: await res.text(), bodyEncoding: "utf8" };
}

// The only methods this endpoint ever supports — shared by the OPTIONS and
// 405 branches below so the advertised `Allow` header can't drift between
// them.
const ALLOWED_METHODS = "POST, OPTIONS";

/**
 * Build the devMiddleware handler for the apply endpoint. Extracted from the
 * `devMiddleware` hook so it can be unit-tested directly against temp CSS
 * fixtures without spinning up a real `zfb dev` host.
 *
 * @param {{ rootDir: string, writeRoot: string, routing: ApplyRoutingMap }} options
 * @returns {(zfbReq: ZfbDevMiddlewareRequest) => Promise<ZfbDevMiddlewareResponse>}
 */
export function createDevMiddlewareHandler({ rootDir, writeRoot, routing }) {
  const applyHandler = createApplyHandler({ rootDir, writeRoot, routing });
  return async function handleApplyRequest(zfbReq) {
    if (zfbReq.method === "OPTIONS") {
      // Benign capability probe, not a real request — no write happens for
      // OPTIONS, so answering it doesn't grant anything beyond what POST
      // already allows. zdtp's own reference `/apply` protocol documents
      // "OPTIONS /apply — CORS preflight" as part of the endpoint contract
      // (node_modules/@takazudo/zdtp README §3.4); this same-origin devMiddleware
      // skips zdtp's CORS allow-list layer entirely (no Origin to check), so
      // this just mirrors that contract's success shape instead of 405ing a
      // request the real Apply POST never depended on succeeding.
      return { status: 204, headers: { allow: ALLOWED_METHODS } };
    }
    if (zfbReq.method !== "POST") {
      return { status: 405, headers: { allow: ALLOWED_METHODS }, body: "Method Not Allowed" };
    }
    const res = await applyHandler(toFetchRequest(zfbReq));
    return fromFetchResponse(res);
  };
}

/** @type {ZfbPlugin} */
export default {
  name: "zdtp-apply-proxy",

  /** @param {ZfbSetupContext} ctx */
  setup(ctx) {
    ctx.addVirtualModule("virtual:zdtp-apply-config", () => {
      if (ctx.command !== "dev") {
        // Production build: no endpoint, no routing map — nothing about the
        // apply pipeline's shape enters the shipped bundle.
        return [
          "export const applyEndpoint = undefined;",
          "export const applyRouting = undefined;",
          "",
        ].join("\n");
      }
      const routing = loadRoutingFromFile(resolve(ctx.projectRoot, ROUTING_FILE));
      return [
        `export const applyEndpoint = ${JSON.stringify(APPLY_PATH)};`,
        `export const applyRouting = ${JSON.stringify(routing)};`,
        "",
      ].join("\n");
    });
  },

  /** @param {ZfbDevMiddlewareContext} ctx */
  devMiddleware(ctx) {
    const routing = loadRoutingFromFile(resolve(ctx.projectRoot, ROUTING_FILE));
    const handler = createDevMiddlewareHandler({
      rootDir: ctx.projectRoot,
      writeRoot: resolve(ctx.projectRoot, WRITE_ROOT_REL),
      routing,
    });
    ctx.register(APPLY_PATH, handler);
  },
};
