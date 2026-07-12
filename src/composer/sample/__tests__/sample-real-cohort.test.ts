import { describe, expect, it } from "vitest";
import { createSampleDocument } from "../sample-document";
import type { CompositionNode } from "../../model/types";
import {
  composerManifest,
  type ComposerManifestEntry,
} from "../../../styleguide/data/composer-registry";

// Integration guard: #245's native sample is authored as string ids/props, and
// #245's own suite validates it only against a fixture manifest — so a prop value
// that is not a valid control option (e.g. SplitLayout `ratio: "50-50"` when the
// real component keys on "50/50") passes every #245 test yet throws at render.
// This test binds the sample to the REAL #246 cohort manifest, the first point
// where both coexist, and fails on that class of cross-branch drift.
describe("native sample ↔ real Composer cohort", () => {
  const byId = new Map<string, ComposerManifestEntry>(
    composerManifest.map((entry) => [entry.componentId, entry]),
  );

  const nodes: CompositionNode[] = [];
  const walk = (list: CompositionNode[]) => {
    for (const node of list) {
      nodes.push(node);
      for (const children of Object.values(node.slots ?? {})) walk(children);
    }
  };
  walk(createSampleDocument().root);

  it("references only real, opted-in component ids", () => {
    for (const node of nodes) {
      expect(byId.has(node.componentId), `unknown componentId: ${node.componentId}`).toBe(true);
    }
  });

  it("uses only declared slot ids for each component", () => {
    for (const node of nodes) {
      const entry = byId.get(node.componentId);
      if (!entry) continue;
      const declared = new Set(entry.slots.map((slot) => slot.id));
      for (const slotId of Object.keys(node.slots ?? {})) {
        expect(declared.has(slotId), `${node.componentId}: undeclared slot "${slotId}"`).toBe(true);
      }
    }
  });

  it("every select-field prop value is a valid control option", () => {
    for (const node of nodes) {
      const entry = byId.get(node.componentId);
      if (!entry) continue;
      for (const field of entry.fields) {
        if (field.kind !== "select") continue;
        const value = node.props?.[field.prop];
        if (value === undefined) continue;
        expect(
          field.options.includes(value as string),
          `${node.componentId}.${field.prop}="${String(value)}" not in [${field.options.join(", ")}]`,
        ).toBe(true);
      }
    }
  });
});
