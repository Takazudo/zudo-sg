// Contract of e2e/helpers/round-trip-evidence.ts, the failure-evidence record
// for the preview-token-panel round-trip E2E: observations survive later read
// errors, the raw export is kept even when it does not parse, and finalization
// never throws, so it cannot replace the test's own error or fail a pass.
import { describe, expect, it, vi } from "vitest";
import {
  createRoundTripEvidence,
  enterStage,
  finalizeRoundTripEvidence,
  observe,
  recordExport,
  type Attach,
} from "../../e2e/helpers/round-trip-evidence";

const info = {
  title: "round-trip",
  project: { name: "preview-token-panel" },
  testId: "abc",
  retry: 0,
  repeatEachIndex: 0,
  workerIndex: 3,
  parallelIndex: 1,
};

function setup() {
  const evidence = createRoundTripEvidence(info, { GITHUB_SHA: "deadbeef", UNRELATED: "x" });
  const attached = new Map<string, { body: string; contentType: string }>();
  const attach: Attach = async (name, body, contentType) => {
    attached.set(name, { body, contentType });
  };
  const annotations: Array<{ type: string; description: string }> = [];
  const annotate = (type: string, description: string) => annotations.push({ type, description });
  return { evidence, attached, attach, annotations, annotate, log: vi.fn() };
}

describe("round-trip evidence record", () => {
  it("records run identity and only the CI identity variables", () => {
    const { evidence } = setup();
    expect(evidence.run).toMatchObject({ project: "preview-token-panel", workerIndex: 3 });
    expect(evidence.run.ci).toEqual({ GITHUB_SHA: "deadbeef" });
  });

  it("keeps the last successful observation when a later read fails", async () => {
    const { evidence } = setup();
    await observe(evidence, "post-load", async () => ({ radius: "" }));
    const failed = await observe(evidence, "post-load", async () => {
      throw new Error("Frame was detached");
    });
    expect(failed).toEqual({ readError: "Error: Frame was detached" });
    expect(evidence.observations["post-load"]).toMatchObject({
      last: { radius: "" },
      reads: 2,
      errors: 1,
      lastError: { message: "Error: Frame was detached" },
    });
  });

  it("strips terminal color codes from recorded errors", async () => {
    const { evidence } = setup();
    await observe(evidence, "x", async () => {
      throw new Error("\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m");
    });
    expect(evidence.observations.x.lastError?.message).toBe("Error: expect(received");
  });

  it("keeps raw export bytes even when they do not parse", () => {
    const { evidence } = setup();
    recordExport(evidence, '{"tabs": ');
    expect(evidence.rawExport).toBe('{"tabs": ');
    expect(evidence.parsedExport).toBeUndefined();
    expect(evidence.exportParseError).toMatch(/SyntaxError/);

    recordExport(evidence, '{"tabs":{}}');
    expect(evidence.parsedExport).toEqual({ tabs: {} });
  });
});

describe("finalizeRoundTripEvidence", () => {
  it("attaches the frozen record, raw export and diagnostics with the failing stage", async () => {
    const s = setup();
    enterStage(s.evidence, "import-load");
    recordExport(s.evidence, "not json");
    const errors = await finalizeRoundTripEvidence({
      ...s,
      primaryError: new Error("expect(received).toEqual(expected)"),
      diagnostics: ["console: boom"],
      failureReads: { iframe: async () => ({ radius: "" }) },
    });
    expect(errors).toEqual([]);
    const record = JSON.parse(s.attached.get("round-trip-evidence")!.body);
    expect(record).toMatchObject({
      stage: "import-load",
      outcome: "failed",
      primaryError: "Error: expect(received).toEqual(expected)",
      rawExport: "not json",
      failureReads: { iframe: { radius: "" } },
    });
    expect(s.attached.get("export-raw")!.body).toBe("not json");
    expect(s.attached.get("round-trip-diagnostics")!.body).toBe("console: boom");
  });

  it("skips failure reads on a passing run", async () => {
    const s = setup();
    const read = vi.fn(async () => "x");
    await finalizeRoundTripEvidence({ ...s, diagnostics: [], failureReads: { read } });
    expect(read).not.toHaveBeenCalled();
    expect(JSON.parse(s.attached.get("round-trip-evidence")!.body).outcome).toBe("passed");
    expect(s.attached.has("export-raw")).toBe(false);
  });

  it("records a failing or hanging failure read without throwing", async () => {
    vi.useFakeTimers();
    try {
      const s = setup();
      const done = finalizeRoundTripEvidence({
        ...s,
        primaryError: new Error("primary"),
        diagnostics: [],
        failureReads: {
          detached: async () => {
            throw new Error("Frame was detached");
          },
          hangs: () => new Promise(() => {}),
        },
      });
      await vi.advanceTimersByTimeAsync(2_000);
      await done;
      expect(s.evidence.failureReads).toEqual({
        detached: { readError: "Error: Frame was detached" },
        hangs: { readError: "Error: read timed out after 2000ms" },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("never throws when every attachment fails, and reports each failure separately", async () => {
    const s = setup();
    const attach: Attach = async (name) => {
      throw new Error(`disk full (${name})`);
    };
    recordExport(s.evidence, "{}");
    const errors = await finalizeRoundTripEvidence({
      ...s,
      attach,
      primaryError: new Error("primary"),
      diagnostics: [],
    });
    expect(errors).toEqual([
      "attach round-trip-evidence: Error: disk full (round-trip-evidence)",
      "attach export-raw: Error: disk full (export-raw)",
      "attach round-trip-diagnostics: Error: disk full (round-trip-diagnostics)",
    ]);
    expect(s.annotations.map((a) => a.type)).toEqual(Array(3).fill("evidence-error"));
    expect(s.log).toHaveBeenCalledTimes(3);
  });

  it("preserves the primary error through a caller's try/finally when evidence fails", async () => {
    const s = setup();
    const primary = new Error("Expected: \"20rem\" Received: \"\"");
    const body = async () => {
      try {
        throw primary;
      } finally {
        await finalizeRoundTripEvidence({
          ...s,
          primaryError: primary,
          diagnostics: [],
          annotate: () => {
            throw new Error("annotations frozen");
          },
          attach: async () => {
            throw new Error("attach failed");
          },
        });
      }
    };
    await expect(body()).rejects.toBe(primary);
  });

  it("reports an unserializable record without dropping the other attachments", async () => {
    const s = setup();
    s.evidence.parsedExport = { big: 1n };
    const errors = await finalizeRoundTripEvidence({ ...s, diagnostics: [] });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^serialize round-trip-evidence: TypeError/);
    expect(s.attached.has("round-trip-evidence")).toBe(false);
    expect(s.attached.get("round-trip-diagnostics")!.body).toBe("(none)");
  });
});
