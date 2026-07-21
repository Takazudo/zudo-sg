// Exercises the apply pipeline wiring headlessly — no dev server, no
// browser. `createDevMiddlewareHandler` is the same factory
// `devMiddleware(ctx)` builds in plugins/zdtp-apply-proxy-plugin.mjs; we call
// it directly against a temp CSS fixture and assert the file is rewritten
// (or correctly left untouched on each documented error path).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
// Imported straight from zdtp so the same-file tests can drive the RAW,
// un-shimmed handler (to prove the clobber) alongside the shimmed one, and
// load the real committed routing map the plugin ships with.
import { createApplyHandler, loadRoutingFromFile } from "@takazudo/zdtp/server";
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
  --palette-base-4: oklch(.185 .005 65);   /* fg (light) */

  color-scheme: light dark;
}

@theme {
  --color-fg: light-dark(var(--palette-base-4), var(--palette-base-0));
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

// ── Routing extension + same-file coalescing shim ─────────────────────────
// These exercise the plugin against the REAL committed zdtp-panel-routing.json
// (not a hand-written fixture map, which would drift), writing into temp
// fixtures shaped like the real @theme/:root blocks. The write-root is nested
// so the real routing map's `packages/ui/styles/*.css` relative paths resolve
// exactly as they do in the running dev server.
const REAL_ROUTING = loadRoutingFromFile(join(REPO_ROOT, ROUTING_FILE));
const STYLES_REL = "packages/ui/styles";

// Shaped like packages/ui/styles/colors.css: Tier-1 palette in a `:root` block,
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

// Shaped like packages/ui/styles/tokens.css: one `@theme` block carrying the
// spacing/font/shadow families. --shadow-card is deliberately a multi-line,
// multi-layer value with commas inside oklch() to exercise the value scanner.
const REAL_TOKENS_FIXTURE = `@theme {
  --spacing-hsp-md: 0.75rem;

  --font-weight-bold: 700;

  --shadow-card:
    0 0.5px 1px oklch(.185 .005 65 / 0.05),
    0 2px 4px oklch(.185 .005 65 / 0.05);
}
`;

describe("zdtp-panel-routing.json (committed routing map)", () => {
  it("routes palette + color to colors.css and the tokens.css families", () => {
    expect(REAL_ROUTING).toMatchObject({
      palette: "packages/ui/styles/colors.css",
      color: "packages/ui/styles/colors.css",
      spacing: "packages/ui/styles/tokens.css",
      text: "packages/ui/styles/tokens.css",
      font: "packages/ui/styles/tokens.css",
      leading: "packages/ui/styles/tokens.css",
      radius: "packages/ui/styles/tokens.css",
      shadow: "packages/ui/styles/tokens.css",
    });
  });

  it("does NOT route breakpoint or default-transition prefixes (Tailwind plumbing)", () => {
    expect(REAL_ROUTING).not.toHaveProperty("breakpoint");
    expect(REAL_ROUTING).not.toHaveProperty("default-transition");
  });
});

describe("createDevMiddlewareHandler — real routing map + same-file shim", () => {
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

  // Raw, un-shimmed zdtp handler — the same factory the shim wraps. Used to
  // confirm zdtp no longer has the read-all-then-write-all clobber the shim
  // was built to work around (fixed upstream in zdtp 0.4.7, #527).
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

  // ── (d) SAME-FILE pairs: upstream fix confirmation (raw) + shim regression
  //     guard (shim) ── zdtp 0.4.7 (#527) fixed the read-all-then-write-all
  //     clobber this shim was built to work around (upstream bug-report sub
  //     #202) by coalescing same-file token groups inside createApplyHandler
  //     itself — see node_modules/@takazudo/zdtp/CHANGELOG.md's 0.4.7 entry.
  //     The raw handler no longer clobbers either pair below; kept as a
  //     regression guard in case a future zdtp bump reintroduces it. The shim
  //     stays in place (harmless on top of the fixed upstream behavior) —
  //     whether it's still needed at all is a separate follow-up.

  it("(d) palette + color → colors.css: RAW zdtp handler no longer clobbers (fixed upstream, zdtp 0.4.7 #527)", async () => {
    const { status } = await postRaw(rawHandler(), {
      "--palette-base-4": "oklch(.250 .006 65)",
      "--color-fg": "red",
    });
    expect(status).toBe(200);
    const css = readReal("colors.css");
    const hasPalette = css.includes("--palette-base-4: oklch(.250 .006 65);");
    const hasColor = css.includes("--color-fg: red;");
    // createApplyHandler now coalesces same-file groups before reading/writing,
    // so both edits land — no clobber.
    expect(hasPalette && hasColor).toBe(true);
  });

  it("(d) palette + color → colors.css: SHIM lands BOTH edits", async () => {
    const res = await post(realHandler(), {
      tokens: {
        "--palette-base-4": "oklch(.250 .006 65)",
        "--color-fg": "red",
      },
    });
    expect(res.status).toBe(200);
    const payload = JSON.parse(res.body ?? "{}");
    expect(payload.ok).toBe(true);
    const css = readReal("colors.css");
    expect(css).toContain("--palette-base-4: oklch(.250 .006 65);");
    expect(css).toContain("--color-fg: red;");
    // The two same-file prefix calls must be COALESCED into one `updated` row —
    // zdtp's result modal keys rows by `file`, so a duplicate `file` would render
    // as split/partial sections (and collide as Preact keys). One row, both vars.
    const colorRows = (payload.updated ?? []).filter(
      (u: { file?: string }) => u.file?.endsWith("colors.css"),
    );
    expect(colorRows).toHaveLength(1);
    expect(colorRows[0].changed).toEqual(
      expect.arrayContaining(["--palette-base-4", "--color-fg"]),
    );
    // No file appears twice across the whole `updated` list.
    const files = (payload.updated ?? []).map((u: { file?: string }) => u.file);
    expect(new Set(files).size).toBe(files.length);
  });

  it("(d) spacing + font → tokens.css: RAW zdtp handler no longer clobbers (fixed upstream, zdtp 0.4.7 #527)", async () => {
    const { status } = await postRaw(rawHandler(), {
      "--spacing-hsp-md": "0.8rem",
      "--font-weight-bold": "800",
    });
    expect(status).toBe(200);
    const css = readReal("tokens.css");
    const hasSpacing = css.includes("--spacing-hsp-md: 0.8rem;");
    const hasFont = css.includes("--font-weight-bold: 800;");
    expect(hasSpacing && hasFont).toBe(true);
  });

  it("(d) spacing + font → tokens.css: SHIM lands BOTH edits", async () => {
    const res = await post(realHandler(), {
      tokens: {
        "--spacing-hsp-md": "0.8rem",
        "--font-weight-bold": "800",
      },
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body ?? "{}").ok).toBe(true);
    const css = readReal("tokens.css");
    expect(css).toContain("--spacing-hsp-md: 0.8rem;");
    expect(css).toContain("--font-weight-bold: 800;");
  });

  it("(e) mixed-file POST (--palette-* + --spacing-*) succeeds and updates both files", async () => {
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

  it("(f) 3 prefixes → tokens.css coalesce into ONE updated row", async () => {
    // spacing + font + shadow all route to tokens.css → three sequential prefix
    // calls, one coalesced `updated` row.
    const res = await post(realHandler(), {
      tokens: {
        "--spacing-hsp-md": "0.8rem",
        "--font-weight-bold": "800",
        "--shadow-card": "0 1px 2px oklch(.2 .01 65 / 0.1)",
      },
    });
    expect(res.status).toBe(200);
    const payload = JSON.parse(res.body ?? "{}");
    expect(payload.ok).toBe(true);
    const tokenRows = (payload.updated ?? []).filter(
      (u: { file?: string }) => u.file?.endsWith("tokens.css"),
    );
    expect(tokenRows).toHaveLength(1);
    expect(tokenRows[0].changed).toEqual(
      expect.arrayContaining(["--spacing-hsp-md", "--font-weight-bold", "--shadow-card"]),
    );
    const css = readReal("tokens.css");
    expect(css).toContain("--spacing-hsp-md: 0.8rem;");
    expect(css).toContain("--font-weight-bold: 800;");
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
