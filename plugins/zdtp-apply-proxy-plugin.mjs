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
// SCOPE — routed prefixes (zdtp-panel-routing.json):
//   palette, color                     → packages/ui/styles/colors.css
//   spacing, text, font, leading,      → packages/ui/styles/tokens.css
//     radius, shadow
//   Prefix matching is `--{key}-` startsWith, longest-key-first (zdtp's own
//   rule): "font" covers --font-weight-*/--font-sans/--font-mono and "text"
//   covers the --text-* size scale plus its --text-*--line-height pairs, so no
//   separate key is needed for those. `--breakpoint-*` and
//   `--default-transition-*` are deliberately LEFT UNROUTED — they are Tailwind
//   plumbing, not designer-tweakable tokens.
//   zdtp 0.4.5 rewrites the first top-level `:root { ... }` block and the first
//   top-level `@theme { ... }` block of the target CSS file (see
//   node_modules/@takazudo/zdtp/dist/apply/apply-token-overrides.d.ts):
//   colors.css exposes both (Tier-1 palette in `:root`, Tier-2 `--color-*` in
//   `@theme`); tokens.css is a single `@theme`.
//
// SAME-FILE HAZARD — two routed prefixes now share EACH target file (palette +
//   color; and six prefixes on tokens.css), and zdtp 0.4.5 clobbers same-file
//   prefix-groups because its apply handler is read-all-then-write-all. The
//   `createDevMiddlewareHandler` shim below fixes this by issuing one apply
//   call per prefix, awaited sequentially; see its inline comment + the
//   upstream bug-report sub #202. The panel POSTs every currently-dirty token
//   across ALL tabs in one Apply request (zdtp's `buildApplyOverrides`), so a
//   single Apply routinely mixes prefixes that land in the same file — exactly
//   the case the shim exists to make correct.

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
 * Flatten a Fetch API `Headers` into the plain record zfb wants.
 *
 * @param {Response} res
 * @returns {Record<string, string>}
 */
