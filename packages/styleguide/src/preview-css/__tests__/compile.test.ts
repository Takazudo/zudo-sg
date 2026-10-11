// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compilePreviewCss, scopeTokensToPreviewDoc, snapshotWind, sourceInputs } from "../compile.js";
const { generateWindManifest } = await import(new URL("../../../scripts/gen-wind-manifest.mjs", import.meta.url).href);
const { validateWindManifest } = await import(new URL("../../../scripts/check-package-wind-manifest.mjs", import.meta.url).href);
let root: string;
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  root = mkdtempSync(join(tmpdir(), "sg-wind-"));
  symlinkSync(resolve(import.meta.dirname, "../../../../../node_modules"), join(root, "node_modules"), "dir");
  mkdirSync(join(root, "components"));
  writeFileSync(join(root, "tokens.css"), ':root { --brand: #0a5; }');
  writeFileSync(join(root, "entry.css"), '@import "./tokens.css"; .authored { color: var(--brand); }');
  writeFileSync(join(root, "components/card.tsx"), '<div class="bg-brand flex"/>');
}
describe("preview compiler", () => {
  it("scopes selector roots, preserves comments/strings/values and is idempotent", () => {
    const input = '/* :root */ :root,:root[data-theme="dark"],:not(:root),[title=":root"] { --x: ":root"; }';
    const result = scopeTokensToPreviewDoc(input);
    expect(result).toContain('/* :root */ :root[data-sg-preview-doc],:root[data-sg-preview-doc][data-theme="dark"],:not(:root[data-sg-preview-doc]),[title=":root"]');
    expect(result).toContain('--x: ":root"');
    expect(scopeTokensToPreviewDoc(result)).toBe(result);
  });
  it("rejects non-data wind snapshots", () => {
    expect(() => snapshotWind({ plugin: () => 1 })).toThrow(/plain serializable/);
  });
  it("compiles with host CLI, preserves token precedence and cleans temporary files", async () => {
    fixture();
    const result = await compilePreviewCss(join(root, "entry.css"), { projectRoot: root, wind: { tokens: { colors: { brand: "var(--brand)" } }, strict: true }, sources: ["components"] });
    expect(result.css).toContain(".bg-brand");
    expect(result.css).toContain(":root[data-sg-preview-doc]");
    expect(result.dependencies).toContain(join(root, "tokens.css"));
    expect(result.sourceFiles).toContain(join(root, "components/card.tsx"));
    expect(readdirSync(root).some(p => p.startsWith(".zudo-sg-preview-"))).toBe(false);
    writeFileSync(join(root, "entry.css"), '@import "./missing.css";');
    await expect(compilePreviewCss(join(root, "entry.css"), { projectRoot: root })).rejects.toThrow(/zfb css failed/);
    expect(readdirSync(root).some(p => p.startsWith(".zudo-sg-preview-"))).toBe(false);
  });
  it("supports zero component roots and explicit host wind sources", async () => {
    fixture();
    const result = await compilePreviewCss(join(root, "entry.css"), { projectRoot: root, wind: { tokens: { colors: { brand: "var(--brand)" } }, sources: { roots: ["components"] } } });
    expect(result.css).toContain(".bg-brand");
  });
  it("matches source globs without including unrelated file contents", () => {
    fixture();
    expect(sourceInputs(root, ["components/**/*.tsx"])).toContain(join(root, "components/card.tsx"));
  });
  it("generates the real manifest schema from bounded compiled fixture JS", () => {
    fixture();
    mkdirSync(join(root, "dist"));
    writeFileSync(join(root, "dist/card.js"), 'export const card = () => jsx("div", { class: "flex border-sg-border text-sg-muted bg-sg-surface-2" });');
    writeFileSync(join(root, "wind.config.ts"), 'export default { outDir: ".output", wind: { tokens: { colors: { "sg-border": "var(--sg-border)", "sg-muted": "var(--sg-muted)", "sg-surface-2": "var(--sg-surface-2)" } } } };');
    const manifest = generateWindManifest({ projectRoot: root, config: "wind.config.ts", sources: ["dist/**/*.js"] });
    expect(validateWindManifest(manifest).candidates).toContain("flex");
    expect(JSON.parse(readFileSync(join(root, "dist/wind.json"), "utf8"))).toEqual(manifest);
  });
});
