// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "postcss";
import { describe, expect, it } from "vitest";
import { compilePreviewCss } from "../preview-css/compile.js";
import { engineWindDefaults } from "../config/wind.js";

const ENGINE = resolve(import.meta.dirname, "../../styles.css");
describe("engine chrome token precedence under wind", () => {
  for (const before of [true, false]) {
    it(`preserves explicit root overrides ${before ? "before" : "after"} engine defaults`, async () => {
      const root = mkdtempSync(join(tmpdir(), "sg-chrome-"));
      try {
        symlinkSync(resolve(import.meta.dirname, "../../../../node_modules"), join(root, "node_modules"), "dir");
        const override = ':root { --sg-border: red; }';
        const sheet = readFileSync(ENGINE, "utf8");
        writeFileSync(join(root, "entry.css"), before ? `${override}\n${sheet}` : `${sheet}\n${override}`);
        writeFileSync(join(root, "chrome.tsx"), '<div class="border-sg-border text-sg-muted"/>');
        const { css } = await compilePreviewCss(join(root, "entry.css"), { projectRoot: root, wind: engineWindDefaults, sources: ["chrome.tsx"] });
        const ast = parse(css);
        let overrideFound = false, defaultsFound = false;
        ast.walkRules(rule => {
          if (rule.selector === ":root[data-sg-preview-doc]") rule.walkDecls("--sg-border", d => { if (d.value === "red") overrideFound = true; });
          if (rule.selector === ":where(:root[data-sg-preview-doc])") rule.walkDecls("--sg-border", () => { defaultsFound = true; });
        });
        expect(overrideFound && defaultsFound).toBe(true);
        expect(css).toContain(".border-sg-border");
        expect(css).toContain(".text-sg-muted");
        expect(css).toContain("var(--sg-border)");
      } finally { rmSync(root, { recursive: true, force: true }); }
    });
  }
  it("uses no host color variables in authored engine rules", () => {
    expect(readFileSync(ENGINE, "utf8")).not.toContain("var(--color-");
  });
});
