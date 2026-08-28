import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { isAbsolute, resolve } from "node:path";

const MIN_PORT = 1;
const MAX_PORT = 65_535;
const DERIVED_PORT_BASE = 20_000;
const DERIVED_BUCKET_COUNT = 2_000;
const PORTS_PER_PROJECT = 16;

/**
 * The legacy ports are kept for CI, where a stable port makes the Playwright
 * output and external CI tooling easier to consume. Local runs use the same
 * offsets inside a deterministic per-checkout block.
 */
export const E2E_SERVER_ENTRIES = Object.freeze({
  root: Object.freeze({ env: "ZUDO_SG_SMOKE_PORT", legacyPort: 4_700, offset: 0 }),
  demo: Object.freeze({ env: "ZUDO_SG_DEMO_SMOKE_PORT", legacyPort: 4_701, offset: 1 }),
  "file-dev": Object.freeze({
    env: "ZUDO_SG_COMPOSER_FILE_PORT",
    legacyPort: 4_702,
    offset: 2,
  }),
  persistence: Object.freeze({
    env: "ZUDO_SG_COMPOSER_PERSISTENCE_PORT",
    legacyPort: 4_703,
    offset: 3,
  }),
  verification: Object.freeze({
    env: "ZUDO_SG_COMPOSER_VERIFICATION_PORT",
    legacyPort: 4_704,
    offset: 4,
  }),
  "prose-window-blur": Object.freeze({
    env: "ZUDO_SG_PROSE_WINDOW_BLUR_PORT",
    legacyPort: 4_713,
    offset: 13,
  }),
});

const ENTRY_ALIASES = Object.freeze({
  file: "file-dev",
  "composer-file": "file-dev",
  "composer-file-dev": "file-dev",
  "composer-persistence": "persistence",
  "composer-verification": "verification",
  "prose-blur": "prose-window-blur",
  "prose-window": "prose-window-blur",
});

function entryMetadata(options = {}) {
  const requestedEntry = options.entry ?? options.name ?? "root";
  const entryName =
    typeof requestedEntry === "string"
      ? requestedEntry
      : requestedEntry?.name ?? requestedEntry?.entry ?? "root";
  const canonicalEntry = ENTRY_ALIASES[entryName] ?? entryName;
  const metadata = E2E_SERVER_ENTRIES[canonicalEntry] ?? {};
  const entryObject = requestedEntry && typeof requestedEntry === "object" ? requestedEntry : {};

  return {
    name: canonicalEntry,
    envName:
      options.envName ??
      options.portEnv ??
      options.envVar ??
      options.envKey ??
      options.portEnvVar ??
      entryObject.envName ??
      entryObject.env ??
      metadata.env,
    legacyPort:
      options.legacyPort ?? options.defaultPort ?? entryObject.legacyPort ?? metadata.legacyPort,
    offset: options.offset ?? entryObject.offset ?? metadata.offset,
  };
}

function valueForError(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === undefined) return "undefined";
  return String(value);
}

/**
 * Parse and validate a port value. Environment and command-line values are
 * intentionally restricted to decimal integers so values such as `1e3` or
 * `4700.5` cannot silently select a surprising port.
 */
export function validatePort(value) {
  const validNumber =
    typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);
  const validString =
    typeof value === "string" && /^\d+$/.test(value.trim()) && value.trim().length > 0;

  if (!validNumber && !validString) {
    throw new Error(
      `Invalid port ${valueForError(value)}: expected an integer between ${MIN_PORT} and ${MAX_PORT}.`,
    );
  }

  const port = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(
      `Invalid port ${valueForError(value)}: expected an integer between ${MIN_PORT} and ${MAX_PORT}.`,
    );
  }
  return port;
}

function projectRootFor(options) {
  const projectRoot = options.projectRoot ?? process.cwd();
  if (typeof projectRoot !== "string" || projectRoot.length === 0) {
    throw new Error("projectRoot must be a non-empty path.");
  }
  return projectRoot;
}

