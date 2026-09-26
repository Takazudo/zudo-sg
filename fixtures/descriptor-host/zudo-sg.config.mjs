// zudo-sg.config.mjs — descriptor-host fixture (epic #879, S7).
//
// Descriptor mode: stories come from plain-data `StoryDescriptor`s
// (./src/story-descriptors.ts), never a generated StoryModule registry.
// `externalPreview` is required in this mode (descriptors carry no render
// function for the engine to preview in-process) — it points at this
// fixture's own framework-free static frame under public/frame/. No
// `tokens` block: `/tokens` and the in-engine preview route are both
// implicitly off (see docs/adr/styleguide-engine.md and issue #879 E6).

// `@type`, not `@satisfies`: the union member's `registry.mode: "descriptor"`
// literal needs the contextual type `@type` gives the whole object literal —
// `@satisfies` alone leaves a plain object literal's `mode` widened to
// `string`, which fails against the `ZudoSgDescriptorRegistry` branch.
/** @type {import("@takazudo/zudo-sg/config").ZudoSgComposeOptions} */
export default {
  registry: { mode: "descriptor", module: "./src/story-descriptors.ts" },
  externalPreview: { url: "/frame/" },
  previewStyles: "./src/styles/preview-entry.css",
};
