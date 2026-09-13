/**
 * @takazudo/zudo-sg — story-authoring contract (canonical copy)
 *
 * The shape every `*.stories.tsx` module satisfies so the engine's registry
 * (`@takazudo/zudo-sg/registry`) can discover and render stories. Exported as
 * `@takazudo/zudo-sg/stories`.
 *
 * DUPLICATED ON PURPOSE (ADR `docs/adr/styleguide-engine.md` decision 3): the
 * component provider keeps a byte-equivalent copy of everything below this
 * header at `packages/demo-ui/src/stories/types.ts`, so `@zudo-sg/demo-ui` stays
 * installable and type-resolvable with no engine installed. Edit both files
 * together; `pnpm check:story-contract-sync` fails on drift.
 */

import type { ComponentChildren } from "preact";

/**
 * `StoryMeta.category` is an OPEN string — any value is valid, so a host
 * extending the catalog can introduce a new category without touching this
 * contract. Group order is data owned by the host (`categoryOrder`), not a
 * type: the engine's `createRegistry` (`@takazudo/zudo-sg/registry`) renders
 * the listed categories first and appends every unlisted one alphabetically.
 */
export type StoryCategory = string;

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
  /**
   * Optional link to a REAL page route (e.g. "/preview/dialog-with-fetch")
   * that demos this component live — a separate mechanism from `render` and
   * from the catalog's own `/components/preview` variant iframe
   * (`PREVIEW_ROUTE_PATH`). Request mocking (MSW or otherwise) is permitted
   * only inside the page this points to, never in `render` or component
   * source. When set, the catalog shows it as a "Live demo" link. See
   * STORIES.md §6 → "The `previewRoute` escape hatch".
   */
  previewRoute?: string;
}

/**
 * One renderable variant. `render` returns the preview node; `name` labels it.
 *
 * Generic over the driving component's props `P` so a variant's `controls`
 * (see `StoryControl<P>` below) are checked against real prop names — and,
 * where the prop's own type is informative (e.g. a string-literal union),
 * against real prop values too. `P` defaults to `Record<string, unknown>`, so
 * the bare `Story` name is a compatible alias for variants that have no
 * controls to check (or whose `render` composes more than one component's
 * props) — migrating a file to `Story<SomeProps>` is opt-in, one file at a
 * time.
 *
 * `controls` is an OPTIONAL, declarative description of the knobs the catalog
 * exposes for live editing. The catalog seeds each control's `defaultValue`
 * into the render args and pushes live edits over the `sg:updateProps` channel,
 * so `render(args)` re-renders with the tweaked props. A control-bearing
 * variant should render a SINGLE arg-driven instance (not a multi-variant
 * showcase) so the knobs visibly drive the preview.
 *
 * `source` is the OPTIONAL exact JSX string for this variant. When present the
 * catalog shows it verbatim (the contract's "explicit source" path). When
 * absent the catalog falls back to its own extraction (see STORIES.md →
 * "Source extraction"). Co-locating `source` is recommended for variants whose
 * `render` body is non-obvious.
 */
export interface Story<P = Record<string, unknown>> {
  /** Variant label, e.g. "Primary". */
  name: string;
  /**
   * Returns the preview node. Must be pure + synchronous.
   *
   * Receives the merged render args — control defaults overlaid with any live
   * overrides from the controls panel — typed as a partial `P` so `args.foo`
   * reads as `foo`'s real prop type with no `as` cast. The parameter is
   * optional/defaulted so non-control variants (which ignore `args`) still
   * render with no arguments.
   */
  render: (args?: Partial<P>) => ComponentChildren;
  /** Optional live-control descriptors that drive `render(args)`. */
  controls?: StoryControl<P>[];
  /** Optional verbatim JSX source string for the code panel. */
  source?: string;
}

/** Narrows to `T` when it's a string, else falls back to plain `string` (e.g. under the untyped `Record<string, unknown>` default). */
type StringPropValue<T> = T extends string ? T : string;
/** Same fallback shape as `StringPropValue`, for boolean-valued props. */
type BooleanPropValue<T> = T extends boolean ? T : boolean;
/** Same fallback shape as `StringPropValue`, for number-valued props. */
type NumberPropValue<T> = T extends number ? T : number;

/**
 * A single live-control descriptor, discriminated by `type` and keyed to a
 * real prop of `P` (`prop: keyof P & string` — renaming that prop breaks every
 * control naming it). `defaultValue` (and `options`, for `select`) narrow to
 * that prop's own value type where `P` is informative — e.g. a `select` on a
 * prop typed as a string-literal union restricts `options`/`defaultValue` to
 * that union — so a value only a former version of the prop accepted also
 * fails to typecheck.
 */
export type StoryControl<P = Record<string, unknown>> = {
  [K in keyof P & string]:
    | {
        type: "select";
        /** Prop name this control drives, e.g. "variant". */
        prop: K;
        label: string;
        options: StringPropValue<NonNullable<P[K]>>[];
        defaultValue: StringPropValue<NonNullable<P[K]>>;
      }
    | {
        type: "boolean";
        prop: K;
        label: string;
        defaultValue: BooleanPropValue<NonNullable<P[K]>>;
      }
    | {
        type: "text";
        prop: K;
        label: string;
        defaultValue: StringPropValue<NonNullable<P[K]>>;
      }
    | {
        type: "number";
        prop: K;
        label: string;
        defaultValue: NumberPropValue<NonNullable<P[K]>>;
        min?: number;
        max?: number;
        step?: number;
        /**
         * Editor widget. `range` (default) renders a slider with a numeric
         * readout when min/max are present; `input` renders a plain numeric box.
         */
        ui?: "range" | "input";
      }
    | {
        type: "color";
        prop: K;
        label: string;
        /** CSS color string, e.g. "#2563eb". */
        defaultValue: StringPropValue<NonNullable<P[K]>>;
      };
}[keyof P & string];

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
 * Authoring helper — identity function that pins a value to `Story<P>` so
 * editors autocomplete `name`/`render`/`controls`/`source` (and check
 * `controls` against `P`). Using it is optional; a plain object literal that
 * satisfies `Story<P>` is equally valid.
 */
export function defineStory<P = Record<string, unknown>>(story: Story<P>): Story<P> {
  return story;
}
