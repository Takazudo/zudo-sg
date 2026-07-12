// Shared test fixtures for the inspector/toolbar/export UI suites (issue #249).
//
// These are THIS issue's own fixtures — `src/composer/__tests__/fixtures.ts`
// belongs to #245's ownership (under the off-limits `src/composer/**`), so
// this file is a small, independent manifest covering every field `kind`
// (text, multiline text, boolean, number, select, color) plus a container
// with both a single- and a many-cardinality slot, so UI tests can exercise
// the full inspector schema without reaching into another issue's fixtures.

import type { ComposerFieldMeta, ComposerSlotMeta, ComposerSource } from "@zudo-sg/ui";
import type {
  ComponentManifestEntry,
  CompositionDocument,
  CompositionNode,
  JsonObject,
} from "@/composer";
import { COMPOSITION_SCHEMA_VERSION, createManifest } from "@/composer";

function src(module: string, exportName: string): ComposerSource {
  return { module, exportName, exportKind: "named" };
}

export const TEST_COMPONENT_IDS = {
  panel: "test.panel",
  widget: "test.widget",
  label: "test.label",
} as const;

export const testManifestEntries: ComponentManifestEntry[] = [
  {
    componentId: TEST_COMPONENT_IDS.panel,
    version: 1,
    source: src("@fixtures/panel", "Panel"),
    defaults: {},
    fields: [],
    slots: [
      { id: "left", prop: "left", label: "Left", cardinality: "single" } as ComposerSlotMeta,
      { id: "right", prop: "right", label: "Right", cardinality: "many" } as ComposerSlotMeta,
    ],
  },
  {
    // Every field `kind` the inspector must render, on one component.
    componentId: TEST_COMPONENT_IDS.widget,
    version: 1,
    source: src("@fixtures/widget", "Widget"),
    defaults: {
      title: "Untitled",
      note: "Line one",
      enabled: true,
      count: 3,
      variant: "solid",
      tint: "#336699",
    },
    fields: [
      { kind: "text", prop: "title", label: "Title" } as ComposerFieldMeta,
      {
        kind: "text",
        prop: "note",
        label: "Note",
        inlineEdit: { multiline: true },
      } as ComposerFieldMeta,
      { kind: "boolean", prop: "enabled", label: "Enabled" } as ComposerFieldMeta,
      { kind: "number", prop: "count", label: "Count", min: 0, max: 10, step: 1 } as ComposerFieldMeta,
      {
        kind: "select",
        prop: "variant",
        label: "Variant",
        options: ["solid", "ghost"],
      } as ComposerFieldMeta,
      { kind: "color", prop: "tint", label: "Tint" } as ComposerFieldMeta,
    ],
    slots: [],
  },
  {
    componentId: TEST_COMPONENT_IDS.label,
    version: 1,
    source: src("@fixtures/label", "Label"),
    defaults: { text: "Hello" },
    fields: [{ kind: "text", prop: "text", label: "Text" } as ComposerFieldMeta],
    slots: [],
  },
];

export const testManifest = createManifest(testManifestEntries);

let counter = 0;
/** Reset the fixture node-id counter so a test gets deterministic ids. */
export function resetTestIds(): void {
  counter = 0;
}

export function makeNode(
  componentId: string,
  props: JsonObject = {},
  slots: Record<string, CompositionNode[]> = {},
  id?: string,
): CompositionNode {
  counter += 1;
  return {
    id: id ?? `${componentId}-${counter}`,
    componentId,
    componentVersion: 1,
    props,
    slots,
  };
}

export function makeDocument(root: CompositionNode[], name = "Test document"): CompositionDocument {
  return { schemaVersion: COMPOSITION_SCHEMA_VERSION, id: "test-doc", name, root };
}
