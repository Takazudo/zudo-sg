// #662 no-stub proof for the @takazudo/zudo-sg engine routes (slow tier).
//
// Copies the root host into a temp dir as-is. Since #664 the root host has no
// `pages/components/*` / `pages/tokens.tsx` and ships the ADR decision 7
// islands seed (`pages/lib/_zudo-sg-islands.ts`, imported by
// `pages/index.tsx`), so the copy IS the dogfood shape; a host page that
// reappears at an engine URL fails the "none shadowed" assertion. Then:
//
//   1. `zfb build` — the four injected routes own their URLs and render the
//      registry's stories; the preview island is registered STRUCTURALLY
//      (SSR marker + islands manifest entry). zfb silently drops colliding
//      injected routes, so the build log's shadowing lines are asserted too.
//   2. Strip the seed from the temp copy (delete the shim file, remove its
//      import from `pages/index.tsx`), then `zfb dev` — `/assets/islands.js`
//      still carries `ConfiguredPreviewApp` even though nothing statically
//      imports it. Before zfb 2.18.0, `zfb dev` scanned host `pages/` only
//      (ADR finding 4) and this would have 404ed; since 2.18.0 the dev
//      scanner is seeded from the injected routes, so the assertion now
//      proves the amendment rather than the seed.
//
// Run: `pnpm test:slow` (needs the engine package built: `pnpm build:styleguide`).
// Model: zudo-doc's src/__tests__/route-injection-build.slow.test.ts.

import { execSync, spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Host entries the styleguide build needs; everything else (doc/, apps/, e2e/, dist/, …) stays out. */
const COPY_ENTRIES = [
  ".gitignore",
  "package.json",
  "tsconfig.json",
  "zfb.config.ts",
  "zudo-sg.config.mjs",
  "zdtp-panel-routing.json",
  "pages",
  "public",
  "src",
  "packages/demo-ui",
];

const ENGINE_ISLANDS = ["ConfiguredPreviewApp", "DetailWorkbench", "CodePanel", "CatalogFilter", "PreviewTokensButton"];
const NO_REGISTRY_ENTRY = /has no matching registry entry/;

/** `zfb build` minifies HTML (unquoted attribute values); match both spellings. */
function attr(name: string, value: string): RegExp {
  const escaped = value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`${name}=(?:"${escaped}"|${escaped}(?=[\\s>]))`);
}

let hostDir: string;
let buildLog = "";
let devServer: ChildProcess | undefined;

function copyHost(): string {
  const dir = mkdtempSync(join(tmpdir(), "zudo-sg-no-stub-"));
  for (const entry of COPY_ENTRIES) {
    cpSync(join(REPO_ROOT, entry), join(dir, entry), {
      recursive: true,
      filter: (src) => !/[/\\](node_modules|dist|\.zfb|\.zfb-build)([/\\]|$)/.test(src.slice(REPO_ROOT.length)),
    });
  }
  symlinkSync(join(REPO_ROOT, "node_modules"), join(dir, "node_modules"));
  return dir;
}

function zfbEnv(): NodeJS.ProcessEnv {
  return { ...process.env, SKIP_DOC_HISTORY: "1", NO_COLOR: "1" };
}

function read(rel: string): string {
  return readFileSync(join(hostDir, rel), "utf8");
}

/**
 * Strips the ADR decision-7 islands seed from the temp copy — deletes the
 * shim file and its import from `pages/index.tsx` — so the dev boot below
 * proves zfb 2.18.0's dev-scanner seeding (finding 4 amendment) rather than
 * the seed. Asserts the import line was actually present so this fails loudly
 * if the shim wiring moves.
 */
