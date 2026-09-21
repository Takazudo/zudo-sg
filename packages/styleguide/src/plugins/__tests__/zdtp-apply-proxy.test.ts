// Exercises the apply pipeline wiring headlessly — no dev server, no
// browser. `createDevMiddlewareHandler` is the same factory
// `devMiddleware(ctx)` builds in ../zdtp-apply-proxy.ts; we call it directly
// against a temp CSS fixture and assert the file is rewritten (or correctly
// left untouched on each documented error path).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Imported straight from zdtp so the canonical whole-payload test can drive
// the upstream handler directly, and load the real committed routing map the
// root host ships with.
import { createApplyHandler, loadRoutingFromFile } from "@takazudo/zdtp/server";
import zdtpApplyProxyPlugin, {
  APPLY_PATH,
  PLUGIN_NAME,
  VIRTUAL_MODULE_ID,
  __resetZdtpWarningForTests,
  buildVirtualModuleSource,
  createDevMiddlewareHandler,
  createZdtpApplyProxyPlugin,
  loadZdtpServer,
  resolveZdtpApplyProxyOptions,
  toFetchRequest,
  type ZdtpApplyProxyOptions,
} from "../zdtp-apply-proxy.js";

// Real repo root (packages/styleguide/src/plugins/__tests__ → five levels up).
// The dev-mode setup test reads the actual zdtp-panel-routing.json committed
// there (duplicating a fixture routing file would drift from the real one).
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const ROUTING_FILE = "zdtp-panel-routing.json";
const ROOT_OPTIONS = { routingFile: `./${ROUTING_FILE}`, writeRoot: "./packages/demo-ui/styles" };

type SetupCtx = Parameters<NonNullable<typeof zdtpApplyProxyPlugin.setup>>[0];
type DevCtx = Parameters<NonNullable<typeof zdtpApplyProxyPlugin.devMiddleware>>[0];

const missingZdtp = () => Promise.reject(new Error("Cannot find package '@takazudo/zdtp'"));

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

async function runSetup(
  command: "dev" | "build",
  options: Record<string, unknown> = ROOT_OPTIONS,
  plugin = zdtpApplyProxyPlugin,
) {
  const registrations: Array<{
    specifier: string;
    loader: () => string | Promise<string>;
    watchFiles?: string[];
  }> = [];
  const ctx = {
    command,
    projectRoot: REPO_ROOT,
    config: {},
    options,
    logger: makeLogger(),
    addAlias() {},
    addVirtualModule(
      specifier: string,
      loader: () => string | Promise<string>,
      opts?: { watchFiles?: string[] },
    ) {
      registrations.push({ specifier, loader, watchFiles: opts?.watchFiles });
    },
    injectRoute() {},
    addClientEntry() {},
  } as unknown as SetupCtx;

  await plugin.setup?.(ctx);
  expect(registrations).toHaveLength(1);
  const [registration] = registrations;
  return {
    specifier: registration!.specifier,
    watchFiles: registration!.watchFiles,
    source: await registration!.loader(),
    logger: ctx.logger as ReturnType<typeof makeLogger>,
  };
}

// Mirrors the shape of packages/demo-ui/styles/colors.css: a plain `:root` block
// holding the Tier-1 palette, plus a Tailwind v4 `@theme` block for the
// Tier-2 semantic tokens. Production routing keeps "palette" writable and
// leaves "color" unrouted; a focused test below routes "color" explicitly to
// verify zdtp's @theme rewrite path.
const COLORS_CSS_FIXTURE = `:root {
  --palette-base-0: oklch(.965 .004 65);
  --palette-base-4: oklch(.185 .005 65);   /* fg (light) */

  color-scheme: light dark;
}

@theme {
  --color-fg: light-dark(var(--palette-base-4), var(--palette-base-0));
}
`;

// Mirrors packages/demo-ui/styles/tokens.css: entirely `@theme`, no top-level
// `:root` block at all.
const TOKENS_CSS_FIXTURE = `@theme {
  --spacing-hsp-2xs: 0.125rem;
}
`;

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "zdtp-apply-proxy-"));
  writeFileSync(join(sandbox, "colors.css"), COLORS_CSS_FIXTURE);
  writeFileSync(join(sandbox, "tokens.css"), TOKENS_CSS_FIXTURE);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function readColorsCss() {
  return readFileSync(join(sandbox, "colors.css"), "utf-8");
}

