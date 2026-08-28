import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDevServer,
  createStaticPreviewServer,
  decideStaticPreviewGuard,
  parsePortArg,
  resolveE2EPort,
} from "../lib/playwright-e2e-server.mjs";

const entries = [
  { entry: "root", env: "ZUDO_SG_SMOKE_PORT", legacyPort: 4_700, offset: 0 },
  { entry: "demo", env: "ZUDO_SG_DEMO_SMOKE_PORT", legacyPort: 4_701, offset: 1 },
  { entry: "file-dev", env: "ZUDO_SG_COMPOSER_FILE_PORT", legacyPort: 4_702, offset: 2 },
  {
    entry: "persistence",
    env: "ZUDO_SG_COMPOSER_PERSISTENCE_PORT",
    legacyPort: 4_703,
    offset: 3,
  },
  {
    entry: "verification",
    env: "ZUDO_SG_COMPOSER_VERIFICATION_PORT",
    legacyPort: 4_704,
    offset: 4,
  },
  {
    entry: "prose-window-blur",
    env: "ZUDO_SG_PROSE_WINDOW_BLUR_PORT",
    legacyPort: 4_713,
    offset: 13,
  },
] as const;

const sandboxes: string[] = [];

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) rmSync(sandbox, { recursive: true, force: true });
});

function sandbox() {
  const path = mkdtempSync(join(tmpdir(), "playwright-e2e-server-"));
  sandboxes.push(path);
  return path;
}

describe("resolveE2EPort", () => {
  it("derives deterministic, in-range ports with all six offsets", () => {
    const projectRoot = sandbox();
    const ports = entries.map(({ entry }) =>
      resolveE2EPort({ entry, projectRoot, env: {} }),
    );
    expect(new Set(ports).size).toBe(entries.length);
    for (const port of ports) expect(port).toBeGreaterThanOrEqual(1);
    for (const port of ports) expect(port).toBeLessThanOrEqual(65_535);

    const digest = createHash("sha256").update(realpathSync(projectRoot)).digest();
    const blockBase = 20_000 + (digest.readUInt32BE(0) % 2_000) * 16;
    expect(ports).toEqual(entries.map(({ offset }) => blockBase + offset));
  });

  it("uses distinct normal-case blocks for separate checkout paths", () => {
    const first = sandbox();
    let second = sandbox();
    let attempts = 0;
    while (
      resolveE2EPort({ entry: "root", projectRoot: first, env: {} }) ===
        resolveE2EPort({ entry: "root", projectRoot: second, env: {} }) &&
      attempts < 20
    ) {
      second = sandbox();
      attempts += 1;
    }
    expect(resolveE2EPort({ entry: "root", projectRoot: first, env: {} })).not.toBe(
      resolveE2EPort({ entry: "root", projectRoot: second, env: {} }),
    );
  });

  it("keeps the exact legacy ports in CI", () => {
    for (const { entry, legacyPort } of entries) {
      expect(resolveE2EPort({ entry, env: { CI: "1" } })).toBe(legacyPort);
    }
  });

  it("lets each explicit entry environment override win in CI", () => {
    for (const { entry, env } of entries) {
      expect(resolveE2EPort({ entry, env: { CI: "1", [env]: "12345" } })).toBe(12_345);
    }
  });

  it("rejects invalid environment port values", () => {
    for (const value of ["", "0", "65536", "1.5", "1e3", "not-a-port"]) {
      expect(() =>
        resolveE2EPort({ entry: "root", env: { CI: "1", ZUDO_SG_SMOKE_PORT: value } }),
      ).toThrow(/Invalid port/);
    }
  });
});

