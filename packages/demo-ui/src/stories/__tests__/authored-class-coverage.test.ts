import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getCandidateSetHash,
  getConfiguredAuthoredClassReservations,
  getWindCompilerVersion,
  getWindConfigHash,
  readAuthoredCssClasses,
  scanDemoUiClasses,
} from "../../../scripts/authored-class-coverage";

const REPO_ROOT = resolve(__dirname, "../../../../../");
const FIXTURE_PATH = resolve(__dirname, "authored-class-coverage.wind-explain.json");
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as {
  schemaVersion: number;
  compilerVersion: string;
  windConfigSha256: string;
  candidateSetSha256: string;
  candidates: string[];
  command: string[];
  windExplain: {
    schemaVersion: number;
    command: string;
    explanations: Array<{ candidate: string; outcome: string; diagnostics: unknown[] }>;
  };
};

const MARKER_ONLY_CLASSES = new Map([
  ["group", "target for group-* variants"],
  ["peer", "target for peer-* variants"],
]);
const HOOK_ONLY_CLASSES = new Map([
  ["hash-link", "zudo-doc heading permalink hook consumed by ProseA"],
]);
const TEST_FIXTURE_CLASSES = new Map([
  ["extra-class", "consumer-provided class in card-grid.test.tsx to verify class forwarding; not emitted by demo-ui"],
]);
const RESERVED_AUTHORED_CLASSES = new Map<string, string>();

describe("demo-ui authored class coverage", () => {
  it("accounts for every static class token in demo-ui TSX", () => {
    const scan = scanDemoUiClasses(REPO_ROOT);
    const candidates = scan.classes.map(({ token }) => token);
    const cssClasses = readAuthoredCssClasses(REPO_ROOT);
    const configuredReservations = getConfiguredAuthoredClassReservations(REPO_ROOT);
    const explanations = new Map(fixture.windExplain.explanations.map((item) => [item.candidate, item]));

    expect(scan.dynamicConstructions, "class values must use literal unions, not dynamic concatenation").toEqual([]);
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.compilerVersion).toBe("4.3.1");
    expect(getWindCompilerVersion(REPO_ROOT)).toBe(fixture.compilerVersion);
    expect(fixture.windConfigSha256).toBe(getWindConfigHash(REPO_ROOT, fixture.compilerVersion));
    expect(fixture.candidateSetSha256).toBe(getCandidateSetHash(candidates));
    expect(fixture.candidates).toEqual(candidates);
    expect(fixture.windExplain.schemaVersion).toBe(1);
    expect(fixture.windExplain.command).toBe("explain");
    expect(fixture.command).toEqual([
      "pnpm",
      "exec",
      "zfb",
      "wind",
      "explain",
      "--json",
      "--stdin",
      "--project-root",
      ".",
    ]);
    expect(fixture.windExplain.explanations.map((item) => item.candidate)).toEqual(candidates);
    expect([...configuredReservations].sort()).toEqual([...RESERVED_AUTHORED_CLASSES.keys()].sort());
    expect([...configuredReservations].every((token) => cssClasses.has(token))).toBe(true);

    const unaccounted: string[] = [];
    const malformed: string[] = [];
    for (const { token, locations } of scan.classes) {
      const explanation = explanations.get(token);
      if (!explanation) {
        unaccounted.push(`${token} (${locations.join(", ")}): missing cached zfb result`);
        continue;
      }

      if (MARKER_ONLY_CLASSES.has(token)) {
        if (explanation.outcome !== "marker") malformed.push(`${token}: expected marker, got ${explanation.outcome}`);
        continue;
      }

      if (TEST_FIXTURE_CLASSES.has(token)) {
        if (!locations.every((location) => location.includes("/__tests__/"))) {
          malformed.push(`${token}: test-fixture exception also appears in production source`);
        }
        continue;
      }

      if (cssClasses.has(token)) {
        if (token.startsWith("zc-") || token.startsWith("sg-")) {
          if (explanation.outcome !== "ordinary") malformed.push(`${token}: authored class unexpectedly resolves as ${explanation.outcome}`);
        } else if (RESERVED_AUTHORED_CLASSES.has(token)) {
          if (!configuredReservations.has(token)) malformed.push(`${token}: missing wind.authoredClasses reservation`);
          if (explanation.outcome !== "ordinary") malformed.push(`${token}: reserved authored class unexpectedly resolves as ${explanation.outcome}`);
        } else {
          unaccounted.push(`${token} (${locations.join(", ")}): authored CSS class needs zc-/sg- prefix or explicit reservation`);
        }
        continue;
      }

      if (HOOK_ONLY_CLASSES.has(token)) {
        if (explanation.outcome !== "ordinary") malformed.push(`${token}: hook-only class unexpectedly resolves as ${explanation.outcome}`);
        continue;
      }

      if (explanation.outcome !== "resolved_utility") {
        unaccounted.push(`${token} (${locations.join(", ")}): ${explanation.outcome}`);
      }
      if (explanation.diagnostics.length > 0) {
        malformed.push(`${token}: ${JSON.stringify(explanation.diagnostics)}`);
      }
    }

    expect(unaccounted, "each class must be a wind utility, a CSS selector, or an explicit marker/hook class").toEqual([]);
    expect(malformed, "authored replacements must have real selectors and marker/hook classes need their named category").toEqual([]);
    expect([...RESERVED_AUTHORED_CLASSES.keys()].every((token) => configuredReservations.has(token) && cssClasses.has(token))).toBe(true);
    expect([...HOOK_ONLY_CLASSES.keys()].every((token) => !cssClasses.has(token))).toBe(true);
  });
});