function post(
  handler: ReturnType<typeof createDevMiddlewareHandler>,
  body: unknown,
) {
  return handler({
    method: "POST",
    url: APPLY_PATH,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("createDevMiddlewareHandler", () => {
  it("rewrites a routed :root token and preserves surrounding formatting", async () => {
    const handler = createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: sandbox,
      routing: { palette: "colors.css" },
    });

    const res = await post(handler, {
      tokens: { "--palette-base-4": "oklch(.250 .006 65)" },
    });

    expect(res.status).toBe(200);
    const payload = JSON.parse(res.body ?? "{}");
    expect(payload.ok).toBe(true);

    const css = readColorsCss();
    expect(css).toContain("--palette-base-4: oklch(.250 .006 65);   /* fg (light) */");
    // Everything else is untouched — a minimal, single-declaration diff.
    expect(css).toContain("--palette-base-0: oklch(.965 .004 65);");
    expect(css).toContain("color-scheme: light dark;");
    expect(css).toContain("@theme {");
  });

  it("is idempotent: re-applying the same value reports unchanged", async () => {
    const handler = createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: sandbox,
      routing: { palette: "colors.css" },
    });

    await post(handler, { tokens: { "--palette-base-4": "oklch(.250 .006 65)" } });
    const afterFirst = readColorsCss();

    const second = await post(handler, {
      tokens: { "--palette-base-4": "oklch(.250 .006 65)" },
    });
    const payload = JSON.parse(second.body ?? "{}");

    expect(payload.ok).toBe(true);
    expect(payload.unchangedCssVars).toContain("--palette-base-4");
    expect(readColorsCss()).toBe(afterFirst);
  });

  it("rejects an unrouted prefix (unknown token) and leaves the file untouched", async () => {
    const handler = createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: sandbox,
      routing: { palette: "colors.css" },
    });
    const before = readColorsCss();

    const res = await post(handler, { tokens: { "--color-fg": "red" } });

    expect(res.status).toBe(400);
    const payload = JSON.parse(res.body ?? "{}");
    expect(payload.ok).toBe(false);
    expect(payload.rejected).toContain("--color-fg");
    expect(readColorsCss()).toBe(before);
  });

  it("rewrites a routed @theme var when that prefix is explicitly routed", async () => {
    // "color" IS routed here (unlike production config) specifically to
    // isolate @theme rewriting from the "unrouted prefix" case
    // above: --color-fg resolves to a file+prefix match, but the var itself
    // lives in the file's `@theme` block.
    const handler = createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: sandbox,
      routing: { palette: "colors.css", color: "colors.css" },
    });
    const before = readColorsCss();

    const res = await post(handler, { tokens: { "--color-fg": "red" } });

    expect(res.status).toBe(200);
    const payload = JSON.parse(res.body ?? "{}");
    expect(payload.ok).toBe(true);
    expect(payload.updated?.[0]?.changed).toContain("--color-fg");
    expect(readColorsCss()).toContain("--color-fg: red;");
  });

  it("rejects a routing entry whose path escapes the write-root (invalid token path)", async () => {
    const handler = createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: join(sandbox, "locked-down"),
      routing: { palette: "colors.css" },
    });
    const before = readColorsCss();

    const res = await post(handler, {
      tokens: { "--palette-base-4": "oklch(.250 .006 65)" },
    });

    expect(res.status).toBe(400);
    const payload = JSON.parse(res.body ?? "{}");
    expect(payload.ok).toBe(false);
    expect(String(payload.error)).toContain("Path not allowed");
    expect(readColorsCss()).toBe(before);
  });

  it("rewrites a file with only a top-level @theme block", async () => {
    const handler = createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: sandbox,
      routing: { spacing: "tokens.css" },
    });
    const before = readFileSync(join(sandbox, "tokens.css"), "utf-8");

    const res = await post(handler, { tokens: { "--spacing-hsp-2xs": "0.25rem" } });

    expect(res.status).toBe(200);
    const payload = JSON.parse(res.body ?? "{}");
    expect(payload.ok).toBe(true);
    expect(payload.updated?.[0]?.changed).toContain("--spacing-hsp-2xs");
    const after = readFileSync(join(sandbox, "tokens.css"), "utf-8");
    expect(after).toContain("--spacing-hsp-2xs: 0.25rem;");
    expect(after).not.toBe(before);
  });

  it("rejects non-POST methods without touching the apply pipeline", async () => {
    const handler = createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: sandbox,
      routing: { palette: "colors.css" },
    });
    const before = readColorsCss();

    const res = await handler({ method: "GET", url: APPLY_PATH, headers: {} });

    expect(res.status).toBe(405);
    expect(readColorsCss()).toBe(before);
  });

  it("answers OPTIONS with 204 instead of 405, without touching the apply pipeline", async () => {
    const handler = createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: sandbox,
      routing: { palette: "colors.css" },
    });
    const before = readColorsCss();

    const res = await handler({ method: "OPTIONS", url: APPLY_PATH, headers: {} });

    expect(res.status).toBe(204);
    // Must advertise OPTIONS itself, not just POST — otherwise a regression of
    // ALLOWED_METHODS back to "POST" would still pass. 204 carries no body.
    expect(res.headers?.allow).toContain("POST");
    expect(res.headers?.allow).toContain("OPTIONS");
    expect(res.body ?? "").toBe("");
    expect(readColorsCss()).toBe(before);
  });

  it("returns 400 for a malformed JSON body", async () => {
    const handler = createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: sandbox,
      routing: { palette: "colors.css" },
    });

    const res = await handler({
      method: "POST",
      url: APPLY_PATH,
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    expect(res.status).toBe(400);
  });

  it("returns zdtp's 400 for an empty tokens object", async () => {
    const handler = createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: sandbox,
      routing: { palette: "colors.css" },
    });
    const before = readColorsCss();

    const res = await post(handler, { tokens: {} });

    expect(res.status).toBe(400);
    const payload = JSON.parse(res.body ?? "{}");
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("at least one entry");
    expect(readColorsCss()).toBe(before);
  });
});

