import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DOC6_LANE_FIXTURE,
  doc6LaneInstalledProblems,
  doc6LaneManifestProblems,
} from "../descriptor-host-compat-lane.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function laneManifest(overrides: Record<string, unknown> = {}) {
  return {
    dependencies: { "@takazudo/zudo-doc": "6.2.0", katex: "^0.16.38", ...overrides },
  };
}

describe("descriptor-host doc 6 compat lane", () => {
  it("holds for the committed fixture manifest", () => {
    const manifest = JSON.parse(
      readFileSync(join(REPO_ROOT, DOC6_LANE_FIXTURE, "package.json"), "utf8"),
    );
    expect(doc6LaneManifestProblems(manifest)).toEqual([]);
  });

  it("accepts exact and caret KaTeX 0.16 specs", () => {
    expect(doc6LaneManifestProblems(laneManifest())).toEqual([]);
    expect(doc6LaneManifestProblems(laneManifest({ katex: "0.16.47" }))).toEqual([]);
  });

  it.each(["7.0.0", "^6.2.0", "6.1.1", undefined])(
    "rejects a resolver-style zudo-doc rewrite to %j",
    (spec) => {
      const problems = doc6LaneManifestProblems(laneManifest({ "@takazudo/zudo-doc": spec }));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("compat lane");
    },
  );

  it.each(["^0.19.0", "0.18.2", "^0.16", "~0.16.38", undefined])(
    "rejects KaTeX %j",
    (spec) => {
      const problems = doc6LaneManifestProblems(laneManifest({ katex: spec }));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("katex on 0.16.x");
    },
  );

  it("rejects adding history-server or a Node floor that excludes Node 22", () => {
    expect(
      doc6LaneManifestProblems(laneManifest({ "@takazudo/zudo-doc-history-server": "6.2.0" })),
    ).toHaveLength(1);
    expect(doc6LaneManifestProblems({ ...laneManifest(), engines: { node: ">=24 <25" } })).toHaveLength(1);
    expect(doc6LaneManifestProblems({ ...laneManifest(), engines: { node: ">=22" } })).toEqual([]);
  });

  it("checks the installed versions", () => {
    expect(doc6LaneInstalledProblems({ zudoDoc: "6.2.0", katex: "0.16.47" })).toEqual([]);
    expect(doc6LaneInstalledProblems({ zudoDoc: "7.0.0", katex: "0.19.0" })).toHaveLength(2);
  });
});
