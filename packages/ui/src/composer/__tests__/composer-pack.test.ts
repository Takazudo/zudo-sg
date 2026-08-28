import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateRuntimeParity } from "@zudo-composer/component-contract";
import * as publicUi from "@zudo-sg/ui";
import {
  componentPack as sourcePack,
  componentPackManifest as sourceManifest,
  componentRuntimeRegistry as sourceRuntime,
} from "../../composer-pack";
import {
  componentPack,
  componentPackManifest,
  componentRuntimeRegistry,
} from "@zudo-sg/ui/composer-pack";

function containsFunction(value: unknown, seen = new Set<unknown>()): boolean {
  if (typeof value === "function") return true;
  if (value === null || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value as Record<string, unknown>).some((child) =>
    containsFunction(child, seen),
  );
}

describe("public composer pack", () => {
  it("resolves the public subpath to the generated source exports", () => {
    expect(componentPack).toBe(sourcePack);
    expect(componentPackManifest).toBe(sourceManifest);
    expect(componentRuntimeRegistry).toBe(sourceRuntime);
  });

  it("pins the exact v1 component and slot inventory", () => {
    expect(
      componentPackManifest.components.map(({ id, schemaVersion, slots }) => ({
        id,
        schemaVersion,
        slots,
      })),
    ).toEqual([
      { id: "ui.callout", schemaVersion: 1, slots: [{ id: "body", prop: "children", label: "Body", cardinality: "many" }] },
      { id: "ui.card", schemaVersion: 1, slots: [{ id: "body", prop: "children", label: "Body", cardinality: "many" }] },
      { id: "ui.prose-md", schemaVersion: 1, slots: [] },
      { id: "ui.prose-p", schemaVersion: 1, slots: [] },
      { id: "ui.placeholder-box", schemaVersion: 1, slots: [] },
      { id: "ui.auto-grid", schemaVersion: 1, slots: [{ id: "items", prop: "children", label: "Items", cardinality: "many" }] },
      { id: "ui.container", schemaVersion: 1, slots: [{ id: "content", prop: "children", label: "Content", cardinality: "many" }] },
      { id: "ui.cta-button", schemaVersion: 1, slots: [] },
      { id: "ui.hero", schemaVersion: 1, slots: [] },
      { id: "ui.section-heading", schemaVersion: 1, slots: [] },
      {
        id: "ui.split-layout",
        schemaVersion: 1,
        slots: [
          { id: "left", prop: "left", label: "Left", cardinality: "single" },
          { id: "right", prop: "right", label: "Right", cardinality: "many" },
        ],
      },
      { id: "ui.stack", schemaVersion: 1, slots: [{ id: "content", prop: "children", label: "Content", cardinality: "many" }] },
    ]);
  });

  it("keeps manifest and trusted runtime in exact parity", () => {
    expect(validateRuntimeParity(componentPackManifest, componentRuntimeRegistry)).toEqual(
      componentPack,
    );
    expect(Object.keys(componentRuntimeRegistry.components)).toEqual(
      componentPackManifest.components.map((component) => component.id),
    );
  });

  it("keeps the manifest JSON-safe and free of trusted functions", () => {
    expect(containsFunction(componentPackManifest)).toBe(false);
    expect(JSON.parse(JSON.stringify(componentPackManifest))).toEqual(componentPackManifest);
  });

  it("points every public source at the same exported runtime component", () => {
    for (const manifest of componentPackManifest.components) {
      expect(manifest.source.module).toBe("@zudo-sg/ui");
      expect(manifest.source.exportKind).toBe("named");
      expect(
        publicUi[manifest.source.exportName as keyof typeof publicUi],
        manifest.source.exportName,
      ).toBe(componentRuntimeRegistry.components[manifest.id]?.component);
    }
  });

  it("keeps pack aggregation isolated from stories, app internals, and CSS", () => {
    const generated = readFileSync(resolve(__dirname, "../../composer-pack.ts"), "utf8");
    const ordinaryBarrel = readFileSync(resolve(__dirname, "../../index.ts"), "utf8");
    expect(generated).not.toMatch(/\.stories|styleguide\/data|src\/features|\.css["']/);
    expect(generated).not.toContain("source.module");
    expect(ordinaryBarrel).not.toContain("composer-pack");
  });
});