function deriveLocalPort(projectRoot, offset, realpath = fs.realpathSync) {
  const realProjectRoot = realpath(projectRoot);
  const digest = createHash("sha256").update(realProjectRoot).digest();
  const bucket = digest.readUInt32BE(0) % DERIVED_BUCKET_COUNT;
  const blockBase = DERIVED_PORT_BASE + bucket * PORTS_PER_PROJECT;
  return validatePort(blockBase + offset);
}

/**
 * Resolve the port for one of the six E2E server entries.
 *
 * Entry-specific environment variables take precedence even in CI. Without
 * an override, CI retains the legacy port; local runs derive a stable block
 * from the checkout's real path so concurrent worktrees do not normally share
 * a port.
 */
export function resolveE2EPort(options = {}) {
  const metadata = entryMetadata(options);
  const env = options.env ?? process.env;
  const override = metadata.envName === undefined ? undefined : env?.[metadata.envName];
  if (override !== undefined) return validatePort(override);

  const isCi =
    options.ci ??
    options.isCI ??
    options.inCI ??
    (env?.CI !== undefined ? Boolean(env.CI) : undefined);
  const legacyPort = metadata.legacyPort;
  if (isCi) return validatePort(legacyPort);

  const legacyPortNumber = legacyPort === undefined ? undefined : validatePort(legacyPort);
  const defaultOffset =
    metadata.offset ??
    (legacyPortNumber === undefined ? 0 : legacyPortNumber - 4_700);
  const realpath = options.realpath ?? options.realpathSync ?? fs.realpathSync;
  if (typeof realpath !== "function") throw new Error("realpath must be a function.");
  return deriveLocalPort(projectRootFor(options), defaultOffset, realpath);
}

function absolutePath(pathValue, projectRoot = process.cwd()) {
  if (typeof pathValue !== "string" || pathValue.length === 0) {
    throw new Error("distPath must be a non-empty path.");
  }
  return isAbsolute(pathValue) ? pathValue : resolve(projectRoot, pathValue);
}

function statusFromOptions(options) {
  if (typeof options.status === "string") {
    if (["present", "missing", "not-directory"].includes(options.status)) return options.status;
    throw new Error(`Unknown static build output status: ${options.status}.`);
  }

  if (options.present === false || options.exists === false) return "missing";
  if (typeof options.isDirectory === "boolean") {
    return options.isDirectory ? "present" : "not-directory";
  }
  if (typeof options.directory === "boolean") {
    return options.directory ? "present" : "not-directory";
  }
  if (typeof options.exists === "boolean") {
    return options.exists ? "not-directory" : "missing";
  }
  if (typeof options.present === "boolean") {
    return options.present ? "present" : "missing";
  }

  // `stat` is useful for callers that already performed the synchronous
  // probe, while keeping the decision itself independent of the filesystem.
  if (options.stat && typeof options.stat.isDirectory === "function") {
    return options.stat.isDirectory() ? "present" : "not-directory";
  }

  // A statSync injection makes this small decision helper convenient to use
  // directly in tests without coupling them to the process filesystem. The
  // production static helper always supplies the state from its own probe.
  if (typeof options.statSync === "function") {
    try {
      const stat = options.statSync();
      return stat.isDirectory() ? "present" : "not-directory";
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return "missing";
      throw error;
    }
  }

  throw new Error("decideStaticPreviewGuard requires a present/isDirectory decision.");
}

function staticGuardMessage(status, distPath, buildCommand) {
  const firstClause =
    status === "not-directory" ? "Static build output is not a directory" : "Missing static build output";
  return `[e2e server isolation] ${firstClause}: ${distPath}\nRun \`${buildCommand}\` in this checkout before Playwright.\nRefusing to attach to any existing server because this run must test this checkout's build.`;
}

/**
 * Decide whether a static preview's build output is usable.
 *
 * Callers may provide `present`/`isDirectory` (or an equivalent status) after
 * doing their own synchronous probe. The returned message is exactly the
 * message thrown by createStaticPreviewServer for the two failure states.
 */