function collectHeaders(res) {
  /** @type {Record<string, string>} */
  const headers = {};
  res.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

/**
 * Convert a standard Fetch API `Response` into a zfb devMiddleware response.
 *
 * @param {Response} res
 * @returns {Promise<ZfbDevMiddlewareResponse>}
 */
export async function fromFetchResponse(res) {
  return { status: res.status, headers: collectHeaders(res), body: await res.text(), bodyEncoding: "utf8" };
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

  // Routing prefixes sorted longest-key-first — a faithful mirror of the
  // matcher inside zdtp's route-tokens-to-files, so this shim partitions tokens
  // EXACTLY the way the handler would internally.
  //
  // startsWith coupling caveat: a var is claimed by the first `--{key}-` it
  // starts with, so a future --text-* var that is NOT meant to be
  // apply-writable would still match the "text" route and become writable.
  // Tighten the routing keys (or add an exclusion layer) if that ever matters.
  const routingPrefixesLongestFirst = Object.keys(routing).sort(
    (a, b) => b.length - a.length,
  );

  /**
   * The routing key that owns `cssVar`, or null if unroutable. Mirrors zdtp's
   * `--{key}-` startsWith rule (must be strictly longer than the prefix) with
   * longest-key-first precedence.
   *
   * @param {string} cssVar
   * @returns {string | null}
   */
  function matchRoutingPrefix(cssVar) {
    if (!cssVar.startsWith("--")) return null;
    for (const key of routingPrefixesLongestFirst) {
      const prefix = `--${key}-`;
      if (cssVar.startsWith(prefix) && cssVar.length > prefix.length) return key;
    }
    return null;
  }

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

    // ── Same-file coalescing shim ──────────────────────────────────────────
    // WHY: zdtp 0.4.5's createApplyHandler is read-all-then-write-all. It
    // computes every prefix-group's rewrite from the ORIGINAL on-disk content
    // and only THEN writes them (see the installed dist: load-routing-*.js
    // reads all groups via `ot()`, then writes them via `it()`). Two routing
    // prefixes that resolve to the SAME file (palette + color → colors.css;
    // spacing/text/font/leading/radius/shadow → tokens.css) each read that same
    // original, so the second write clobbers the first — only the last group's
    // edits survive.
    //
    // FIX: split the request into one sub-request PER ROUTING PREFIX and call
    // the handler once per group, awaited SEQUENTIALLY, so each call reads the
    // on-disk state the previous call just wrote. Grouping by PREFIX (not by
    // target file) is mandatory: a single handler call carrying two prefixes
    // that share a file reproduces the clobber INSIDE that one call, because
    // zdtp re-splits by prefix internally — so batching same-file prefixes back
    // together would defeat the whole shim.
    //
    // Removable once upstream zdtp coalesces same-file prefix-groups by
    // relativePath (making a single handler call clobber-free). Tracked as the
    // sibling upstream bug-report sub #202 (issue URL TBD/pending).
    let parsed;
    try {
      parsed = JSON.parse(zfbReq.body ?? "");
    } catch {
      // Malformed JSON — hand the original request to zdtp so its own 400
      // ("Invalid JSON in request body") is returned unchanged.
      return fromFetchResponse(await applyHandler(toFetchRequest(zfbReq)));
    }
    const tokens =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed.tokens
        : undefined;
    if (typeof tokens !== "object" || tokens === null || Array.isArray(tokens)) {
      // Not the { tokens: {...} } shape — pass through for zdtp's own 400.
      return fromFetchResponse(await applyHandler(toFetchRequest(zfbReq)));
    }

    // Partition tokens by routing prefix. Any unroutable var → pass the
    // ORIGINAL request straight through so zdtp emits its single 400
    // ("Unsupported cssVar prefix", with the `rejected` list) unchanged.
    /** @type {Map<string, Record<string, unknown>>} */
    const groupsByPrefix = new Map();
    for (const [name, value] of Object.entries(tokens)) {
      const key = matchRoutingPrefix(name);
      if (key === null) {
        return fromFetchResponse(await applyHandler(toFetchRequest(zfbReq)));
      }
      let group = groupsByPrefix.get(key);
      if (group === undefined) {
        group = {};
        groupsByPrefix.set(key, group);
      }
      group[name] = value;
    }

    // 0 groups (empty tokens map) or a single prefix group are already
    // clobber-free — behave exactly like the un-shimmed single call. (0 groups
    // passes through to zdtp's "tokens must contain at least one entry" 400.)
    if (groupsByPrefix.size <= 1) {
      return fromFetchResponse(await applyHandler(toFetchRequest(zfbReq)));
    }

    // Multiple prefixes: one sequential handler call per group, results merged.
    // `updated` entries are coalesced by target file: because this shim splits a
    // same-file request into one call per prefix, two prefixes writing the same
    // file would otherwise yield two `updated` rows with an identical `file`.
    // zdtp's result modal keys rows by `file`, so duplicate `file` values render
    // as confusingly-partial split sections (and collide as Preact keys). Merge
    // array-valued fields per file so the response carries one row per file —
    // matching the shape the un-shimmed single call would have produced. (#200 review)
    /** @type {Map<string, Record<string, unknown>>} */
    const updatedByFile = new Map();
    /** @type {Record<string, unknown>[]} */
    const updatedOrder = [];
    const merged = {
      ok: true,
      unknownCssVars: /** @type {unknown[]} */ ([]),
      unchangedCssVars: /** @type {unknown[]} */ ([]),
      unknownOutsideBlockCssVars: /** @type {unknown[]} */ ([]),
    };
    for (const groupTokens of groupsByPrefix.values()) {
      const res = await applyHandler(
        toFetchRequest({ ...zfbReq, body: JSON.stringify({ tokens: groupTokens }) }),
      );
      const body = await res.text();
      if (res.status !== 200) {
        // Per-file atomicity only: any earlier prefix groups have already been
        // written to their files and STAY applied. Acceptable for a dev-only
        // tool. Return this failing call's error response verbatim.
        return { status: res.status, headers: collectHeaders(res), body, bodyEncoding: "utf8" };
      }
      const json = JSON.parse(body);
      for (const entry of json.updated ?? []) {
        const file = entry?.file;
        const existing = file != null ? updatedByFile.get(file) : undefined;
        if (!existing) {
          const clone = { ...entry };
          if (file != null) updatedByFile.set(file, clone);
          updatedOrder.push(clone);
          continue;
        }
        // Same file already written by an earlier prefix group: concat every
        // array-valued field (changed / unchanged / unknown / unknownOutsideBlock).
        for (const [k, v] of Object.entries(entry)) {
          if (Array.isArray(v) && Array.isArray(existing[k])) {
            existing[k] = [...existing[k], ...v];
          }
        }
      }
      merged.unknownCssVars.push(...(json.unknownCssVars ?? []));
      merged.unchangedCssVars.push(...(json.unchangedCssVars ?? []));
      merged.unknownOutsideBlockCssVars.push(...(json.unknownOutsideBlockCssVars ?? []));
    }
    return {
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...merged, updated: updatedOrder }),
      bodyEncoding: "utf8",
    };
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
