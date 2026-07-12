// Shared test fixtures for the Composer model/source suites.
//
// These are the issue's OWN fixture definitions — the model/source modules are
// built and tested independently of the real component cohort (owned by #246,
// which does not exist on this branch). The fixture manifest deliberately
// reuses the native sample's component/slot ids (imported from `sample-ids`) so
// the sample document validates against it, and adds a few extra components to
// exercise default exports, alias collisions, single-cardinality, and
// `accepts` whitelists.

import type { ComposerFieldMeta, ComposerSlotMeta, ComposerSource } from "@zudo-sg/ui";
import type {
  ComponentManifestEntry,
  CompositionDocument,
  CompositionNode,
  JsonObject,
} from "../model/types";
import { COMPOSITION_SCHEMA_VERSION, createManifest } from "../model/types";
import { SAMPLE_COMPONENT_IDS as C, SAMPLE_SLOT_IDS as S } from "../sample/sample-ids";

function src(module: string, exportName: string, exportKind: "named" | "default" = "named"): ComposerSource {
  return { module, exportName, exportKind };
}

const fields = {
  gapSelect: { kind: "select", prop: "gap", label: "Gap", options: ["sm", "md", "lg"] } as ComposerFieldMeta,
  ratioSelect: {
    kind: "select",
    prop: "ratio",
    label: "Ratio",
    options: ["50-50", "33-67", "67-33"],
  } as ComposerFieldMeta,
  sizeSelect: { kind: "select", prop: "size", label: "Size", options: ["sm", "md", "lg"] } as ComposerFieldMeta,
};

/** Extra fixture-only component ids (not part of the native sample cohort). */
export const FIXTURE_COMPONENT_IDS = {
  box: "x.box",
  widgetA: "x.widget-a",
  widgetB: "x.widget-b",
  gallery: "x.gallery",
} as const;

export const fixtureEntries: ComponentManifestEntry[] = [
  {
    componentId: C.splitLayout,
    version: 1,
    source: src("@fixtures/split-layout", "SplitLayout"),
    defaults: { ratio: "50-50", gap: "md" },
    fields: [fields.ratioSelect, fields.gapSelect],
    slots: [
      { id: S.splitLeft, prop: "left", label: "Left", cardinality: "single" } as ComposerSlotMeta,
      { id: S.splitRight, prop: "right", label: "Right", cardinality: "many" } as ComposerSlotMeta,
    ],
  },
  {
    componentId: C.stack,
    version: 1,
    source: src("@fixtures/stack", "Stack"),
    defaults: { gap: "md" },
    fields: [fields.gapSelect],
    slots: [{ id: S.stackChildren, prop: "children", label: "Children", cardinality: "many" } as ComposerSlotMeta],
  },
  {
    componentId: C.sectionHeading,
    version: 1,
    source: src("@fixtures/section-heading", "SectionHeading"),
    defaults: { heading: "Heading", as: "h2" },
    fields: [
      { kind: "text", prop: "eyebrow", label: "Eyebrow" } as ComposerFieldMeta,
      { kind: "text", prop: "heading", label: "Heading" } as ComposerFieldMeta,
      { kind: "select", prop: "as", label: "As", options: ["h2", "h3"] } as ComposerFieldMeta,
    ],
    slots: [],
  },
  {
    // A leaf whose scalar `children` text field renders as a TEXT-BOUND child.
    componentId: C.prose,
    version: 1,
    source: src("@fixtures/prose", "Prose"),
    defaults: { size: "md", children: "Body text." },
    fields: [
      { kind: "text", prop: "children", label: "Text" } as ComposerFieldMeta,
      fields.sizeSelect,
    ],
    slots: [],
  },
  {
    componentId: C.ctaButton,
    version: 1,
    source: src("@fixtures/cta-button", "CtaButton"),
    defaults: { href: "#", variant: "solid", arrow: false, children: "Go" },
    fields: [
      { kind: "text", prop: "children", label: "Label" } as ComposerFieldMeta,
      { kind: "text", prop: "href", label: "Href" } as ComposerFieldMeta,
      { kind: "select", prop: "variant", label: "Variant", options: ["solid", "ghost"] } as ComposerFieldMeta,
      { kind: "boolean", prop: "arrow", label: "Arrow" } as ComposerFieldMeta,
    ],
    slots: [],
  },
  {
    // Default-export leaf with a number field — exercises default imports.
    componentId: FIXTURE_COMPONENT_IDS.box,
    version: 1,
    source: src("@fixtures/box", "Box", "default"),
    defaults: { label: "Box" },
    fields: [
      { kind: "text", prop: "label", label: "Label" } as ComposerFieldMeta,
      { kind: "number", prop: "size", label: "Size", min: 0, max: 10 } as ComposerFieldMeta,
    ],
    slots: [],
  },
  {
    // Two components exporting the SAME name from DIFFERENT modules — the
    // generator must assign collision-safe aliases.
    componentId: FIXTURE_COMPONENT_IDS.widgetA,
    version: 1,
    source: src("@fixtures/widget-a", "Widget"),
    defaults: {},
    fields: [],
    slots: [],
  },
  {
    componentId: FIXTURE_COMPONENT_IDS.widgetB,
    version: 1,
    source: src("@fixtures/widget-b", "Widget"),
    defaults: {},
    fields: [],
    slots: [],
  },
  {
    // A container whose slot only ACCEPTS boxes — exercises the accepts guard.
    componentId: FIXTURE_COMPONENT_IDS.gallery,
    version: 1,
    source: src("@fixtures/gallery", "Gallery"),
    defaults: {},
    fields: [],
    slots: [
      {
        id: "items",
        prop: "children",
        label: "Items",
        cardinality: "many",
        accepts: [FIXTURE_COMPONENT_IDS.box],
      } as ComposerSlotMeta,
    ],
  },
];

export const fixtureManifest = createManifest(fixtureEntries);

// ── Node/document builders ───────────────────────────────────────────────────

let nodeCounter = 0;
/** Reset the fixture node-id counter so a test gets deterministic ids. */
export function resetFixtureIds(): void {
  nodeCounter = 0;
}

export function node(
  componentId: string,
  props: JsonObject = {},
  slots: Record<string, CompositionNode[]> = {},
  id?: string,
): CompositionNode {
  nodeCounter += 1;
  return {
    id: id ?? `${componentId.replace(/[^a-z0-9]+/gi, "-")}-${nodeCounter}`,
    componentId,
    componentVersion: 1,
    props,
    slots,
  };
}

export function doc(root: CompositionNode[], name = "Fixture"): CompositionDocument {
  return { schemaVersion: COMPOSITION_SCHEMA_VERSION, id: "fixture", name, root };
}

/**
 * The canonical A/B/C right-slot fixture: SplitLayout with A in `left` and B,C
 * in `right`. Tree traversal order must equal generated-source order for it.
 */
export function makeAbcDocument(): CompositionDocument {
  return doc([
    node(
      C.splitLayout,
      { ratio: "50-50", gap: "md" },
      {
        [S.splitLeft]: [node(FIXTURE_COMPONENT_IDS.box, { label: "A" }, {}, "A")],
        [S.splitRight]: [
          node(FIXTURE_COMPONENT_IDS.box, { label: "B" }, {}, "B"),
          node(FIXTURE_COMPONENT_IDS.box, { label: "C" }, {}, "C"),
        ],
      },
      "split",
    ),
  ]);
}
