#!/usr/bin/env tsx
/**
 * scripts/contrast-audit.ts
 *
 * WCAG contrast audit for every built-in color scheme (`colorSchemes` — 2
 * total: Default Light/Dark). Evaluates a data-driven pair matrix (Tier 1
 * text pairs ≥ 4.5:1, Tier 2 graphics pairs ≥ 3.0:1 unless noted), prints a
 * per-scheme PASS/FAIL table, and writes a machine-readable JSON report.
 *
 * All colors are resolved via `schemeToCssPairs` — the SAME function
 * `ColorSchemeProvider`-equivalent code in this project uses to emit
 * `--zd-*` custom properties in production — so this audit can never
 * silently diverge from what the site actually renders.
 *
 * Ported (trimmed) from zudo-doc's scripts/contrast-audit.ts (feat(a11y):
 * add contrast audit tooling, #2490 / #2492) for issue #116: this repo has
 * no `colorTweakPresets` registry, and fixing flagged pairs is out of scope
 * for #116 (recording them is), so `--suggest`/`--html` are not ported.
 *
 * Usage:
 *   pnpm contrast:audit   # console table + contrast-audit-out/report.json
 *
 * Output goes to a gitignored directory — not committed.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PAIR_MATRIX, getAllPresets, evaluateScheme } from "./contrast-pair-matrix";
import type { SchemeReport } from "./contrast-pair-matrix";
import { evaluateUiSchemes } from "./ui-contrast-pairs";

// ---------------------------------------------------------------------------
// Console report
// ---------------------------------------------------------------------------

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
}

function padCell(str: string, width: number): string {
  return str.length >= width ? str : str + " ".repeat(width - str.length);
}

function printSchemeTable(report: SchemeReport): void {
  const headerLine = `${report.name} [${report.source}] — ${report.passCount}/${report.pairs.length} pairs pass`;
  console.log(headerLine);

  const cols = { key: 26, colors: 22, ratio: 8, threshold: 6, status: 6 };
  const headerRow = [
    padCell("pair", cols.key),
    padCell("fg → bg", cols.colors),
    padCell("ratio", cols.ratio),
    padCell("need", cols.threshold),
    padCell("status", cols.status),
  ].join(" ");
  console.log(headerRow);

  for (const pair of report.pairs) {
    const colorsCell = truncate(`${pair.fg} → ${pair.bg}`, cols.colors);
    const row = [
      padCell(pair.key, cols.key),
      padCell(colorsCell, cols.colors),
      padCell(`${pair.ratio.toFixed(2)}:1`, cols.ratio),
      padCell(`${pair.threshold}:1`, cols.threshold),
      pair.pass ? "PASS" : "FAIL",
    ].join(" ");
    console.log(row);
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const outDir = "contrast-audit-out";

  const presets = getAllPresets();
  const reports = presets.map(({ name, scheme, source }) => evaluateScheme(name, scheme, source));
  // Also audit the @zudo-sg/ui grouped-palette semantic tokens (rail + line
  // accents included) — parsed straight from packages/ui/styles/colors.css.
  reports.push(...evaluateUiSchemes());

  for (const report of reports) {
    printSchemeTable(report);
  }

  const schemesWithFailures = reports.filter((r) => !r.allPass);
  const totalPairs = reports.reduce((sum, r) => sum + r.pairs.length, 0);
  const totalFails = reports.reduce((sum, r) => sum + r.failCount, 0);
  console.log(`${reports.length} schemes evaluated, ${totalPairs} pair checks total.`);
  if (schemesWithFailures.length > 0) {
    console.log(`${schemesWithFailures.length} scheme(s) have at least one failing pair (${totalFails} failing pair checks total).`);
  } else {
    console.log("All schemes pass every pair in the matrix.");
  }

  const outDirAbs = resolve(process.cwd(), outDir);
  await mkdir(outDirAbs, { recursive: true });

  const jsonReport = {
    generatedAt: new Date().toISOString(),
    pairMatrix: PAIR_MATRIX.map(({ key, label, tier, threshold }) => ({ key, label, tier, threshold })),
    schemes: reports,
  };
  const jsonPath = resolve(outDirAbs, "report.json");
  await writeFile(jsonPath, `${JSON.stringify(jsonReport, null, 2)}\n`, "utf-8");
  console.log(`JSON report written to ${jsonPath}`);

  if (schemesWithFailures.length > 0) {
    process.exitCode = 1;
  }
}

await main();
