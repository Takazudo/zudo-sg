import type { BrowserCompositionRecord } from "./composer-persistence";

export const SOURCE_RECORD_ID = "site-shell";
export const PATTERN_RECORD_ID = "marketing-pattern";

export interface ReuseNode {
  id: string;
  componentId: string;
  componentVersion: 1;
  props: Record<string, string | boolean>;
  slots: Record<string, ReuseNode[]>;
}

export interface ReuseDocument {
  [key: string]: unknown;
  schemaVersion: 1 | 2;
  id: string;
  name: string;
  root: ReuseNode[];
  publication?:
    | { kind: "pattern" }
    | {
        kind: "global-template";
        outlet: { id: string; label: string; target: { parentId: string; slotId: string } };
      };
  binding?: { sourceRecordId: string; outletId: string };
}

export function component(
  id: string,
  componentId: string,
  props: Record<string, string | boolean> = {},
  slots: Record<string, ReuseNode[]> = {},
): ReuseNode {
  return { id, componentId, componentVersion: 1, props, slots };
}

export function record(document: ReuseDocument): BrowserCompositionRecord {
  return {
    id: document.id,
    createdAt: "2026-07-14T00:00:00.000Z",
    updatedAt: "2026-07-14T00:00:00.000Z",
    document,
  };
}

/** Header/outlet/footer source. The empty Stack content slot is the one published outlet. */
export function globalTemplateRecord(id = SOURCE_RECORD_ID, name = "Site shell"): BrowserCompositionRecord {
  return record({
    schemaVersion: 2,
    id,
    name,
    root: [
      component("source-header", "ui.section-heading", {
        eyebrow: "Global",
        heading: "Original source heading",
        intro: "Source-owned header",
      }),
      component("source-outlet", "ui.stack", {
        direction: "vertical",
        gap: "md",
        align: "stretch",
        justify: "start",
      }, { content: [] }),
      component("source-footer", "ui.cta-button", {
        href: "/contact",
        variant: "primary",
        arrow: true,
        children: "Source footer",
      }),
    ],
    publication: {
      kind: "global-template",
      outlet: {
        id: "main-content",
        label: "Main content",
        target: { parentId: "source-outlet", slotId: "content" },
      },
    },
  });
}

export function boundConsumerRecord(
  id: string,
  name: string,
  sourceRecordId = SOURCE_RECORD_ID,
): BrowserCompositionRecord {
  return record({
    schemaVersion: 2,
    id,
    name,
    root: [],
    binding: { sourceRecordId, outletId: "main-content" },
  });
}

/** A multi-root Pattern makes the insertion test prove an atomic forest clone. */
export function patternRecord(id = PATTERN_RECORD_ID): BrowserCompositionRecord {
  return record({
    schemaVersion: 2,
    id,
    name: "Marketing block",
    root: [
      component("pattern-heading", "ui.section-heading", {
        eyebrow: "Pattern",
        heading: "Pattern heading",
        intro: "Copied rather than linked",
      }),
      component("pattern-cta", "ui.cta-button", {
        href: "/products",
        variant: "secondary",
        arrow: true,
        children: "Pattern call to action",
      }),
    ],
    publication: { kind: "pattern" },
  });
}

export function patternTargetRecord(): BrowserCompositionRecord {
  return record({
    schemaVersion: 2,
    id: "pattern-target",
    name: "Pattern target",
    root: [
      component("target-stack", "ui.stack", {
        direction: "vertical",
        gap: "md",
        align: "stretch",
        justify: "start",
      }, { content: [] }),
    ],
  });
}

/** The v1 fixture must decode to the same unbound schema-v2 record shape. */
export function legacyV1Record(): ReuseDocument {
  return {
    schemaVersion: 1,
    id: "legacy-v1",
    name: "Legacy composition",
    root: [
      component("legacy-copy", "ui.prose-p", { children: "Migrated without a reusable role." }),
    ],
  };
}

export function reuseDocument(recordValue: BrowserCompositionRecord): ReuseDocument {
  return recordValue.document as ReuseDocument;
}
