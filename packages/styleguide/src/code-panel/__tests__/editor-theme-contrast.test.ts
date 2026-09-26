// WCAG contrast of the engine editor theme's `--sg-code-*` defaults (#910).
// Parses the `light-dark(<light>, <dark>)` literals out of styles.css so the
// shipped values — not a copy of them — are what gets checked in both schemes.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const STYLES = readFileSync(resolve(import.meta.dirname, "../../../styles.css"), "utf8");

const TOKENS = [
  "bg",
  "fg",
  "gutter-bg",
  "gutter-fg",
  "active-line-bg",
  "selection-bg",
  "cursor",
  "keyword",
  "string",
  "number",
  "comment",
  "function",
  "property",
  "type",
  "tag",
  "attribute",
] as const;
type Token = (typeof TOKENS)[number];
type Scheme = "light" | "dark";

const TEXT_TOKENS: Token[] = [
  "fg",
  "keyword",
  "string",
  "number",
  "comment",
  "function",
  "property",
  "type",
  "tag",
  "attribute",
];

function parseDefaults(): Record<Scheme, Record<Token, string>> {
  const out = { light: {}, dark: {} } as Record<Scheme, Record<Token, string>>;
  for (const token of TOKENS) {
    const match = STYLES.match(
      new RegExp(
        String.raw`--sg-code-${token}:\s*light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)`,
        "i",
      ),
    );
    if (!match) throw new Error(`--sg-code-${token} has no hex light-dark() default`);
    out.light[token] = match[1]!;
    out.dark[token] = match[2]!;
  }
  return out;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const linear = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(n >> 16) + 0.7152 * linear((n >> 8) & 0xff) + 0.0722 * linear(n & 0xff);
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const defaults = parseDefaults();

describe.each(["light", "dark"] as const)("--sg-code-* defaults (%s)", (scheme) => {
  const c = defaults[scheme];

  it.each(TEXT_TOKENS)("%s is ≥ 4.5:1 on code-bg and active-line-bg", (token) => {
    expect(contrast(c[token], c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c[token], c["active-line-bg"])).toBeGreaterThanOrEqual(4.5);
  });

  it("gutter-fg is ≥ 4.5:1 on gutter-bg and active-line-bg", () => {
    expect(contrast(c["gutter-fg"], c["gutter-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c["gutter-fg"], c["active-line-bg"])).toBeGreaterThanOrEqual(4.5);
  });

  it("active-line-bg and selection-bg are distinguishable from code-bg", () => {
    expect(contrast(c["active-line-bg"], c.bg)).toBeGreaterThanOrEqual(1.1);
    expect(contrast(c["selection-bg"], c.bg)).toBeGreaterThanOrEqual(1.1);
    expect(c["selection-bg"]).not.toBe(c["active-line-bg"]);
  });

  it("fg stays ≥ 4.5:1 on selection-bg", () => {
    expect(contrast(c.fg, c["selection-bg"])).toBeGreaterThanOrEqual(4.5);
  });

  it("cursor is ≥ 3:1 on code-bg", () => {
    expect(contrast(c.cursor, c.bg)).toBeGreaterThanOrEqual(3);
  });
});