describe("toFetchRequest", () => {
  it("carries method/headers/body through to a standard Request", async () => {
    const req = toFetchRequest({
      method: "POST",
      url: APPLY_PATH,
      headers: { "content-type": "application/json" },
      body: '{"tokens":{}}',
    });
    expect(req.method).toBe("POST");
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(await req.text()).toBe('{"tokens":{}}');
  });

  it("omits the body for GET/HEAD (Request throws if a body is set on them)", () => {
    expect(() =>
      toFetchRequest({ method: "GET", url: APPLY_PATH, headers: {}, body: "ignored" }),
    ).not.toThrow();
  });
});

describe("plugin identity", () => {
  it("is named after its package subpath (the zudoSg() descriptor name)", () => {
    expect(zdtpApplyProxyPlugin.name).toBe(PLUGIN_NAME);
    expect(PLUGIN_NAME).toBe("@takazudo/zudo-sg/plugins/zdtp-apply-proxy");
  });
});

describe("resolveZdtpApplyProxyOptions", () => {
  it("resolves routingFile / writeRoot / tabsModule against the project root", () => {
    const resolved = resolveZdtpApplyProxyOptions(REPO_ROOT, {
      ...ROOT_OPTIONS,
      tabsModule: "./src/config/preview-token-panel-tabs.ts",
    });
    expect(resolved).toEqual({
      enabled: true,
      routingFile: `${REPO_ROOT}/${ROUTING_FILE}`,
      writeRoot: `${REPO_ROOT}/packages/demo-ui/styles`,
      tabsModule: `${REPO_ROOT}/src/config/preview-token-panel-tabs.ts`,
    });
  });

  it("is disabled (not an error) when neither routingFile nor writeRoot is given — zudoSg() without zdtpApplyProxy", () => {
    expect(resolveZdtpApplyProxyOptions(REPO_ROOT, {})).toEqual({ enabled: false, tabsModule: undefined });
  });

  it("resolves { tabsModule } alone to disabled with tabsModule preserved — the tabs-only option (#815)", () => {
    // Type-level proof that `ZdtpApplyProxyOptions` accepts `{ tabsModule }`
    // without `routingFile`/`writeRoot` (`pnpm check` fails to compile this
    // file otherwise); the assignment below is the AC's other half —
    // resolution behaves the same as the untyped `{}` case above, plus tabs.
    const tabsOnly: ZdtpApplyProxyOptions = {
      tabsModule: "./src/config/preview-token-panel-tabs.ts",
    };
    expect(resolveZdtpApplyProxyOptions(REPO_ROOT, tabsOnly)).toEqual({
      enabled: false,
      tabsModule: `${REPO_ROOT}/src/config/preview-token-panel-tabs.ts`,
    });
  });

  it("requires routingFile and writeRoot", () => {
    expect(() => resolveZdtpApplyProxyOptions(REPO_ROOT, { writeRoot: "./packages/demo-ui/styles" })).toThrow(
      '[zudo-sg] option "routingFile" is required',
    );
    expect(() => resolveZdtpApplyProxyOptions(REPO_ROOT, { routingFile: `./${ROUTING_FILE}` })).toThrow(
      '[zudo-sg] option "writeRoot" is required',
    );
  });

  it("rejects a missing routing file and a writeRoot that is not a directory", () => {
    expect(() =>
      resolveZdtpApplyProxyOptions(REPO_ROOT, { ...ROOT_OPTIONS, routingFile: "./nope.json" }),
    ).toThrow("which is not a file");
    expect(() =>
      resolveZdtpApplyProxyOptions(REPO_ROOT, { ...ROOT_OPTIONS, writeRoot: `./${ROUTING_FILE}` }),
    ).toThrow("which is not a directory");
  });

  it("type-checks routingFile/writeRoot as optional TOGETHER, not independently (#815)", () => {
    // `pnpm check` (tsc), not vitest, is what proves these — vitest's oxc
    // transformer strips types without checking them. Kept as assignments
    // (never called) so `@ts-expect-error` pins the exact rejected shapes.
    const bothGiven: ZdtpApplyProxyOptions = ROOT_OPTIONS;
    const neitherGiven: ZdtpApplyProxyOptions = { tabsModule: "./tabs.ts" };
    // @ts-expect-error routingFile without writeRoot must not type-check
    const routingFileOnly: ZdtpApplyProxyOptions = { routingFile: `./${ROUTING_FILE}` };
    // @ts-expect-error writeRoot without routingFile must not type-check
    const writeRootOnly: ZdtpApplyProxyOptions = { writeRoot: "./packages/demo-ui/styles" };
    void bothGiven;
    void neitherGiven;
    void routingFileOnly;
    void writeRootOnly;
  });
});

