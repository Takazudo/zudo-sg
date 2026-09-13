// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compilePreviewCss, scopeTokensToPreviewDoc } from "../compile.js";
import type { CompilePreviewCssResult } from "../compile.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../../..");
const HOST_ENTRY = join(REPO_ROOT, "src/styles/preview-entry.css");
const fwd = (p: string) => p.replaceAll("\\", "/");

// A `:root {` / `:root, :host {` block that was NOT rescoped (minified or not).
const BARE_ROOT_BLOCK = /(^|[\s,{};])(:root)\s*(,\s*:host\s*)?\{/;

describe("scopeTokensToPreviewDoc", () => {
  it("rescopes the Tailwind theme root and plain :root blocks", () => {
    const input = ":root, :host {\n  --a: 1;\n}\n:root {\n  --b: 2;\n}\n";
    expect(scopeTokensToPreviewDoc(input)).toBe(
      ":root[data-sg-preview-doc], :host {\n  --a: 1;\n}\n:root[data-sg-preview-doc] {\n  --b: 2;\n}\n",
    );
  });

  it("leaves compound :root selectors alone", () => {
    const input = ':root[data-theme="dark"] {\n  --a: 1;\n}\n:root:not(.x) {\n  --b: 2;\n}\n';
    expect(scopeTokensToPreviewDoc(input)).toBe(input);
  });
});

describe("compilePreviewCss — self-contained fixture", () => {
  let dir: string;
  let result: CompilePreviewCssResult;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "zudo-sg-preview-css-"));
    await mkdir(join(dir, "content"));
    await writeFile(join(dir, "content/card.html"), '<div class="bg-brand"></div>');
    await writeFile(join(dir, "tokens.css"), ":root {\n  --palette-brand: #0a5;\n}\n");
    await writeFile(
      join(dir, "entry.css"),
      [
        '@import "./tokens.css";',
        "@theme { --color-brand: var(--palette-brand); }",
        "@tailwind utilities;",
        '@source "./content";',
      ].join("\n"),
    );
    result = await compilePreviewCss(join(dir, "entry.css"));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("builds the scanned utility and rescopes both token roots", () => {
    expect(result.css).toMatch(/\.bg-brand\s*\{/);
    expect(result.css).toContain(":root[data-sg-preview-doc]");
    expect(result.css).not.toMatch(BARE_ROOT_BLOCK);
    expect(result.candidateCount).toBeGreaterThan(0);
  });

  it("reports the entry, its imports and the scanned content files", () => {
    expect(result.dependencies[0]).toBe(fwd(join(dir, "entry.css")));
    expect(result.dependencies).toContain(fwd(join(dir, "tokens.css")));
    expect(result.sourceFiles).toContain(fwd(join(dir, "content/card.html")));
  });

  it("emits unminified output on request", async () => {
    const pretty = await compilePreviewCss(join(dir, "entry.css"), { minify: false });
    expect(pretty.css.split("\n").length).toBeGreaterThan(result.css.split("\n").length);
  });

  it("rejects a missing entry", async () => {
    await expect(compilePreviewCss(join(dir, "missing.css"))).rejects.toThrow();
  });
});

describe("compilePreviewCss — root host src/styles/preview-entry.css", () => {
  let result: CompilePreviewCssResult;

  beforeAll(async () => {
    result = await compilePreviewCss(HOST_ENTRY, { minify: false });
  }, 60_000);

  it("carries the UI token declarations under :root[data-sg-preview-doc] only", () => {
    const scopedBlocks = result.css.match(/:root\[data-sg-preview-doc\](, :host)? \{[^}]*\}/g) ?? [];
    const scoped = scopedBlocks.join("\n");
    expect(scoped).toMatch(/--color-accent\s*:/);
    expect(scoped).toMatch(/--spacing-hsp-[\w-]+\s*:/);
    expect(scoped).toMatch(/--palette-[\w-]+\s*:/);
    expect(result.css).not.toMatch(BARE_ROOT_BLOCK);
  });

  it("contains utilities used by stories", () => {
    expect(result.css).toMatch(/\.bg-accent\s*\{/);
    expect(result.css).toMatch(/\.px-hsp-[\w-]+\s*\{/);
  });

  it("contains no host --zd-* declaration", () => {
    expect(result.css).not.toMatch(/--zd-[\w-]+\s*:/);
  });

  it("lists the entry and the UI token files as dependencies", () => {
    expect(result.dependencies[0]).toBe(fwd(HOST_ENTRY));
    expect(result.dependencies).toContain(fwd(join(REPO_ROOT, "packages/demo-ui/styles/tokens.css")));
    expect(result.dependencies).toContain(fwd(join(REPO_ROOT, "packages/demo-ui/styles/colors.css")));
  });

  it("scans the UI package sources", () => {
    const uiSrc = fwd(join(REPO_ROOT, "packages/demo-ui/src/"));
    expect(result.sourceFiles.some((file) => file.startsWith(uiSrc))).toBe(true);
  });
});
