import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(__dirname, "../../..");
const composerCss = readFileSync(resolve(packageRoot, "styles/composer.css"), "utf8");
const syntaxCss = readFileSync(resolve(packageRoot, "styles/syntax-highlight.css"), "utf8");
const proseCss = readFileSync(resolve(packageRoot, "src/content/prose-md/prose-md.css"), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));

describe("composer CSS public boundary", () => {
  it("loads the portable graph in the required order with exact package source scanning", () => {
    const imports = [...composerCss.matchAll(/@import\s+"([^"]+)"/g)].map((match) => match[1]);
    expect(imports).toEqual([
      "tailwindcss/preflight",
      "tailwindcss/utilities",
      "./tokens.css",
      "./colors.css",
      "./syntax-highlight.css",
      "../src/content/prose-md/prose-md.css",
    ]);
    expect(composerCss).toContain('@source "../src";');
  });

  it("exports only the canonical CSS and pack entrypoints", () => {
    expect(packageJson.exports["./composer-pack"]).toBe("./src/composer-pack.ts");
    expect(packageJson.exports["./styles/composer.css"]).toBe("./styles/composer.css");
    expect(packageJson.exports["./styles/syntax-highlight.css"]).toBeUndefined();
    expect(packageJson.scripts.prepare).toBeUndefined();
    expect(packageJson.scripts.prepack).toBeUndefined();
    expect(packageJson.scripts.install).toBeUndefined();
    expect(packageJson.peerDependencies.tailwindcss).toBe("^4.0.0");
    expect(packageJson.devDependencies.tailwindcss).toBe("^4.0.0");
  });

  it("owns every zfb semantic token and corresponding unlayered hi class", () => {
    const tokens = [
      "fg", "bg", "esc", "op", "com", "str", "num", "const", "kw", "fn", "ty", "ns",
      "prop", "var", "tag", "attr", "punct", "ins", "ins-bg", "del", "del-bg", "hd",
    ];
    for (const token of tokens) expect(syntaxCss).toContain(`--zfb-hi-${token}:`);
    for (const className of tokens.filter((token) => !token.endsWith("-bg") && token !== "bg" && token !== "fg")) {
      expect(syntaxCss).toContain(`.hi-${className}`);
    }
    expect(syntaxCss).toContain("pre.hi-root");
    expect(syntaxCss).not.toContain("@layer");
  });

  it("maps syntax directly to semantic provider roles with no doc bridge", () => {
    expect(syntaxCss).toContain("--zfb-hi-op: var(--color-fg)");
    expect(syntaxCss).toContain("--zfb-hi-prop: var(--color-fg)");
    expect(syntaxCss).toContain("--zfb-hi-bg: color-mix(in oklch, var(--color-bg) 80%, var(--color-surface-2))");
    expect(syntaxCss).toContain("--zfb-hi-com: var(--color-muted)");
    expect(syntaxCss).toContain("--zfb-hi-esc: var(--color-success)");
    expect(syntaxCss).toContain("--zfb-hi-num: var(--color-warning)");
    expect(syntaxCss).toContain("--zfb-hi-kw: var(--color-accent)");
    expect(syntaxCss).toContain("--zfb-hi-fn: var(--color-info)");
    expect(syntaxCss).toContain("--zfb-hi-del: var(--color-danger)");
    expect(composerCss).not.toContain("@takazudo/zudo-doc");
    expect(syntaxCss).not.toContain("@takazudo/zudo-doc");
    expect(`${syntaxCss}\n${proseCss}`).not.toContain("--zd-");
  });

  it("uses the same provider-owned fence background in ProseMd", () => {
    expect(proseCss).toContain("--zfb-hi-bg");
    expect(proseCss).not.toContain("--zd-code-bg");
  });
});