describe(`setup() — ${VIRTUAL_MODULE_ID} dev/build gating`, () => {
  it("injects the real endpoint + routing map during `zfb dev` and watches the routing file", async () => {
    const { specifier, source, watchFiles } = await runSetup("dev");
    expect(specifier).toBe(VIRTUAL_MODULE_ID);
    expect(source).toContain(JSON.stringify(APPLY_PATH));
    expect(source).toContain('"palette"');
    expect(source).toContain("packages/demo-ui/styles/colors.css");
    expect(watchFiles).toEqual([`${REPO_ROOT}/${ROUTING_FILE}`]);
  });

  it("injects nothing during `zfb build` — not even the routing map's file paths", async () => {
    const { source } = await runSetup("build");
    expect(source).toContain("applyEndpoint = undefined");
    expect(source).toContain("applyRouting = undefined");
    expect(source).not.toContain("colors.css");
    expect(source).not.toContain(APPLY_PATH);
  });

  it("re-exports `tabs` from the host tabsModule in every command, else exports undefined", async () => {
    const withTabs = await runSetup("build", {
      ...ROOT_OPTIONS,
      tabsModule: "./src/config/preview-token-panel-tabs.ts",
    });
    expect(withTabs.source).toContain(
      `export { tabs } from ${JSON.stringify(`${REPO_ROOT}/src/config/preview-token-panel-tabs.ts`)};`,
    );
    const withoutTabs = await runSetup("dev");
    expect(withoutTabs.source).toContain("export const tabs = undefined;");
  });

  it("a disabled plugin still registers the virtual module, with no Apply wiring even in dev", async () => {
    const { source, watchFiles } = await runSetup("dev", {});
    expect(source).toContain("export const tabs = undefined;");
    expect(source).toContain("applyEndpoint = undefined");
    expect(source).toContain("applyRouting = undefined");
    expect(watchFiles).toBeUndefined();
  });

  it("fails fast at setup() when an option does not resolve", async () => {
    await expect(runSetup("build", { ...ROOT_OPTIONS, tabsModule: "./missing.ts" })).rejects.toThrow(
      '[zudo-sg] option "tabsModule" = "./missing.ts"',
    );
  });
});

