// @ts-check
// Dev-only transport for the Composer filesystem store.
//
// The filesystem core deliberately knows nothing about HTTP or JSX generation.
// This plugin keeps that split intact: canonical records cross a capability-
// protected same-origin endpoint and the browser supplies the exact output from
// the production `generateJsx` function. Reads use a repair handshake so the
// core never reports list/get success until missing or stale JSX is repaired.

import { randomBytes, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";

/** @typedef {import("@takazudo/zfb/plugins").ZfbPlugin} ZfbPlugin */
/** @typedef {import("@takazudo/zfb/plugins").ZfbSetupContext} ZfbSetupContext */
/** @typedef {import("@takazudo/zfb/plugins").ZfbDevMiddlewareContext} ZfbDevMiddlewareContext */
/** @typedef {import("@takazudo/zfb/plugins").ZfbDevMiddlewareRequest} ZfbDevMiddlewareRequest */
/** @typedef {import("@takazudo/zfb/plugins").ZfbDevMiddlewareResponse} ZfbDevMiddlewareResponse */
/** @typedef {import("../src/composer/library/types.ts").CompositionRecord} CompositionRecord */

export const COMPOSER_FILE_PROVIDER_ENDPOINT = "/__zudo_composer_file_provider";
export const COMPOSER_FILE_PROVIDER_CAPABILITY_HEADER = "x-zudo-composer-capability";
/** UTF-8 bytes. Large enough for a substantial document plus generated JSX. */
export const COMPOSER_FILE_PROVIDER_MAX_BODY_BYTES = 2 * 1024 * 1024;
export const COMPOSER_FILE_PROVIDER_ROOT = "compositions";

const JSON_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
});

let serverCapability;

function capabilityForServer() {
  serverCapability ??= randomBytes(32).toString("base64url");
  return serverCapability;
}

/**
 * @param {number} status
 * @param {unknown} payload
 * @param {Record<string, string>} [headers]
 * @returns {ZfbDevMiddlewareResponse}
 */
function json(status, payload, headers = {}) {
  return {
    status,
    headers: { ...JSON_HEADERS, ...headers },
    body: JSON.stringify(payload),
    bodyEncoding: "utf8",
  };
}

/**
 * @param {number} status
 * @param {string} code
 * @param {string} message
 * @param {string | undefined} [operation]
 * @param {Record<string, string>} [headers]
 */
function errorResponse(status, code, message, operation, headers) {
  return json(status, {
    ok: false,
    error: { code, message, ...(operation === undefined ? {} : { operation }) },
  }, headers);
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @param {string[]} required
 * @param {string[]} [optional]
 */
function hasExactKeys(value, required, optional = []) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value).sort();
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => key in value) && keys.every((key) => allowed.has(key));
}

/** @param {unknown} value @returns {value is string} */
function isSafeId(value) {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9_-]{0,126}[a-z0-9])?$/.test(value);
}

/** @param {unknown} value @returns {Record<string, string> | undefined} */
function parseJsxById(value) {
  if (!isPlainObject(value)) return undefined;
  /** @type {Record<string, string>} */
  const result = Object.create(null);
  for (const [id, jsx] of Object.entries(value)) {
    if (!isSafeId(id) || typeof jsx !== "string") return undefined;
    result[id] = jsx;
  }
  return result;
}

/** @param {string | undefined} body */
function bodyBytes(body) {
  return Buffer.byteLength(body ?? "", "utf8");
}

/** @param {ZfbDevMiddlewareRequest} req */
function isSameOriginDevRequest(req) {
  if (req.headers["sec-fetch-site"] !== "same-origin") return false;
  const host = req.headers.host;
  const origin = req.headers.origin;
  if (!host || !origin || /[\s,]/.test(host)) return false;
  try {
    const expected = new URL(`http://${host}`).origin;
    return new URL(origin).origin === expected && origin === expected;
  } catch {
    return false;
  }
}

