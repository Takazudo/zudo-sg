// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@tailwindcss/node";
import { parse } from "postcss";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_STYLES = resolve(__dirname, "../../styles.css");

// Use the package's real extractor and emitter. The test must exercise the
// same candidate path as the published safelist, rather than passing classes
// directly to compiler.build().
const { extractTokens, emitSafelist } = await import(
  resolve(__dirname, "../../scripts/gen-safelist.mjs"),
);
const SAMPLE_JS = `
  const chromeClasses =
    "border-[color:var(--sg-border)] text-[color:var(--sg-muted)]";
`;
const extracted = extractTokens(SAMPLE_JS, new Set<string>());
const SAFELIST = emitSafelist(extracted);

const ORDER_FIXTURES = [
  ["consumer theme before reset", "chrome-token-reset-consumer-first.css"],
  ["engine before reset", "chrome-token-reset-engine-first.css"],
  ["recommended order", "chrome-token-reset-recommended.css"],
] as const;

function declarations(css: string, property: string): string[] {
  const values: string[] = [];
  parse(css).walkDecls(property, (declaration) => values.push(declaration.value));
  return values;
}

function ruleDeclarations(css: string, selector: string, property: string): string[] {
  const values: string[] = [];
  parse(css).walkRules((rule) => {
    if (rule.selector !== selector) return;
    rule.walkDecls(property, (declaration) => values.push(declaration.value));
  });
  return values;
}

function hasUtilityDeclaration(
  css: string,
  selectorPrefix: string,
  property: string,
  value: string,
): boolean {
  let found = false;
  parse(css).walkRules((rule) => {
    if (!rule.selector.startsWith(selectorPrefix)) return;
    if (
      rule.nodes?.some(
        (node) => node.type === "decl" && node.prop === property && node.value === value,
      )
    ) {
      found = true;
    }
  });
  return found;
}

/**
 * Keep the bare-var guard scoped to engine chrome. The package stylesheet also
 * contains an intentional `.sg-thumb[data-sg-preview-scope]` host-palette
 * block, and imported zudo-doc rules legitimately consume bare --color-* vars.
 */
function engineChromeRules(css: string): string {
  const chunks: string[] = [];
  parse(css).walkRules((rule) => {
    const selector = rule.selector;
    const previewPalette = selector.includes(".sg-thumb[data-sg-preview-scope]");
    const hasEngineSelector = selector.includes("#sg-") || (selector.includes(".sg-") && !previewPalette);
    const hasEngineToken = rule.nodes?.some(
      (node) => node.type === "decl" && node.prop.startsWith("--sg-"),
    );
    if (!previewPalette && (hasEngineSelector || hasEngineToken)) {
      chunks.push(rule.toString());
    }
  });
  return chunks.join("\n");
}

async function compileFixture(fixture: string): Promise<string> {
  const entry = resolve(__dirname, fixture);
  const input = `${readFileSync(entry, "utf8")}\n@tailwind utilities;\n${SAFELIST}`;
  const compiler = await compile(input, {
    base: __dirname,
    from: entry,
    onDependency: () => {},
  });
  return compiler.build([]);
}

function expectChromeContract(css: string): void {
  const engineCss = engineChromeRules(css);
  expect(declarations(engineCss, "--sg-border").length).toBeGreaterThan(0);
  expect(declarations(engineCss, "--sg-surface-2").length).toBeGreaterThan(0);
  expect(ruleDeclarations(css, "#sg-code-panel", "border-left")).toContain(
    "1px solid var(--sg-border)",
  );
  expect(hasUtilityDeclaration(css, ".border-", "border-color", "var(--sg-border)")).toBe(true);
  expect(hasUtilityDeclaration(css, ".text-", "color", "var(--sg-muted)")).toBe(true);
  expect(engineCss).not.toContain("var(--color-");
}

describe("chrome color namespace survives the zudo-doc color reset", () => {
  it("extracts the exact arbitrary-value candidates into @source inline()", () => {
    expect(extracted).toEqual(
      new Set(["border-[color:var(--sg-border)]", "text-[color:var(--sg-muted)]"]),
    );
    expect(SAFELIST).toContain(
      '@source inline("border-[color:var(--sg-border)] text-[color:var(--sg-muted)]");',
    );
  });

  for (const [label, fixture] of ORDER_FIXTURES) {
    it(`keeps engine chrome intact in the ${label} case`, async () => {
      expectChromeContract(await compileFixture(fixture));
    }, 60_000);
  }

  it("keeps literal fallbacks when no --zd-* values are provided", async () => {
    const css = await compileFixture("chrome-token-reset-no-zd.css");
    expectChromeContract(css);
    const engineCss = engineChromeRules(css);

    for (const property of ["--sg-border", "--sg-surface-2"]) {
      expect(
        declarations(engineCss, property).some(
          (value) => value.includes("oklch(.185 .005 65") && value.includes("oklch(.965 .004 65"),
        ),
      ).toBe(true);
    }
  }, 60_000);

  for (const fixture of [
    "chrome-token-reset-override-before.css",
    "chrome-token-reset-override-after.css",
  ]) {
    it(`lets an unlayered :root --sg-border override win (${fixture})`, async () => {
      const css = await compileFixture(fixture);
      const rootValues = ruleDeclarations(css, ":root", "--sg-border");
      const engineValues = ruleDeclarations(css, ":where(:root)", "--sg-border");

      expect(rootValues).toContain("red");
      expect(engineValues.length).toBeGreaterThan(0);
      expect(rootValues).not.toEqual(engineValues);
      expectChromeContract(css);
    }, 60_000);
  }

  it("proves why a bare --color-border engine reference is broken by the reset", async () => {
    const css = await compileFixture("chrome-token-reset-bare-var.css");
    expect(ruleDeclarations(css, "#legacy-code-panel", "border-left")).toEqual([
      "1px solid var(--color-border)",
    ]);
    expect(ruleDeclarations(css, ":root, :host", "--color-border")).toHaveLength(0);
  }, 60_000);

  it("has no bare color variables in the migrated engine stylesheet", () => {
    expect(engineChromeRules(readFileSync(ENGINE_STYLES, "utf8"))).not.toContain("var(--color-");
  });
});