describe("@takazudo/zdtp server import failure guards", () => {
  beforeEach(() => __resetZdtpWarningForTests());

  it("loadZdtpServer resolves null and warns once when the import rejects", async () => {
    const logger = makeLogger();
    await expect(loadZdtpServer(logger, missingZdtp)).resolves.toBeNull();
    await expect(loadZdtpServer(logger, missingZdtp)).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(String(logger.warn.mock.calls[0]?.[0])).toContain("@takazudo/zdtp is not installed");
  });

  it("the dev virtual module degrades to undefined apply fields without zdtp", async () => {
    const { source, logger } = await runSetup("dev", ROOT_OPTIONS, createZdtpApplyProxyPlugin(missingZdtp));
    expect(source).toContain("applyEndpoint = undefined");
    expect(source).toContain("applyRouting = undefined");
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("buildVirtualModuleSource never imports zdtp for a build", async () => {
    const importer = vi.fn(missingZdtp);
    const resolved = resolveZdtpApplyProxyOptions(REPO_ROOT, ROOT_OPTIONS);
    await buildVirtualModuleSource("build", resolved, makeLogger(), importer);
    expect(importer).not.toHaveBeenCalled();
  });

  it("devMiddleware still registers; POST answers 503 and writes nothing", async () => {
    const handlers = new Map<string, (req: Parameters<ReturnType<typeof createDevMiddlewareHandler>>[0]) => unknown>();
    const ctx = {
      projectRoot: REPO_ROOT,
      config: {},
      options: ROOT_OPTIONS,
      logger: makeLogger(),
      register(path: string, handler: never) {
        handlers.set(path, handler);
      },
    } as unknown as DevCtx;
    await createZdtpApplyProxyPlugin(missingZdtp).devMiddleware?.(ctx);
    const handler = handlers.get(APPLY_PATH);
    expect(handler).toBeDefined();

    const res = (await handler!({
      method: "POST",
      url: APPLY_PATH,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokens: { "--palette-base-4": "red" } }),
    })) as { status: number; body?: string };
    expect(res.status).toBe(503);
    expect(JSON.parse(res.body ?? "{}")).toEqual({ ok: false, error: "@takazudo/zdtp is not installed" });
  });

  it("createDevMiddlewareHandler answers 503 without touching the sandbox", async () => {
    const handler = createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: sandbox,
      routing: { palette: "colors.css" },
      importer: missingZdtp,
      logger: makeLogger(),
    });
    const before = readColorsCss();
    const res = await post(handler, { tokens: { "--palette-base-4": "oklch(.250 .006 65)" } });
    expect(res.status).toBe(503);
    expect(readColorsCss()).toBe(before);
  });
});

// ── Routing extension + native same-file coalescing ────────────────────────
// These exercise the plugin against the REAL committed zdtp-panel-routing.json
// (not a hand-written fixture map, which would drift), writing into temp
// fixtures shaped like the real @theme/:root blocks. The write-root is nested
// so the real routing map's `packages/demo-ui/styles/*.css` relative paths resolve
// exactly as they do in the running dev server.
const REAL_ROUTING = loadRoutingFromFile(join(REPO_ROOT, ROUTING_FILE));
const STYLES_REL = "packages/demo-ui/styles";

// Shaped like packages/demo-ui/styles/colors.css: Tier-1 palette in a `:root` block,
// Tier-2 `--color-*` (a light-dark() expression) in the `@theme` block.
const REAL_COLORS_FIXTURE = `:root {
  --palette-base-0: oklch(.965 .004 65);
  --palette-base-4: oklch(.185 .005 65);

  color-scheme: light dark;
}

@theme {
  --color-fg: light-dark(var(--palette-base-4), var(--palette-base-0));
}
`;

