// The permanent native Composition sample.
//
// A pure-JSON `CompositionDocument` used as the recovery/reset target. It
// exercises all three slot kinds the epic cares about: a SplitLayout named
// `left` slot (single), a named `right` slot (many), and a Stack DEFAULT
// `content` slot (rendering into the component's `children` prop) — and it
// contains duplicate component types (two `prose-p` leaves) with distinct node
// ids. It imports NO components and reads NO storage/prototype resource; it
// references component/slot ids as strings only, reconciled against the real
// #246 cohort ids (see `sample-ids.ts`).

import type { CompositionDocument } from "../model/types";
import { COMPOSITION_SCHEMA_VERSION } from "../model/types";
import { SAMPLE_COMPONENT_IDS, SAMPLE_COMPONENT_VERSION, SAMPLE_SLOT_IDS } from "./sample-ids";

const V = SAMPLE_COMPONENT_VERSION;
const C = SAMPLE_COMPONENT_IDS;
const S = SAMPLE_SLOT_IDS;

/**
 * A fresh copy of the sample. Returning a builder (not a shared constant)
 * guarantees callers can never mutate the canonical sample by reference.
 */
export function createSampleDocument(): CompositionDocument {
  return {
    schemaVersion: COMPOSITION_SCHEMA_VERSION,
    id: "sample",
    name: "Product overview",
    root: [
      {
        id: "split-1",
        componentId: C.splitLayout,
        componentVersion: V,
        props: { ratio: "50-50", gap: "lg" },
        slots: {
          [S.splitLeft]: [
            {
              id: "heading-1",
              componentId: C.sectionHeading,
              componentVersion: V,
              props: {
                eyebrow: "Composer",
                heading: "Compose real components",
                as: "h2",
              },
              slots: {},
            },
          ],
          [S.splitRight]: [
            {
              id: "stack-1",
              componentId: C.stack,
              componentVersion: V,
              props: { gap: "md" },
              slots: {
                [S.stackChildren]: [
                  {
                    id: "prose-1",
                    componentId: C.prose,
                    componentVersion: V,
                    props: {
                      size: "md",
                      children:
                        "Stable node ids, typed props, and named slots make each Composition portable.",
                    },
                    slots: {},
                  },
                  {
                    id: "prose-2",
                    componentId: C.prose,
                    componentVersion: V,
                    props: {
                      size: "md",
                      children:
                        "Named slots express where nested components belong without storing JSX as state.",
                    },
                    slots: {},
                  },
                ],
              },
            },
            {
              id: "cta-1",
              componentId: C.ctaButton,
              componentVersion: V,
              props: { href: "/get-started", variant: "solid", arrow: true, children: "Get started" },
              slots: {},
            },
          ],
        },
      },
    ],
  };
}

/**
 * The canonical native sample as a frozen constant. Prefer
 * `createSampleDocument()` when you need a mutable working copy.
 */
export const SAMPLE_DOCUMENT: CompositionDocument = createSampleDocument();
