// scripts/__tests__/css-var-parser.test.ts
//
// Unit tests for scripts/lib/css-var-parser.mjs — the postcss-based extractor
// that scripts/gen-token-manifest.mjs relies on. These target exactly the
// constructs the issue calls out as regex-hostile: `@theme` nesting,
// light-dark() pairs, multi-layer oklch() shadows, and trailing same-line
// comments.

import { describe, expect, it } from "vitest";
import { parseCssCustomProperties } from "../lib/css-var-parser.mjs";

describe("parseCssCustomProperties", () => {
  it("extracts declarations nested inside @theme", () => {
    const css = `
      @theme {
        --spacing-sm: 0.5rem;
        --radius-lg: 1rem;
      }
    `;
    const vars = parseCssCustomProperties(css);
    expect(vars.get("--spacing-sm")).toBe("0.5rem");
    expect(vars.get("--radius-lg")).toBe("1rem");
  });

  it("extracts declarations from a plain :root block", () => {
    const css = `:root { --palette-cool-8: oklch(0.21 0.03 264); }`;
    const vars = parseCssCustomProperties(css);
    expect(vars.get("--palette-cool-8")).toBe("oklch(0.21 0.03 264)");
  });

  it("keeps a light-dark() pair intact — commas inside parens are not split", () => {
    const css = `
      @theme {
        --color-ink: light-dark(var(--palette-cool-8), var(--palette-cool-0));
      }
    `;
    const vars = parseCssCustomProperties(css);
    expect(vars.get("--color-ink")).toBe(
      "light-dark(var(--palette-cool-8), var(--palette-cool-0))",
    );
  });

  it("collapses a multi-line, alignment-padded value to one normalized line", () => {
    // Mirrors --shadow-card in packages/ui/styles/tokens.css: multi-line,
    // double-spaced for column alignment, comma-separated oklch() layers.
    const css = `
      @theme {
        --shadow-card:
          0 0.5px 1px  oklch(0.21 0.03 264 / 0.05),
          0 2px   4px  oklch(0.21 0.03 264 / 0.05);
      }
    `;
    const vars = parseCssCustomProperties(css);
    expect(vars.get("--shadow-card")).toBe(
      "0 0.5px 1px oklch(0.21 0.03 264 / 0.05), 0 2px 4px oklch(0.21 0.03 264 / 0.05)",
    );
  });

  it("ignores a trailing same-line comment after the declaration", () => {
    const css = `
      @theme {
        --spacing-hsp-2xs: 0.125rem;   /*  2px — tight inline */
      }
    `;
    const vars = parseCssCustomProperties(css);
    expect(vars.get("--spacing-hsp-2xs")).toBe("0.125rem");
  });

  it("ignores non-custom-property declarations", () => {
    const css = `:root[data-theme="light"] { color-scheme: light; }`;
    const vars = parseCssCustomProperties(css);
    expect(vars.size).toBe(0);
  });

  it("throws when the same custom property has two conflicting values", () => {
    const css = `
      :root { --palette-cool-8: oklch(0.21 0.03 264); }
      @theme { --palette-cool-8: oklch(0.99 0 0); }
    `;
    expect(() => parseCssCustomProperties(css)).toThrow(/declared twice/);
  });

  it("allows the same custom property repeated with an identical value", () => {
    const css = `
      :root { --spacing-0: 0; }
      @theme { --spacing-0: 0; }
    `;
    const vars = parseCssCustomProperties(css);
    expect(vars.get("--spacing-0")).toBe("0");
  });
});
