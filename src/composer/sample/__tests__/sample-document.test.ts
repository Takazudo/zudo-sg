import { describe, expect, it } from "vitest";
import { createSampleDocument, SAMPLE_DOCUMENT } from "../sample-document";
import { SAMPLE_COMPONENT_IDS as C, SAMPLE_SLOT_IDS as S } from "../sample-ids";
import { isJsonSafe } from "../../model/json";
import { indexDocument } from "../../model/index-model";
import { isStructurallyValidDocument, diagnoseDocument } from "../../model/validate";
import { generateJsx } from "../../source/generate-jsx";
import { fixtureManifest as M } from "../../__tests__/fixtures";

describe("native sample document", () => {
  it("is structurally valid and JSON-safe", () => {
    const sample = createSampleDocument();
    expect(isStructurallyValidDocument(sample)).toBe(true);
    expect(isJsonSafe(sample)).toBe(true);
    // round-trips with no data loss
    expect(JSON.parse(JSON.stringify(sample))).toEqual(sample);
  });

  it("exercises the left, right, and default children slots", () => {
    const sample = createSampleDocument();
    const split = sample.root[0];
    expect(split.componentId).toBe(C.splitLayout);
    expect(split.slots[S.splitLeft]).toHaveLength(1); // single left
    expect(split.slots[S.splitRight].length).toBeGreaterThan(1); // many right
    const stack = split.slots[S.splitRight].find((n) => n.componentId === C.stack)!;
    expect(stack.slots[S.stackChildren].length).toBeGreaterThan(0); // default children
  });

  it("contains duplicate component types with distinct node ids", () => {
    const sample = createSampleDocument();
    const index = indexDocument(sample, M);
    const proseIds = [...index.byId.values()]
      .filter((loc) => loc.node.componentId === C.prose)
      .map((loc) => loc.node.id);
    expect(proseIds.length).toBeGreaterThan(1);
    expect(new Set(proseIds).size).toBe(proseIds.length); // all distinct
  });

  it("is fully available (no opaque nodes) under the intended cohort", () => {
    // Validated against the fixture manifest, whose ids/slot-ids are copied
    // verbatim from the real #246 cohort (see sample-ids.ts).
    expect(diagnoseDocument(createSampleDocument(), M).canExport).toBe(true);
  });

  it("generates clean, unblocked JSX", () => {
    const result = generateJsx(createSampleDocument(), M);
    expect(result.ok).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.code).toContain("export function");
  });

  it("exposes a frozen-by-copy canonical constant that cannot be mutated by reference", () => {
    const copy = createSampleDocument();
    copy.name = "mutated";
    expect(SAMPLE_DOCUMENT.name).not.toBe("mutated");
  });
});
