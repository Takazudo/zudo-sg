import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  analyzeComposableComponents,
  CLASSIFICATIONS,
  POLICY_OVERRIDES,
  renderComposableComponentReport,
} from "../lib/composable-component-policy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const script = resolve(root, "scripts/report-composable-components.mjs");

describe("composable component policy inventory", () => {
  it("discovers the complete public callable surface and classifies every row deterministically", () => {
    const first = analyzeComposableComponents(root);
    const second = analyzeComposableComponents(root);
    expect(first.errors).toEqual([]);
    expect(first.rows).toEqual(second.rows);
    expect(first.rows.map((row) => row.identity)).toEqual(
      [...first.rows.map((row) => row.identity)].sort((a, b) => a.localeCompare(b)),
    );
    expect(Object.keys(first.counts)).toEqual(CLASSIFICATIONS);
    expect(Object.values(first.counts).reduce((sum, count) => sum + count, 0)).toBe(first.total);
    expect(first.total).toBeGreaterThan(0);
  }, 15_000);

  it("reports all current sidecars plus the required policy spot checks", () => {
    const report = analyzeComposableComponents(root);
    const byName = new Map(report.rows.map((row) => [row.component, row]));
    const discoveredSidecars = execFileSync(
      "git",
      [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        "packages/ui/src/**/*.composer.tsx",
      ],
      { cwd: root, encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean)
      .sort();
    const reportedSidecars = report.rows
      .filter((row) => row.classification === "has-sidecar")
      .map((row) => row.evidence)
      .sort();
    expect(reportedSidecars).toEqual(discoveredSidecars);
    expect(byName.get("RecruitBand")?.classification).toBe("expressible-but-unonboarded");
    expect(byName.get("NewsList")).toMatchObject({
      classification: "not-expressible",
      reasonCode: "caller-derived-collection",
    });
  });

  it("detects stale overrides as check inconsistencies", () => {
    const report = analyzeComposableComponents(root, {
      ...POLICY_OVERRIDES,
      RemovedComponent: ["explicitly-excluded", "test", "stale fixture"],
    });
    expect(report.errors).toContain("RemovedComponent: stale policy override (not a public component)");
  });

  it("renders stable machine-readable rows and exact category totals", () => {
    const report = analyzeComposableComponents(root);
    const output = renderComposableComponentReport(report);
    expect(output.match(/^ROW\t/gm)).toHaveLength(report.total);
    for (const classification of CLASSIFICATIONS) {
      expect(output).toContain(`COUNT\t${classification}\t${report.counts[classification]}`);
    }
    expect(output).toContain(`COUNT\ttotal\t${report.total}`);
  });

  it("keeps honest onboarding gaps advisory in --check mode", () => {
    const result = spawnSync(process.execPath, [script, "--check"], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("STATUS\tinconsistencies\t0");
    expect(result.stdout).toMatch(/STATUS\tadvisory-gaps\t[1-9]\d*/);
  }, 15_000);
});