// Shaped like packages/demo-ui/styles/tokens.css: one `@theme` block carrying one
// representative variable from each routed family. --shadow-card is
// deliberately a multi-line, multi-layer value with commas inside oklch() to
// exercise the value scanner.
const REAL_TOKENS_FIXTURE = `@theme {
  --spacing-hsp-md: 0.75rem;

  --text-body: 1.25rem;

  --font-weight-bold: 700;

  --leading-snug: 1.4;

  --radius-md: 0.5rem;

  --shadow-card:
    0 0.5px 1px oklch(.185 .005 65 / 0.05),
    0 2px 4px oklch(.185 .005 65 / 0.05);
}
`;

describe("zdtp-panel-routing.json (committed routing map)", () => {
  it("routes palette + color to colors.css and the tokens.css families", () => {
    expect(REAL_ROUTING).toMatchObject({
      palette: "packages/demo-ui/styles/colors.css",
      color: "packages/demo-ui/styles/colors.css",
      spacing: "packages/demo-ui/styles/tokens.css",
      text: "packages/demo-ui/styles/tokens.css",
      font: "packages/demo-ui/styles/tokens.css",
      leading: "packages/demo-ui/styles/tokens.css",
      radius: "packages/demo-ui/styles/tokens.css",
      shadow: "packages/demo-ui/styles/tokens.css",
    });
  });

  it("does NOT route breakpoint or default-transition prefixes (Tailwind plumbing)", () => {
    expect(REAL_ROUTING).not.toHaveProperty("breakpoint");
    expect(REAL_ROUTING).not.toHaveProperty("default-transition");
  });
});