/** @param {ZfbDevMiddlewareRequest} req @param {string} expected */
function hasCapability(req, expected) {
  const supplied = req.headers[COMPOSER_FILE_PROVIDER_CAPABILITY_HEADER];
  if (typeof supplied !== "string") return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

class JsxRequiredError extends Error {
  /** @param {CompositionRecord} record */
  constructor(record) {
    super("Browser-generated JSX is required before this read can complete.");
    this.name = "JsxRequiredError";
    this.record = record;
  }
}

/** @param {unknown} value @returns {JsxRequiredError | undefined} */
function findJsxRequiredError(value) {
  let current = value;
  const seen = new Set();
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    if (current instanceof JsxRequiredError) return current;
    seen.add(current);
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown> & {name: "CompositionPersistenceError", operation: string, code: string}}
 */
function isPersistenceError(value) {
  return isPlainObject(value)
    && value.name === "CompositionPersistenceError"
    && typeof value.operation === "string"
    && typeof value.code === "string";
}

/** @param {unknown} value @param {string} fallbackOperation */
function sanitizedPersistenceError(value, fallbackOperation) {
  const operation = isPersistenceError(value) ? value.operation : fallbackOperation;
  const code = isPersistenceError(value) ? value.code : "unknown";
  switch (code) {
    case "validation":
    case "unsupported-version":
      return errorResponse(
        422,
        code,
        "Stored composition data is invalid or unsupported. Inspect its canonical JSON and retry.",
        operation,
      );
    case "blocked":
    case "conflict":
      return errorResponse(
        409,
        code,
        "A filesystem safety check blocked the operation. Inspect the compositions directory and retry.",
        operation,
      );
    case "unavailable":
    case "read-failed":
      return errorResponse(
        503,
        code,
        "Local composition files could not be read. Check directory permissions and retry.",
        operation,
      );
    case "write-failed":
    case "transaction-failed":
      return errorResponse(
        500,
        code,
        "Local composition files could not be updated. Check permissions and free space, then retry.",
        operation,
      );
    default:
      return errorResponse(
        500,
        "unknown",
        "The local file provider failed unexpectedly. Retry or restart the development server.",
        operation,
      );
  }
}

/** @param {unknown} payload @returns {any} */
function validateEnvelope(payload) {
  if (!isPlainObject(payload) || typeof payload.operation !== "string") {
    return { error: "Request body must be a JSON object with an operation." };
  }
  switch (payload.operation) {
    case "list": {
      if (!hasExactKeys(payload, ["operation", "jsxById"])) break;
      const jsxById = parseJsxById(payload.jsxById);
      if (jsxById !== undefined) return { operation: "list", jsxById };
      break;
    }
    case "get": {
      if (!hasExactKeys(payload, ["operation", "id", "jsxById"])) break;
      const jsxById = parseJsxById(payload.jsxById);
      if (isSafeId(payload.id) && jsxById !== undefined) {
        return { operation: "get", id: payload.id, jsxById };
      }
      break;
    }
    case "put":
      if (
        hasExactKeys(payload, ["operation", "record", "jsx"])
        && isPlainObject(payload.record)
        && hasExactKeys(payload.record, ["id", "createdAt", "updatedAt", "document"])
        && typeof payload.jsx === "string"
      ) {
        return { operation: "put", record: payload.record, jsx: payload.jsx };
      }
      break;
    case "delete":
      if (hasExactKeys(payload, ["operation", "id"]) && isSafeId(payload.id)) {
        return { operation: "delete", id: payload.id };
      }
      break;
    case "clear":
      if (hasExactKeys(payload, ["operation"])) return { operation: "clear" };
      break;
    default:
      return { error: "Unknown file-provider operation." };
  }
  return {
    error: "Request fields are invalid. Filenames, paths, and unknown fields are not accepted.",
  };
}

/**
 * Testable middleware factory. The supplied store factory receives the only
 * JSX provider the Node core ever sees; it either returns browser-generated
 * bytes from this request or interrupts the read with a validated record.
 *
 * @param {{
 *   endpoint?: string,
 *   capability: string,
 *   maxBodyBytes?: number,
 *   validateRecord: (value: unknown) => {ok: true, record: CompositionRecord} | {ok: false, issue: {message: string}},
 *   createStore: (options: {provideJsx: (record: CompositionRecord) => string}) => Promise<{
 *     list(): Promise<unknown>, get(id: string): Promise<unknown>,
 *     put(record: CompositionRecord, jsx?: string): Promise<void>,
 *     delete(id: string): Promise<boolean>, clear(): Promise<void>
 *   }>
 * }} options
 * @returns {(req: ZfbDevMiddlewareRequest) => Promise<ZfbDevMiddlewareResponse>}
 */
export function createComposerFileProviderMiddleware(options) {
  const endpoint = options.endpoint ?? COMPOSER_FILE_PROVIDER_ENDPOINT;
  const maxBodyBytes = options.maxBodyBytes ?? COMPOSER_FILE_PROVIDER_MAX_BODY_BYTES;

  /** @param {ZfbDevMiddlewareRequest} req */
  return async function composerFileProviderMiddleware(req) {
    // zfb middleware registration is prefix-based, so enforce the complete URL
    // (including the absence of query/hash suffixes) inside the handler.
    if (req.url !== endpoint) {
      return errorResponse(404, "not-found", "File-provider route not found.");
    }
    if (req.method !== "POST") {
      return errorResponse(405, "method-not-allowed", "Only POST is allowed.", undefined, { allow: "POST" });
    }
    if (!isSameOriginDevRequest(req)) {
      return errorResponse(403, "origin-rejected", "A same-origin development request is required.");
    }
    if (!hasCapability(req, options.capability)) {
      return errorResponse(401, "invalid-capability", "The development file capability is missing or invalid.");
    }
    const mediaType = req.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
    if (mediaType !== "application/json") {
      return errorResponse(415, "unsupported-media-type", "Content-Type must be application/json.");
    }
    if (bodyBytes(req.body) > maxBodyBytes) {
      return errorResponse(413, "body-too-large", `Request body exceeds the ${maxBodyBytes}-byte limit.`);
    }

    let raw;
    try {
      raw = JSON.parse(req.body ?? "");
    } catch {
      return errorResponse(400, "malformed-json", "Request body is not valid JSON.");
    }
    const envelope = validateEnvelope(raw);
    if ("error" in envelope) {
      return errorResponse(400, "invalid-request", envelope.error);
    }

    const jsxById = "jsxById" in envelope ? envelope.jsxById : Object.create(null);
    try {
      const store = await options.createStore({
        provideJsx(record) {
          const jsx = jsxById[record.id];
          if (jsx === undefined) throw new JsxRequiredError(record);
          return jsx;
        },
      });

      switch (envelope.operation) {
        case "list":
          return json(200, { ok: true, result: await store.list() });
        case "get":
          return json(200, { ok: true, result: await store.get(envelope.id) });
        case "put": {
          const validation = options.validateRecord(envelope.record);
          if (!validation.ok) {
            return errorResponse(422, "validation", validation.issue.message, "put");
          }
          await store.put(validation.record, envelope.jsx);
          return json(200, { ok: true, result: null });
        }
        case "delete":
          return json(200, { ok: true, result: await store.delete(envelope.id) });
        case "clear":
          await store.clear();
          return json(200, { ok: true, result: null });
      }
      return errorResponse(400, "invalid-request", "Unknown file-provider operation.");
    } catch (cause) {
      // The core wraps provider failures in CompositionPersistenceError so its
      // own API remains operation-specific. Walk the standard Error.cause
      // chain to recover only our private handshake sentinel.
      const jsxRequired = findJsxRequiredError(cause);
      if (jsxRequired !== undefined) {
        return json(409, {
          ok: false,
          error: {
            code: "jsx-required",
            operation: envelope.operation,
            message: "Production JSX is required to verify derived output.",
          },
          record: jsxRequired.record,
        });
      }
      return sanitizedPersistenceError(cause, envelope.operation);
    }
  };
}

async function loadFilesystemCore() {
  // The plugin is plain ESM because zfb loads local plugins directly. The core
  // is repository TypeScript with extensionless imports, so use the project's
  // existing dev-only tsx loader only when `zfb dev` actually installs the
  // middleware. `zfb build`/`preview` never load this module graph.
  const { tsImport } = await import("tsx/esm/api");
  return tsImport("../src/composer/storage/filesystem/index.ts", import.meta.url);
}

/** @type {ZfbPlugin} */
export default {
  name: "composer-file-provider",

  /** @param {ZfbSetupContext} ctx */
  setup(ctx) {
    // `setup` runs once per host boot. Rotate here (rather than at module load)
    // so two dev hosts created in one process never share a capability and a
    // production config load does not generate one at all.
    if (ctx.command === "dev") {
      serverCapability = randomBytes(32).toString("base64url");
    }
    ctx.addVirtualModule("virtual:composer-file-provider-config", () => {
      if (ctx.command !== "dev") {
        return "export const fileProviderConfig = undefined;\n";
      }
      const capability = capabilityForServer();
      return `export const fileProviderConfig = ${JSON.stringify({
        endpoint: COMPOSER_FILE_PROVIDER_ENDPOINT,
        capability,
        capabilityHeader: COMPOSER_FILE_PROVIDER_CAPABILITY_HEADER,
        maxBodyBytes: COMPOSER_FILE_PROVIDER_MAX_BODY_BYTES,
      })};\n`;
    });
  },

  /** @param {ZfbDevMiddlewareContext} ctx */
  async devMiddleware(ctx) {
    const { createFilesystemCompositionStore } = await loadFilesystemCore();
    const { validateCompositionRecord } = await import(
      "tsx/esm/api"
    ).then(({ tsImport }) => tsImport("../src/composer/library/validate.ts", import.meta.url));
    const handler = createComposerFileProviderMiddleware({
      capability: capabilityForServer(),
      validateRecord: validateCompositionRecord,
      createStore: ({ provideJsx }) => createFilesystemCompositionStore({
        compositionsRoot: resolve(ctx.projectRoot, COMPOSER_FILE_PROVIDER_ROOT),
        provideJsx,
      }),
    });
    ctx.register(COMPOSER_FILE_PROVIDER_ENDPOINT, handler);
  },
};
