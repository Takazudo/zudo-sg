// scripts/lib/css-var-parser.mjs
//
// Generic CSS custom-property extractor built on postcss's AST — NOT regex.
// A regex scan of these token files breaks on exactly the constructs they're
// full of: `@theme { ... }` nesting, `light-dark(var(--a), var(--b))` pairs
// (commas inside parens), multi-layer `oklch(... / ...)` shadow values, and
// trailing `/* ... */` comments on the same line as a declaration. postcss
// parses all of that structurally, so extraction only has to walk `Decl`
// nodes — no hand-rolled brace/paren/comment matching.
//
// Deliberately dumb: it does not care which rule/at-rule a declaration lives
// under (`@theme`, plain `:root`, `:root[data-theme="..."]`, ...). Callers
// that need to distinguish sources parse each file separately (see
// ui-token-manifest.mjs, which calls this once per CSS file).

import { parse } from "postcss";

/**
 * Collapse a declaration's raw value to a single line with single spaces.
 * Multi-line multi-layer values (e.g. `--shadow-card`) are written with
 * newlines + alignment padding in the source for readability; the manifest
 * stores them as one-line strings.
 */
function normalizeValue(value) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Parse `cssText` and return every `--custom-property: value;` declaration
 * found anywhere in the stylesheet (inside `@theme`, `:root`, or any other
 * rule/at-rule), keyed by property name, value whitespace-normalized.
 *
 * Throws (via postcss) on malformed CSS. Throws explicitly if the same
 * custom property is declared twice with two different values — silently
 * picking one would hide a real authoring mistake.
 *
 * @param {string} cssText
 * @returns {Map<string, string>}
 */
export function parseCssCustomProperties(cssText) {
  const root = parse(cssText);
  const vars = new Map();
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