function stripIslandsSeed(): void {
  rmSync(join(hostDir, "pages/lib/_zudo-sg-islands.ts"), { force: true });
  const indexPath = join(hostDir, "pages/index.tsx");
  const importLine = 'import "./lib/_zudo-sg-islands";';
  const indexSource = readFileSync(indexPath, "utf8");
  if (!indexSource.includes(importLine)) {
    throw new Error(`expected \`${importLine}\` in pages/index.tsx — shim wiring moved`);
  }
  const stripped = indexSource
    .split("\n")
    .filter((line) => line.trim() !== importLine)
    .join("\n");
  writeFileSync(indexPath, stripped);
}

function freePort(): Promise<number> {
  const fixed = Number(process.env.ZUDO_SG_SLOW_TEST_PORT);
  if (fixed) return Promise.resolve(fixed);
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(typeof address === "object" && address ? address.port : 0));
    });
  });
}

async function waitForOk(url: string, timeoutMs: number, child: ChildProcess, log: () => string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`zfb dev exited (${child.exitCode}):\n${log()}`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`zfb dev did not answer ${url} within ${timeoutMs}ms:\n${log()}`);
}

function stopDevServer(): void {
  if (!devServer || devServer.exitCode !== null || devServer.pid === undefined) return;
  try {
    process.kill(-devServer.pid, "SIGTERM");
  } catch {
    devServer.kill("SIGTERM");
  }
}

