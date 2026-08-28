import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/config/contrast-utils";
import { colorSchemes } from "../../src/config/color-schemes";
import { evaluateScheme, PAIR_MATRIX } from "../contrast-pair-matrix";
import {
  loadProseMdPreBackground,
  resolveRef,
  sides,
} from "../ui-contrast-pairs";

describe("ui contrast source resolver", () => {
  it("resolves a nested fallback and selects the active light-dark side", () => {
    const vars = new Map([
      ["--light-bg", "oklch(.970 .006 75)"],
      ["--dark-bg", "oklch(.235 .010 75)"],
      ["--light-surface-2", "oklch(.885 .009 75)"],
      ["--dark-surface-2", "oklch(.410 .012 75)"],
      ["--color-bg", "light-dark(var(--light-bg), var(--dark-bg))"],
      ["--color-surface-2", "light-dark(var(--light-surface-2), var(--dark-surface-2))"],
    ]);
    const fallback = "var(--missing-code-bg, color-mix(in oklch, var(--color-bg) 80%, var(--color-surface-2)))";

    const light = resolveRef(fallback, vars, "light");
    const dark = resolveRef(fallback, vars, "dark");

    expect(light).toMatch(/^oklch\(/);
    expect(dark).toMatch(/^oklch\(/);
    expect(contrastRatio("oklch(.470 .120 56)", light)).toBeGreaterThan(4.5);
    expect(contrastRatio("oklch(.700 .158 62)", dark)).toBeGreaterThan(4.5);
  });

  it("uses the declared var before its fallback and follows nested var fallbacks", () => {
    const vars = new Map([
      ["--declared", "oklch(.700 .100 20)"],
      ["--fallback", "oklch(.300 .020 20)"],
      ["--broken", "var(--not-defined)"],
    ]);

    expect(resolveRef("var(--declared, oklch(.100 0 0))", vars)).toBe("oklch(.700 .100 20)");
    expect(resolveRef("var(--missing, var(--fallback))", vars)).toBe("oklch(.300 .020 20)");
    expect(resolveRef("var(--broken, var(--fallback))", vars)).toBe("oklch(.300 .020 20)");
  });

  it("interpolates color-mix in OKLCH rather than the sRGB helper's space", () => {
    const mixed = resolveRef("color-mix(in oklch, oklch(.8 0 0) 80%, oklch(.2 0 0))", new Map());

    // OKLCH lightness is linear here: .8 * .8 + .2 * .2 = .68. An sRGB mix
    // would not preserve this lightness value.
    expect(mixed).toBe("oklch(0.68 0 0)");
  });

  it("resolves light-dark semantic sides with nested function commas", () => {
    const vars = new Map([
      ["--light", "oklch(.9 0 0)"],
      ["--dark", "oklch(.2 0 0)"],
      ["--color-example", "light-dark(var(--light), color-mix(in oklch, var(--dark) 50%, oklch(.4 0 0)))"],
    ]);

    expect(sides("example", vars)).toEqual({
      light: "oklch(.9 0 0)",
      dark: "oklch(0.30000000000000004 0 0)",
    });
  });

  it("reads the real ProseMd pre declaration instead of hardcoding its fallback", () => {
    const declaration = loadProseMdPreBackground().replace(/\s+/g, " ");
    expect(declaration).toContain("var( --zfb-hi-bg,");
    expect(declaration).toContain("color-mix(in oklch,");
  });
});

describe("contrast matrix syntax fence coverage", () => {
  it("gates every syntax role on both doc-page and preview fence sources", () => {
    const syntaxPairs = PAIR_MATRIX.filter(
      (pair) => pair.key.startsWith("syntax-") && !pair.key.includes("-painted-"),
    );
    expect(syntaxPairs).toHaveLength(18);

    expect(syntaxPairs.filter((pair) => pair.surface === "doc-page").every((pair) => pair.fgVar.startsWith("--zd-syntax-"))).toBe(true);
    expect(syntaxPairs.filter((pair) => pair.surface === "preview").every((pair) => pair.fgVar.startsWith("--zfb-hi-"))).toBe(true);
    expect(syntaxPairs.filter((pair) => pair.surface === "preview").every((pair) => pair.bgVar === "--zfb-hi-bg")).toBe(true);
  });

  it("measures the approved dark deleted role on both real fence surfaces", () => {
    const report = evaluateScheme("Default Dark", colorSchemes["Default Dark"]!, "colorSchemes");
    const doc = report.pairs.find((pair) => pair.key === "syntax-deleted-vs-doc-page-fence");
    const preview = report.pairs.find((pair) => pair.key === "syntax-deleted-vs-preview-fence");

    expect(doc?.ratio).toBeCloseTo(4.74, 2);
    expect(preview?.ratio).toBeCloseTo(5.23, 2);
    expect(doc?.pass).toBe(true);
    expect(preview?.pass).toBe(true);
  });

  it("gates the painted deleted tint against each actual fence surface", () => {
    const paintedPairs = PAIR_MATRIX.filter((pair) => pair.key.startsWith("syntax-deleted-painted-vs-"));
    expect(paintedPairs).toHaveLength(2);
    expect(paintedPairs.map((pair) => [pair.surface, pair.bgVar, pair.tintPct])).toEqual([
      ["doc-page", "--zd-bg", 15],
      ["preview", "--color-bg", 15],
    ]);

    for (const name of ["Default Light", "Default Dark"] as const) {
      const report = evaluateScheme(name, colorSchemes[name]!, "colorSchemes");
      for (const pair of paintedPairs) {
        expect(report.pairs.find((result) => result.key === pair.key)?.pass).toBe(true);
      }
    }

    const darkReport = evaluateScheme("Default Dark", colorSchemes["Default Dark"]!, "colorSchemes");
    expect(darkReport.pairs.find((pair) => pair.key === "syntax-deleted-painted-vs-doc-page-fence")?.ratio).toBeCloseTo(5.28, 2);
    expect(darkReport.pairs.find((pair) => pair.key === "syntax-deleted-painted-vs-preview-fence")?.ratio).toBeCloseTo(4.65, 2);
  });

});
