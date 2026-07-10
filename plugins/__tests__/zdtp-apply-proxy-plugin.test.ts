// Exercises the apply pipeline wiring headlessly — no dev server, no
// browser. `createDevMiddlewareHandler` is the same factory
// `devMiddleware(ctx)` builds in plugins/zdtp-apply-proxy-plugin.mjs; we call
// it directly against a temp CSS fixture and assert the file is rewritten
// (or correctly left untouched on each documented error path).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import zdtpApplyProxyPlugin, {
  APPLY_PATH,
  ROUTING_FILE,
  createDevMiddlewareHandler,
  toFetchRequest,
} from "../zdtp-apply-proxy-plugin.mjs";

// Real repo root — the `setup()` dev-mode test reads the actual
// zdtp-panel-routing.json committed there (loadRoutingFromFile has no test
// seam, and duplicating a fixture routing file would drift from the real one).
const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

type SetupCtx = Parameters<NonNullable<typeof zdtpApplyProxyPlugin.setup>>[0];

function runSetup(command: "dev" | "build") {
  let virtualModuleSource = "";
  const ctx = {
    command,
    projectRoot: REPO_ROOT,
    config: {},
    options: {},
    logger: { info() {}, warn() {}, error() {} },
    addAlias() {},
    addVirtualModule(_specifier: string, loader: () => string | Promise<string>) {
      const result = loader();
      if (typeof result !== "string") {
        throw new Error("expected the zdtp-apply-config loader to be synchronous");
      }
      virtualModuleSource = result;
    },
    injectRoute() {},
    addClientEntry() {},
  } as unknown as SetupCtx;

  zdtpApplyProxyPlugin.setup?.(ctx);
  return virtualModuleSource;
}

// Mirrors the shape of packages/ui/styles/colors.css: a plain `:root` block
// holding the Tier-1 palette, plus a Tailwind v4 `@theme` block for the
// Tier-2 semantic tokens. Production routing keeps "palette" writable and
// leaves "color" unrouted; a focused test below routes "color" explicitly to
// verify zdtp's @theme rewrite path.
const COLORS_CSS_FIXTURE = `:root {
  --palette-base-0: oklch(.965 .004 65);
  --palette-base-4: oklch(.185 .005 65);   /* ink (light) */

  color-scheme: light dark;
}

@theme {
  --color-ink: light-dark(var(--palette-base-4), var(--palette-base-0));
}
`;

// Mirrors packages/ui/styles/tokens.css: entirely `@theme`, no top-level
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
    expect(css).toContain("--palette-base-4: oklch(.250 .006 65);   /* ink (light) */");
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

    const res = await post(handler, { tokens: { "--color-ink": "red" } });

    expect(res.status).toBe(400);
    const payload = JSON.parse(res.body ?? "{}");
    expect(payload.ok).toBe(false);
    expect(payload.rejected).toContain("--color-ink");
    expect(readColorsCss()).toBe(before);
  });

  it("rewrites a routed @theme var when that prefix is explicitly routed", async () => {
    // "color" IS routed here (unlike production config) specifically to
    // isolate @theme rewriting from the "unrouted prefix" case
    // above: --color-ink resolves to a file+prefix match, but the var itself
    // lives in the file's `@theme` block.
    const handler = createDevMiddlewareHandler({
      rootDir: sandbox,
      writeRoot: sandbox,
      routing: { palette: "colors.css", color: "colors.css" },
    });
    const before = readColorsCss();

    const res = await post(handler, { tokens: { "--color-ink": "red" } });

    expect(res.status).toBe(200);
    const payload = JSON.parse(res.body ?? "{}");
    expect(payload.ok).toBe(true);
    expect(payload.updated?.[0]?.changed).toContain("--color-ink");
    expect(readColorsCss()).toContain("--color-ink: red;");
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
    expect(res.headers?.allow).toContain("POST");
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

describe("ROUTING_FILE", () => {
  it("names the repo-root routing JSON consumed by both the client config and this plugin", () => {
    expect(ROUTING_FILE).toBe("zdtp-panel-routing.json");
  });
});

describe("setup() — virtual:zdtp-apply-config dev/build gating", () => {
  it("injects the real endpoint + routing map during `zfb dev`", () => {
    const source = runSetup("dev");
    expect(source).toContain(JSON.stringify(APPLY_PATH));
    expect(source).toContain('"palette"');
    expect(source).toContain("packages/ui/styles/colors.css");
  });

  it("injects nothing during `zfb build` — not even the routing map's file paths", () => {
    const source = runSetup("build");
    expect(source).toContain("applyEndpoint = undefined");
    expect(source).toContain("applyRouting = undefined");
    expect(source).not.toContain("colors.css");
    expect(source).not.toContain(APPLY_PATH);
  });
});
