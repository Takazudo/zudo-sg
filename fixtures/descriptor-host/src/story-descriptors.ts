// Plain-data story metadata for the descriptor-host fixture (epic #879, S7).
// No functions, no `.stories.tsx`, no `react` anywhere — see
// @takazudo/zudo-sg/registry's `StoryDescriptor` contract.
//
// Three descriptors across two categories, exercising every catalog
// thumbnail shape: an `image` (a small SVG under public/thumbs/), a
// `placeholder` note, and an entry with no `thumbnail` at all (the engine's
// own "missing" note).

import type { StoryDescriptor } from "@takazudo/zudo-sg/registry";

export const storyDescriptors: StoryDescriptor[] = [
  {
    id: "primary-button",
    slug: "primary-button",
    category: "Buttons",
    title: "Primary Button",
    description: "The foreign host's filled call-to-action button.",
    sourcePath: "components/PrimaryButton",
    order: 1,
    variants: [{ exportName: "Default", name: "Default" }],
    thumbnail: {
      kind: "image",
      src: "/thumbs/primary-button.svg",
      width: 96,
      height: 64,
      alt: "Primary Button preview",
    },
  },
  {
    id: "secondary-button",
    slug: "secondary-button",
    category: "Buttons",
    title: "Secondary Button",
    description: "The foreign host's outline button.",
    sourcePath: "components/SecondaryButton",
    order: 2,
    variants: [{ exportName: "Default", name: "Default" }],
    thumbnail: { kind: "placeholder", note: "Snapshot pending" },
  },
  {
    id: "info-card",
    slug: "info-card",
    category: "Cards",
    title: "Info Card",
    description: "The foreign host's informational card.",
    sourcePath: "components/InfoCard",
    order: 1,
    variants: [{ exportName: "Default", name: "Default" }],
    // No `thumbnail`: the catalog falls back to the engine's missing-note tile.
  },
];

export default storyDescriptors;
