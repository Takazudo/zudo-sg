/**
 * @zudo-sg/ui — story-authoring contract (shared types)
 *
 * These types define the shape every `*.stories.tsx` module must satisfy so the
 * S6 styleguide catalog can discover and render stories via a single eager
 * `import.meta.glob('./packages/ui/**\/*.stories.tsx', { eager: true })`.
 *
 * The full prose contract — glob root, file location, source-extraction rules,
 * browser/MSW rules — lives in packages/ui/STORIES.md. Keep this file and that
 * doc in sync; STORIES.md is the source of truth a reviewer reads, this file is
 * what TypeScript checks story modules against.
 *
 * A story module exports exactly:
 *   - a default-exported `meta: StoryMeta`
 *   - one or more named `Story` objects (the variants to render)
 * Nothing else should be exported. The registry keys stories by the module's
 * glob path and reads `meta` + every named export that is a `Story`.
 */

import type { ComponentChildren } from "preact";

/** Top-level grouping in the catalog sidebar. Keep the set small + stable. */
export type StoryCategory =
  | "Actions"
  | "Typography"
  | "Layout"
  | "Data Display"
  | "Forms"
  | "Navigation";

/**
 * Per-file metadata. Default-exported from each `*.stories.tsx`.
 * `title` is the component's display name; `category` buckets it in the nav.
 */
export interface StoryMeta {
  /** Display name, e.g. "Button". Unique within a category. */
  title: string;
  /** Sidebar bucket. */
  category: StoryCategory;
  /** One-sentence description shown under the title. */
  description: string;
  /**
   * Short usage snippet (import + minimal JSX) shown in the catalog's "Usage"
   * block. Authored as a plain string so the catalog can render it verbatim in
   * a code block without parsing the component source.
   */
  usage: string;
  /**
   * Optional ordering hint within a category (lower = earlier). Defaults to
   * alphabetical by `title` when omitted.
   */
  order?: number;
}

/**
 * One renderable variant. `render` returns the preview node; `name` labels it.
 *
 * `controls` is an OPTIONAL, declarative description of the knobs the catalog
 * may expose for live editing. It is metadata only — the catalog decides
 * whether/how to render controls. A story renders fine with no controls.
 *
 * `source` is the OPTIONAL exact JSX string for this variant. When present the
 * catalog shows it verbatim (the contract's "explicit source" path). When
 * absent the catalog falls back to its own extraction (see STORIES.md →
 * "Source extraction"). Co-locating `source` is recommended for variants whose
 * `render` body is non-obvious.
 */
export interface Story {
  /** Variant label, e.g. "Primary". */
  name: string;
  /** Returns the preview node. Must be pure + synchronous. */
  render: () => ComponentChildren;
  /** Optional live-control descriptors (metadata only). */
  controls?: StoryControl[];
  /** Optional verbatim JSX source string for the code panel. */
  source?: string;
}

/** A single live-control descriptor. Discriminated by `type`. */
export type StoryControl =
  | {
      type: "select";
      /** Prop name this control drives, e.g. "variant". */
      prop: string;
      label: string;
      options: string[];
      defaultValue: string;
    }
  | {
      type: "boolean";
      prop: string;
      label: string;
      defaultValue: boolean;
    }
  | {
      type: "text";
      prop: string;
      label: string;
      defaultValue: string;
    };

/**
 * The shape `import.meta.glob` yields per module: a default `meta` plus an
 * index signature of named `Story` exports. The registry iterates own
 * enumerable keys, skips `default`, and treats the rest as stories.
 */
export interface StoryModule {
  default: StoryMeta;
  [exportName: string]: StoryMeta | Story;
}

/**
 * Authoring helper — identity function that pins a value to `Story` so editors
 * autocomplete `name`/`render`/`controls`/`source`. Using it is optional; a
 * plain object literal that satisfies `Story` is equally valid.
 */
export function defineStory(story: Story): Story {
  return story;
}