describe("decideStaticPreviewGuard", () => {
  it("returns a present decision without an error message", () => {
    const projectRoot = sandbox();
    const decision = decideStaticPreviewGuard({
      projectRoot,
      distPath: "dist",
      buildCommand: "pnpm build",
      isDirectory: true,
    });
    expect(decision).toEqual({
      ok: true,
      status: "present",
      distPath: join(projectRoot, "dist"),
      message: null,
    });
  });

  it("formats the exact missing root-build message", () => {
    const projectRoot = sandbox();
    const distPath = join(projectRoot, "dist");
    const decision = decideStaticPreviewGuard({
      distPath,
      buildCommand: "pnpm build",
      present: false,
    });
    expect(decision.ok).toBe(false);
    expect(decision.status).toBe("missing");
    expect(decision.message).toBe(
      `[e2e server isolation] Missing static build output: ${distPath}\n` +
        "Run `pnpm build` in this checkout before Playwright.\n" +
        "Refusing to attach to any existing server because this run must test this checkout's build.",
    );
  });

  it("formats the exact missing demo-build message", () => {
    const projectRoot = sandbox();
    const distPath = join(projectRoot, "apps/demo/dist");
    const decision = decideStaticPreviewGuard({
      projectRoot,
      distPath: "apps/demo/dist",
      buildCommand: "pnpm --filter @zudo-sg/demo build",
      present: false,
    });
    expect(decision.message).toBe(
      `[e2e server isolation] Missing static build output: ${distPath}\n` +
        "Run `pnpm --filter @zudo-sg/demo build` in this checkout before Playwright.\n" +
        "Refusing to attach to any existing server because this run must test this checkout's build.",
    );
  });

  it("changes only the first clause for an existing non-directory", () => {
    const projectRoot = sandbox();
    const distPath = join(projectRoot, "dist");
    const decision = decideStaticPreviewGuard({
      distPath,
      buildCommand: "pnpm build",
      present: true,
      isDirectory: false,
    });
    expect(decision.message).toBe(
      `[e2e server isolation] Static build output is not a directory: ${distPath}\n` +
        "Run `pnpm build` in this checkout before Playwright.\n" +
        "Refusing to attach to any existing server because this run must test this checkout's build.",
    );
  });
});

describe("server factories", () => {
  it("preflights static output before returning an exclusive web server", () => {
    const projectRoot = sandbox();
    mkdirSync(join(projectRoot, "dist"));
    const server = createStaticPreviewServer({
      entry: "root",
      projectRoot,
      env: { CI: "1" },
      command: "pnpm exec zfb preview --port {port}",
      urlPath: "/composer/",
      timeout: 60_000,
    });
    expect(server.port).toBe(4_700);
    expect(server.origin).toBe("http://localhost:4700");
    expect(server.webServer).toMatchObject({
      command: "pnpm exec zfb preview --port 4700",
      url: "http://localhost:4700/composer/",
      reuseExistingServer: false,
      cwd: projectRoot,
      timeout: 60_000,
    });
  });

  it("throws the static preflight message before Playwright can probe reuse", () => {
    const projectRoot = sandbox();
    expect(() =>
      createStaticPreviewServer({
        entry: "root",
        projectRoot,
        env: { CI: "1" },
        buildCommand: "pnpm build",
      }),
    ).toThrow(
      `[e2e server isolation] Missing static build output: ${join(projectRoot, "dist")}\n` +
        "Run `pnpm build` in this checkout before Playwright.\n" +
        "Refusing to attach to any existing server because this run must test this checkout's build.",
    );
  });

  it("creates a dev server with no dist or project-root filesystem requirement", () => {
    const projectRoot = join(sandbox(), "checkout-that-does-not-exist");
    const server = createDevServer({
      entry: "file-dev",
      projectRoot,
      env: { CI: "1" },
      urlPath: "/composer/",
    });
    expect(server.port).toBe(4_702);
    expect(server.webServer).toMatchObject({
      command: "pnpm exec zfb dev --port 4702",
      url: "http://localhost:4702/composer/",
      reuseExistingServer: false,
      cwd: projectRoot,
    });
  });

  it("interpolates explicit origin and port templates", () => {
    const projectRoot = sandbox();
    mkdirSync(join(projectRoot, "dist"));
    const server = createStaticPreviewServer({
      entry: "root",
      projectRoot,
      env: { ZUDO_SG_SMOKE_PORT: "54321" },
      command: "serve --port {{port}} --origin {origin}",
      url: "{origin}/health?port={port}",
    });
    expect(server.webServer.command).toBe("serve --port 54321 --origin http://localhost:54321");
    expect(server.webServer.url).toBe("http://localhost:54321/health?port=54321");
  });
});

describe("parsePortArg", () => {
  it("returns the fallback when no port argument is present", () => {
    expect(parsePortArg([], 4_702)).toBe(4_702);
    expect(parsePortArg(["--verbose"], 4_702)).toBe(4_702);
  });

  it("parses separated and equals-form port arguments", () => {
    expect(parsePortArg(["--port", "51234"], 4_702)).toBe(51_234);
    expect(parsePortArg(["--port=51235"], 4_702)).toBe(51_235);
  });

  it("rejects missing and invalid port arguments and fallback values", () => {
    expect(() => parsePortArg(["--port"], 4_702)).toThrow(/Missing value for --port/);
    expect(() => parsePortArg(["--port", "0"], 4_702)).toThrow(/Invalid port/);
    expect(() => parsePortArg(["--port=65536"], 4_702)).toThrow(/Invalid port/);
    expect(() => parsePortArg([], 0)).toThrow(/Invalid port/);
  });
});