export function decideStaticPreviewGuard(options = {}) {
  const projectRoot = options.projectRoot ?? process.cwd();
  const distPath = absolutePath(
    options.distPath ?? options.dist ?? options.outputPath ?? options.path,
    projectRoot,
  );
  const buildCommand = options.buildCommand ?? "pnpm build";
  const status = statusFromOptions(options);
  const message = status === "present" ? null : staticGuardMessage(status, distPath, buildCommand);

  return {
    ok: status === "present",
    status,
    distPath,
    message,
  };
}

function probeStaticOutput(distPath) {
  try {
    return { present: true, isDirectory: fs.statSync(distPath).isDirectory() };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return { present: false, isDirectory: false };
    }
    throw error;
  }
}

function interpolate(value, port, origin) {
  if (typeof value === "function") return value({ port, origin });
  if (typeof value !== "string") return value;
  return value
    .replace(/\{\{port\}\}|\{port\}/g, String(port))
    .replace(/\{\{origin\}\}|\{origin\}/g, origin);
}

function pathURL(origin, pathValue) {
  const path = pathValue ?? "/";
  if (typeof path !== "string") throw new Error("urlPath must be a string.");
  if (/^https?:\/\//.test(path)) return path;
  return `${origin}/${path.replace(/^\/+/, "")}`;
}

function createWebServer(options, port, origin, defaultCommand) {
  const command = interpolate(
    options.command ?? defaultCommand,
    port,
    origin,
  );
  const url = interpolate(
    options.url ?? pathURL(origin, options.urlPath ?? options.path),
    port,
    origin,
  );

  const webServer = {
    ...(options.webServer ?? {}),
    command,
    url,
    reuseExistingServer: false,
    ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
    cwd: options.cwd ?? projectRootFor(options),
  };
  return webServer;
}

function createServer(options = {}, { staticPreview }) {
  const port = resolveE2EPort(options);
  const host = options.host ?? "localhost";
  const origin = `http://${host}:${port}`;

  if (staticPreview) {
    const projectRoot = projectRootFor(options);
    const distPath = absolutePath(options.distPath ?? options.dist ?? "dist", projectRoot);
    const guard = decideStaticPreviewGuard({
      distPath,
      buildCommand: options.buildCommand ?? "pnpm build",
      ...probeStaticOutput(distPath),
    });
    if (!guard.ok) throw new Error(guard.message);
  }

  const defaultCommand = staticPreview
    ? "pnpm exec zfb preview --port {port}"
    : "pnpm exec zfb dev --port {port}";
  return { port, origin, webServer: createWebServer(options, port, origin, defaultCommand) };
}

/**
 * Create a Playwright webServer entry for a pre-built static preview.
 * The build output is checked synchronously before Playwright can probe or
 * reuse a server on the configured port.
 */
export function createStaticPreviewServer(options = {}) {
  return createServer(options, { staticPreview: true });
}

/**
 * Create a Playwright webServer entry for a checkout-local dev server. This
 * deliberately performs no dist lookup; the composer-file server is meant to
 * boot from a clean checkout with no build output.
 */
export function createDevServer(options = {}) {
  return createServer(options, { staticPreview: false });
}

/**
 * Read the optional --port argument from a process argument vector. Unknown
 * arguments are ignored so this can be shared by the thin launcher wrapper.
 */
export function parsePortArg(argv = [], fallback = 4_702) {
  if (!Array.isArray(argv)) throw new Error("argv must be an array.");
  const fallbackPort = validatePort(fallback);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--port") {
      const value = argv[index + 1];
      if (value === undefined || (typeof value === "string" && value.startsWith("--"))) {
        throw new Error("Missing value for --port.");
      }
      return validatePort(value);
    }
    if (typeof argument === "string" && argument.startsWith("--port=")) {
      return validatePort(argument.slice("--port=".length));
    }
  }

  return fallbackPort;
}
