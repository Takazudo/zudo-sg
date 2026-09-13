// Generic CSS custom-property extractor built on postcss's AST — NOT regex.
// A regex scan of design-token CSS breaks on exactly the constructs such
// files are full of: `@theme { ... }` nesting, `light-dark(var(--a),
// var(--b))` pairs (commas inside parens), multi-layer `oklch(... / ...)`
// shadow values, and trailing `/* ... */` comments on the same line as a
// declaration. postcss parses all of that structurally, so extraction only
// has to walk `Decl` nodes — no hand-rolled brace/paren/comment matching.
//
// Ported from the host's former `scripts/lib/css-var-parser.mjs`; a
// byte-equivalent copy also stays there for the host's own
// `scripts/gen-root-token-manifest.mjs` / `scripts/ui-contrast-pairs.ts`,
// which are out of this package's scope (they parse the ROOT host's own
// `src/styles/global.css`, not a components-root token file).
//
// Deliberately dumb: it does not care which rule/at-rule a declaration lives
// under (`@theme`, plain `:root`, `:root[data-theme="..."]`, ...). Callers
// that need to distinguish sources parse each file separately (see
// ui-token-manifest.ts, which calls this once per CSS file).

import { parse } from "postcss";

/**
 * Collapse a declaration's raw value to a single line with single spaces.
 */
function normalizeValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Parse `cssText` and return every `--custom-property: value;` declaration
 * found anywhere in the stylesheet, keyed by property name, value
 * whitespace-normalized.
 *
 * Throws (via postcss) on malformed CSS. Throws explicitly if the same
 * custom property is declared twice with two different values.
 */
export function parseCssCustomProperties(cssText: string): Map<string, string> {
  const root = parse(cssText);
  const vars = new Map<string, string>();
  root.walkDecls((decl) => {
    if (!decl.prop.startsWith("--")) return;
    const value = normalizeValue(decl.value);
    const existing = vars.get(decl.prop);
    if (existing !== undefined && existing !== value) {
      throw new Error(
        `Custom property "${decl.prop}" is declared twice with different values ` +
          `("${existing}" vs "${value}") — this parser assumes each token has one value.`,
      );
    }
    vars.set(decl.prop, value);
  });
  return vars;
}