beforeAll(() => {
  for (const file of ["dist/islands.js", "routes-src/_preview-app.tsx", "dist/plugins/routes.js"]) {
    if (!existsSync(join(REPO_ROOT, "packages/styleguide", file))) {
      throw new Error(`packages/styleguide/${file} is missing — run \`pnpm build:styleguide\` first`);
    }
  }
  hostDir = copyHost();
  try {
    buildLog = execSync("./node_modules/.bin/zfb build 2>&1", {
      cwd: hostDir,
      env: zfbEnv(),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const e = error as { stdout?: string; message?: string };
    throw new Error(`zfb build failed in ${hostDir}:\n${e.stdout ?? ""}\n${e.message ?? ""}`);
  }
}, 600_000);

afterAll(() => {
  stopDevServer();
  if (hostDir && !process.env.ZUDO_SG_SLOW_TEST_KEEP) rmSync(hostDir, { recursive: true, force: true });
});

describe("no-stub build: engine routes own /components, /components/[slug], /components/preview, /tokens", () => {
  it("injects all four routes (none shadowed) and emits no unregistered island marker", () => {
    for (const pattern of ["/components", "/components/[slug]", "/components/preview", "/tokens"]) {
      expect(buildLog).toContain(`package route \`${pattern}\` →`);
    }
    expect(buildLog).not.toContain("is shadowed by a user pages/ route");
    expect(buildLog).not.toMatch(NO_REGISTRY_ENTRY);
    // The seed reaches ConfiguredPreviewApp through pages/index.tsx AND the
    // package route injects it too; both graphs dedupe by path (ADR finding
    // 4 / decision 10's dev-hydration-seed row).
    expect(buildLog).not.toMatch(/island marker name collision/);
  });

  it("renders the catalog with every registry story and links each detail page that renders its title", () => {
    const registrySource = readFileSync(join(REPO_ROOT, "src/styleguide/sg-registry.ts"), "utf8");
    const storyCount = new Set(registrySource.match(/"\.\/ui\/src\/[^"]+\.stories\.tsx"/g) ?? []).size;
    expect(storyCount).toBeGreaterThan(10);

    const index = read("dist/components/index.html");
    expect(index).toContain("data-sg-catalog");
    expect(index).toMatch(attr("data-zfb-island", "CatalogFilter"));
    const titles = [...index.matchAll(/<h3 class="?sg-tile-title"?>([^<]+)<\/h3>/g)].map((m) => m[1]!);
    expect(new Set(titles).size).toBe(storyCount);

    const slugs = readdirSync(join(hostDir, "dist/components"), { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== "preview")
      .map((e) => e.name);
    expect(slugs).toHaveLength(storyCount);
    const detailTitles = new Set<string>();
    slugs.forEach((slug) => {
      expect(index).toMatch(attr("href", `/components/${slug}`));
      const detail = read(`dist/components/${slug}/index.html`);
      detailTitles.add(/<h1[^>]*>([^<]*)<\/h1>/.exec(detail)?.[1] ?? "");
      expect(detail).toMatch(attr("data-zfb-island", "DetailWorkbench"));
      expect(detail).toMatch(attr("data-zfb-island", "CodePanel"));
    });
    expect(detailTitles).toEqual(new Set(titles));
  });

  it("renders the preview document with the preview stylesheet and the ConfiguredPreviewApp island marker", () => {
    const preview = read("dist/components/preview/index.html");
    expect(preview).toMatch(attr("data-zfb-island-skip-ssr", "ConfiguredPreviewApp"));
    expect(preview).toMatch(/<html[^>]*data-sg-preview-doc/);
    const link = /<link [^>]*data-sg-preview-css[^>]*>/.exec(preview)?.[0] ?? "";
    expect(link).toMatch(attr("href", "/_zudo-sg/preview.css"));
    // The preview stylesheet precedes zfb's injected global stylesheet (cascade rule, ADR decision 4).
    expect(preview.indexOf(link)).toBeLessThan(preview.search(/href="?\/assets\/styles-/));
    expect(existsSync(join(hostDir, "dist/_zudo-sg/preview.css"))).toBe(true);
  });

  it("registers every engine island in the built islands manifest", () => {
    const manifests = readdirSync(join(hostDir, "dist/assets")).filter((f) => /^islands-.*\.js$/.test(f));
    expect(manifests.length).toBeGreaterThan(0);
    const bundle = manifests.map((f) => read(`dist/assets/${f}`)).join("\n");
    for (const name of ENGINE_ISLANDS) expect(bundle).toContain(`"${name}"`);
  });

  it("renders the token dashboards and the Preview tokens island on /tokens", () => {
    const tokens = read("dist/tokens/index.html");
    expect(tokens).toContain("Design tokens");
    expect(tokens).toContain("ui-defaults-light");
    expect(tokens).toMatch(attr("data-zfb-island", "PreviewTokensButton"));
  });
});

describe("no-stub dev: zfb dev registers the engine islands from the injected routes without the host seed (ADR finding 4 amendment)", () => {
  beforeAll(() => {
    stripIslandsSeed();
  });

  it("serves /assets/islands.js containing ConfiguredPreviewApp", async () => {
    const port = await freePort();
    let log = "";
    devServer = spawn("./node_modules/.bin/zfb", ["dev", "--port", String(port)], {
      cwd: hostDir,
      env: zfbEnv(),
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    devServer.stdout?.on("data", (chunk) => (log += String(chunk)));
    devServer.stderr?.on("data", (chunk) => (log += String(chunk)));

    try {
      const origin = `http://127.0.0.1:${port}`;
      // The islands bundle is built after the first page render; wait for it.
      await waitForOk(`${origin}/assets/islands.js`, 300_000, devServer, () => log);

      const preview = await (await fetch(`${origin}/components/preview`)).text();
      expect(preview).toMatch(attr("data-zfb-island-skip-ssr", "ConfiguredPreviewApp"));
      expect(preview).toMatch(/<script[^>]+src="?\/assets\/islands\.js/);

      const bundle = await (await fetch(`${origin}/assets/islands.js`)).text();
      for (const name of ENGINE_ISLANDS) expect(bundle).toContain(name);
      // Proves the entry comes from the package route source (the injected
      // route entrypoint), not from a host-side import — the seed is gone.
      expect(bundle).toMatch(/__zfb_register\([^)]*"ConfiguredPreviewApp",\s*"[^"]*\/routes-src\/_preview-app\.tsx"\)/);
      expect(log).not.toMatch(/island marker name collision/);
      expect(log).not.toMatch(NO_REGISTRY_ENTRY);
    } finally {
      stopDevServer();
    }
  }, 360_000);
});