describe("apply routing — real map + native whole-payload coalescing", () => {
  const stylesDir = () => join(sandbox, STYLES_REL);
  const readReal = (file: "colors.css" | "tokens.css") =>
    readFileSync(join(stylesDir(), file), "utf-8");

  function realHandler() {
    return createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: stylesDir(),
      routing: REAL_ROUTING,
    });
  }

  // Raw zdtp handler — the upstream factory used by the plugin. The canonical
  // whole-payload regression below verifies native same-file coalescing.
  function rawHandler() {
    return createApplyHandler({
      rootDir: sandbox,
      writeRoot: stylesDir(),
      routing: REAL_ROUTING,
    });
  }

  async function postRaw(
    handler: ReturnType<typeof createApplyHandler>,
    tokens: Record<string, string>,
  ) {
    const res = await handler(
      toFetchRequest({
        method: "POST",
        url: APPLY_PATH,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokens }),
      }),
    );
    return { status: res.status, json: JSON.parse(await res.text()) };
  }

  beforeEach(() => {
    // The module-level beforeEach already created `sandbox`; add the nested
    // styles dir the real routing paths resolve into.
    mkdirSync(stylesDir(), { recursive: true });
    writeFileSync(join(stylesDir(), "colors.css"), REAL_COLORS_FIXTURE);
    writeFileSync(join(stylesDir(), "tokens.css"), REAL_TOKENS_FIXTURE);
  });

  it("(a) --spacing-hsp-md override lands in tokens.css's @theme block", async () => {
    const res = await post(realHandler(), {
      tokens: { "--spacing-hsp-md": "0.9rem" },
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body ?? "{}").ok).toBe(true);
    expect(readReal("tokens.css")).toContain("--spacing-hsp-md: 0.9rem;");
  });

  it("(b) --shadow-card multi-value (commas inside oklch()) round-trips correctly", async () => {
    const NEW_SHADOW =
      "0 1px 3px oklch(.185 .005 65 / 0.08), 0 6px 12px oklch(.185 .005 65 / 0.09)";
    const res = await post(realHandler(), {
      tokens: { "--shadow-card": NEW_SHADOW },
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body ?? "{}").ok).toBe(true);
    const css = readReal("tokens.css");
    // Commas survive, exactly one terminating `;`, no stray split at the comma.
    expect(css).toContain(`${NEW_SHADOW};`);
  });

  it("(c) --color-fg light-dark() expression is overwritten with a literal", async () => {
    expect(readReal("colors.css")).toContain("--color-fg: light-dark(");
    const res = await post(realHandler(), {
      tokens: { "--color-fg": "oklch(.3 .01 65)" },
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body ?? "{}").ok).toBe(true);
    const css = readReal("colors.css");
    expect(css).toContain("--color-fg: oklch(.3 .01 65);");
    expect(css).not.toContain("--color-fg: light-dark(");
  });

  it("RAW createApplyHandler applies one whole payload across both target files", async () => {
    const newValues = {
      "--palette-base-4": "oklch(.250 .006 65)",
      "--color-fg": "red",
      "--spacing-hsp-md": "0.8rem",
      "--text-body": "1.5rem",
      "--font-weight-bold": "800",
      "--leading-snug": "1.6",
      "--radius-md": "0.75rem",
      "--shadow-card":
        "0 1px 2px oklch(.2 .01 65 / 0.1), 0 4px 8px oklch(.2 .01 65 / 0.1)",
    };
    const { status, json } = await postRaw(rawHandler(), newValues);

    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.unknownCssVars).toEqual([]);
    expect(json.unchangedCssVars).toEqual([]);
    expect(json.unknownOutsideBlockCssVars).toEqual([]);
    expect(readReal("colors.css")).toContain(
      "--palette-base-4: oklch(.250 .006 65);",
    );
    expect(readReal("colors.css")).toContain("--color-fg: red;");
    expect(readReal("tokens.css")).toContain("--spacing-hsp-md: 0.8rem;");
    expect(readReal("tokens.css")).toContain("--text-body: 1.5rem;");
    expect(readReal("tokens.css")).toContain("--font-weight-bold: 800;");
    expect(readReal("tokens.css")).toContain("--leading-snug: 1.6;");
    expect(readReal("tokens.css")).toContain("--radius-md: 0.75rem;");
    expect(readReal("tokens.css")).toContain(`${newValues["--shadow-card"]};`);

    const rows = json.updated as Array<{
      file: string;
      changed: string[];
      unchanged: string[];
      unknown: string[];
      unknownOutsideBlock: string[];
    }>;
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.file)).size).toBe(2);
    expect(rows.map((row) => row.file).sort()).toEqual([
      "packages/demo-ui/styles/colors.css",
      "packages/demo-ui/styles/tokens.css",
    ]);

    const colorsRow = rows.find((row) => row.file.endsWith("colors.css"));
    const tokensRow = rows.find((row) => row.file.endsWith("tokens.css"));
    expect(colorsRow?.changed).toEqual(["--palette-base-4", "--color-fg"]);
    expect(tokensRow?.changed).toEqual([
      "--spacing-hsp-md",
      "--text-body",
      "--font-weight-bold",
      "--leading-snug",
      "--radius-md",
      "--shadow-card",
    ]);
    for (const row of rows) {
      expect(row.unchanged).toEqual([]);
      expect(row.unknown).toEqual([]);
      expect(row.unknownOutsideBlock).toEqual([]);
    }
  });

  it("mixed-file POST (--palette-* + --spacing-*) succeeds and updates both files", async () => {
    const res = await post(realHandler(), {
      tokens: {
        "--palette-base-0": "oklch(.9 .01 65)",
        "--spacing-hsp-md": "0.7rem",
      },
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body ?? "{}").ok).toBe(true);
    expect(readReal("colors.css")).toContain("--palette-base-0: oklch(.9 .01 65);");
    expect(readReal("tokens.css")).toContain("--spacing-hsp-md: 0.7rem;");
  });

  it("computes every routed file before writing when a later file has no token block", async () => {
    const colorsBefore = readReal("colors.css");
    writeFileSync(join(stylesDir(), "tokens.css"), "/* no :root or @theme block */\n");

    const res = await post(realHandler(), {
      tokens: {
        "--palette-base-4": "oklch(.250 .006 65)",
        "--spacing-hsp-md": "0.8rem",
      },
    });

    expect(res.status).toBe(409);
    const payload = JSON.parse(res.body ?? "{}");
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("No top-level");
    expect(readReal("colors.css")).toBe(colorsBefore);
  });

  it("still returns zdtp's single 400 when the POST carries an unroutable prefix", async () => {
    const before = readReal("colors.css");
    const res = await post(realHandler(), {
      tokens: {
        "--palette-base-4": "oklch(.250 .006 65)",
        "--breakpoint-sm": "700px",
      },
    });
    expect(res.status).toBe(400);
    const payload = JSON.parse(res.body ?? "{}");
    expect(payload.ok).toBe(false);
    expect(payload.rejected).toContain("--breakpoint-sm");
    // Error contract unchanged: nothing is written on rejection.
    expect(readReal("colors.css")).toBe(before);
  });
});
