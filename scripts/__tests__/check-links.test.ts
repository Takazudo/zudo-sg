// Spawns the real check-links.mjs as a child process against a temp sandbox.
// The script derives its ROOT_DIR/DIST_DIR from its own file location
// (import.meta.url), so we copy it into a fresh temp dir per test — that
// keeps every run hermetic (no real dist/, no network) without touching the
// actual project script.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Avoid the `new URL(literal, import.meta.url)` shape — Vite's static asset
// transform rewrites that exact pattern into a served-asset URL even in
// vitest's SSR transform, which breaks plain file-path resolution here.
const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT_SRC = join(THIS_DIR, "..", "check-links.mjs");

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "check-links-"));
  mkdirSync(join(sandbox, "scripts"), { recursive: true });
  copyFileSync(SCRIPT_SRC, join(sandbox, "scripts", "check-links.mjs"));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function run(args: string[] = []) {
  return spawnSync(process.execPath, [join(sandbox, "scripts", "check-links.mjs"), ...args], {
    cwd: sandbox,
    encoding: "utf-8",
  });
}

function writeDistFile(relPath: string, content: string) {
  const full = join(sandbox, "dist", relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

describe("check-links.mjs", () => {
  it("fails when dist/ does not exist", () => {
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("dist/ not found");
  });

  it("passes when all internal links resolve", () => {
    writeDistFile("index.html", `<a href="/about/">About</a><script src="/app.js"></script>`);
    writeDistFile("about/index.html", "<p>About page</p>");
    writeDistFile("app.js", 'console.log("hi");');

    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No broken internal links found");
  });

  it("reports a broken link and exits non-zero", () => {
    writeDistFile("index.html", `<a href="/missing/">Missing</a>`);

    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("broken internal link");
    expect(result.stderr).toContain("/missing/");
  });

  it("skips external, mailto, data, and fragment links", () => {
    writeDistFile(
      "index.html",
      `<a href="https://example.com">Ext</a>` +
        `<a href="mailto:a@b.com">Mail</a>` +
        `<a href="data:text/plain,x">Data</a>` +
        `<a href="#section">Frag</a>`,
    );

    const result = run();
    expect(result.status).toBe(0);
  });

  it("skips __zfb/ and pagefind asset links even when the target is missing", () => {
    writeDistFile(
      "index.html",
      `<script src="/__zfb/chunk-abc.js"></script><a href="/pagefind/pagefind.js">Search</a>`,
    );

    const result = run();
    expect(result.status).toBe(0);
  });

  it("resolves a direct file match without requiring an index.html", () => {
    writeDistFile("index.html", `<a href="/sitemap.xml">Sitemap</a>`);
    writeDistFile("sitemap.xml", "<urlset></urlset>");

    const result = run();
    expect(result.status).toBe(0);
  });

  it("suppresses a known broken link via the default allowlist file", () => {
    writeDistFile("index.html", `<a href="/missing/">Missing</a>`);
    writeFileSync(join(sandbox, ".check-links-allowlist"), "dist/index.html:/missing/\n");

    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("No broken internal links found");
  });

  it("honors a custom --allowlist path", () => {
    writeDistFile("index.html", `<a href="/missing/">Missing</a>`);
    writeFileSync(join(sandbox, "custom-allowlist.txt"), "dist/index.html:/missing/\n");

    const result = run(["--allowlist=custom-allowlist.txt"]);
    expect(result.status).toBe(0);
  });
});
