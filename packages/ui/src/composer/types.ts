/**
 * @zudo-sg/ui — Composer authoring contract (shared types)
 *
 * These types define the type-checked metadata an author co-locates with a
 * component's story so the `/composer` sub-application (epic #243) can
 * instantiate the real component, describe its editable scalar props, and
 * describe its named structural slots.
 *
 * This is a SEPARATE concern from the story-authoring contract in
 * `../stories/types.ts`. A `StoryMeta` carries display metadata and each
 * `Story.render()` renders a fixed showcase variant — neither is enough to
 * build an arbitrary composition tree. The Composer opt-in is a single
 * OPTIONAL `composer` property on `StoryMeta` (see `../stories/types.ts`);
 * there is deliberately no second story-module export, because the story
 * contract test (`../stories/__tests__/contract.test.ts`) treats every
 * non-default export as a `Story`.
 *
 * ── Authoring vs. runtime split (locked by epic #243) ─────────────────────
 * - These are PLAIN TypeScript types. packages/ui has no `zod` dependency;
 *   runtime/zod validation of definitions and the serializable manifest lives
 *   host-side (see `src/styleguide/data/composer-registry.ts`).
 * - A definition holds two kinds of data: JSON-safe metadata (ids, defaults,
 *   field/slot descriptors) that projects into a serializable manifest for the
 *   parent window / chooser / inspector, and TRUSTED, NON-SERIALIZABLE members
 *   (`component`, `adapters`) retained only in the runtime registry that drives
 *   the preview iframe. Functions and VNodes never cross into the manifest.
 *
 * ── Stability invariants (locked by epic #243) ───────────────────────────
 * - `componentId` and slot `id`s are PERSISTED document keys. They must NOT be
 *   derived from title, slug, category, or file path, and must stay stable even
 *   if the component's display name or prop names change.
 * - Structural slots are opt-in only. A `children` prop can mean container
 *   content OR a scalar label; it is never inferred as a slot from
 *   `ComponentChildren`.
 * - One prop cannot be both a scalar field and a structural slot (enforced by
 *   the host validator).
 */

import type { ComponentChildren, ComponentType } from "preact";

/** A single JSON primitive: the leaves of any JSON-safe value. */
export type JsonPrimitive = string | number | boolean | null;

/**
 * The closed set of JSON-safe values. Composer defaults and persisted field
 * values are constrained to this so a Composition document round-trips through
 * `JSON.stringify`/`parse` with no data loss and no functions/VNodes leaking
 * into the serializable manifest.
 */
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/**
 * Where a component is imported from, for deterministic JSX/source generation
 * (wave 2+). Kept as data (not a live binding) so it survives into the
 * serializable manifest.
 */
export interface ComposerSource {
  /**
   * Import specifier, e.g. `@zudo-sg/ui/src/shared/cta-button/cta-button`.
   * Source-of-truth for the generated `import` statement; not derived from
   * `componentId` (ids are opaque and stable across module moves).
   */
  module: string;
  /** Whether the component is the module's default or a named export. */
  exportKind: "named" | "default";
  /**
   * The export's name in its module (e.g. `CtaButton`). For a default export
   * this is the canonical name to import it AS.
   */
  exportName: string;
  /**
   * Optional preferred local identifier for generated code when the raw
   * `exportName` would collide or read poorly. Defaults to `exportName`.
   */
  localName?: string;
}

/** Narrows to `T` when it's a string, else falls back to plain `string`. */
type StringPropValue<T> = T extends string ? T : string;

/**
 * A typed, editable scalar-prop descriptor, discriminated by `kind` and keyed
 * to a REAL prop of `P` (`prop: keyof P & string`). `select.options` narrow to
 * the prop's own value type where `P` is informative (e.g. a string-literal
 * union), so a value only a former version of the prop accepted fails to
 * typecheck. Fields describe the editing UI + valid domain ONLY; the initial
 * value comes from the definition's `defaults` map (cross-checked by the host
 * validator), keeping a single source of truth for values.
 *
 * Fields carry no functions, so the whole descriptor is serializable.
 */
export type ComposerField<P = Record<string, unknown>> = {
  [K in keyof P & string]:
    | {
        kind: "text";
        /** Real prop name this field drives, e.g. "heading". */
        prop: K;
        label: string;
        /**
         * Marks this text field editable directly on the canvas (wave-8 /
         * #257). At most one inline-editable field per component (MVP). A
         * flag alone can't target the right text node when the component
         * renders decorations, so a definition also supplies a trusted
         * `adapters.inlineEditor` to resolve the editable element.
         */
        inlineEdit?: { multiline?: boolean };
      }
    | {
        kind: "select";
        prop: K;
        label: string;
        options: StringPropValue<NonNullable<P[K]>>[];
      }
    | {
        kind: "boolean";
        prop: K;
        label: string;
      }
    | {
        kind: "number";
        prop: K;
        label: string;
        min?: number;
        max?: number;
        step?: number;
      }
    | {
        kind: "color";
        prop: K;
        label: string;
      };
}[keyof P & string];

/** How many children a structural slot holds. */
export type ComposerSlotCardinality = "single" | "many";

/**
 * A named structural slot: a mapping from a STABLE persisted `id` to a real
 * prop of `P` that receives child components. `id` is the document key and must
 * stay stable even if `prop` is renamed — never derive it from `prop`, `label`,
 * or the component's title.
 */
export interface ComposerSlot<P = Record<string, unknown>> {
  /** Stable persisted key, e.g. "right". NEVER derived from prop/label/title. */
  id: string;
  /** Real prop this slot's children render into, e.g. "right" or "children". */
  prop: keyof P & string;
  label: string;
  /**
   * Whitelist of child `componentId`s this slot accepts. Omitted/undefined
   * means any opted-in component is allowed.
   */
  accepts?: string[];
  cardinality: ComposerSlotCardinality;
}

/**
 * Optional, JSON-safe structural constraints. Deliberately minimal — richer
 * constraint kinds are added when a real need appears (mirrors the deferred
 * migrations/aliases decision).
 */
export interface ComposerConstraints {
  /** Component IDs permitted to contain this component (parent whitelist). */
  allowedParents?: string[];
  /** Slot IDs that must contain at least one child to be valid. */
  requiredSlots?: string[];
}

/**
 * A TRUSTED, non-serializable adapter that resolves the editable DOM element
 * for an inline-editable text field inside a rendered component. Real
 * components render decorations (CtaButton's trailing arrow, SectionHeading's
 * eyebrow/heading/intro regions), so the `inlineEdit` prop flag alone cannot
 * target the correct text node — the adapter closes that gap. Runtime-registry
 * side only; never enters the serializable manifest.
 */
export interface ComposerInlineEditorAdapter {
  /** The `text` field prop this editor targets; must carry `inlineEdit`. */
  field: string;
  /** Resolve the editable element within the component's rendered root. */
  resolveElement: (root: HTMLElement) => HTMLElement | null;
}

/**
 * TRUSTED, non-serializable adapters. Retained only in the runtime registry
 * that drives the preview iframe; stripped from the serializable manifest.
 */
export interface ComposerAdapters<P = Record<string, unknown>> {
  /**
   * Custom preview render. Defaults to `h(component, props)` when omitted; an
   * adapter is only needed when a component requires wrapping/prop massaging in
   * the canvas.
   */
  render?: (props: Partial<P>) => ComponentChildren;
  /**
   * Custom JSX source string generation. Defaults to the structural generator
   * (wave 2+) when omitted.
   */
  source?: (props: Partial<P>) => string;
  /** Inline text-editing adapter (wave-8 / #257). */
  inlineEditor?: ComposerInlineEditorAdapter;
}

/**
 * JSON-safe defaults, keyed to real props of `P` with each value narrowed to
 * the JSON-safe subset of that prop's type (`Extract<P[K], JsonValue>`).
 * Providing a default for a non-JSON-only prop, or under a key that is not a
 * real prop, fails to typecheck — this is the type-level "prop-key checking for
 * defaults" the acceptance criteria require.
 */
export type ComposerDefaults<P> = {
  [K in keyof P & string]?: Extract<P[K], JsonValue>;
};

/**
 * The full, generic Composer definition an author passes to `defineComposer`.
 * Generic over the component's props `P` so `defaults`, `fields`, and slot
 * `prop`s are checked against real prop names (and, where informative, values).
 */
export interface ComposerDefinition<P = Record<string, unknown>> {
  /**
   * Stable, opaque, author-assigned component identity. A persisted document
   * key — must NOT be derived from title, slug, category, or file path, and
   * must stay stable across renames/moves.
   */
  componentId: string;
  /** Component schema version; bumped only on a real breaking schema change. */
  version: number;
  /** The actual typed Preact component. Trusted; runtime-registry side only. */
  component: ComponentType<P>;
  /** Import metadata for deterministic source generation. */
  source: ComposerSource;
  /** JSON-safe initial prop values. */
  defaults?: ComposerDefaults<P>;
  /** Typed editable scalar-prop descriptors. */
  fields?: ComposerField<P>[];
  /** Named structural slots (explicit opt-in; never inferred). */
  slots?: ComposerSlot<P>[];
  /** Optional structural constraints. */
  constraints?: ComposerConstraints;
  /** Trusted, non-serializable render/source/inline-editor adapters. */
  adapters?: ComposerAdapters<P>;
}

/** Non-generic (prop-erased) field descriptor, as stored in metadata. */
export type ComposerFieldMeta = ComposerField;
/** Non-generic (prop-erased) slot descriptor, as stored in metadata. */
export type ComposerSlotMeta = ComposerSlot;
/** Non-generic (prop-erased) adapters, as stored in metadata. */
export type ComposerAdaptersMeta = ComposerAdapters;

/**
 * The prop-erased metadata `defineComposer` yields and `StoryMeta.composer`
 * holds. `StoryMeta` is non-generic, so the generic `P` cannot survive on the
 * stored value; `defineComposer<P>` does the authoring-site checking and erases
 * to this shape. Display title/category/description are NOT duplicated here —
 * they stay sourced from the owning `StoryMeta`.
 */
export interface ComposerMeta {
  componentId: string;
  version: number;
  /** Trusted component function (runtime registry retains it). */
  component: ComponentType<Record<string, unknown>>;
  source: ComposerSource;
  defaults: Record<string, JsonValue>;
  fields: ComposerFieldMeta[];
  slots: ComposerSlotMeta[];
  constraints?: ComposerConstraints;
  adapters?: ComposerAdaptersMeta;
}

/**
 * Authoring helper — identity function that pins a value to
 * `ComposerDefinition<P>` so the authoring site is fully typechecked against
 * the component's real props, then ERASES to the non-generic `ComposerMeta`
 * that `StoryMeta.composer` accepts. Mirrors `defineStory<P>`.
 *
 * A separate named `composer` story-module export is NOT viable: the story
 * contract test asserts every non-default export is a well-formed `Story`.
 */
export function defineComposer<P = Record<string, unknown>>(
  spec: ComposerDefinition<P>,
): ComposerMeta {
  // Erase the generic prop type. The value is structurally the metadata shape;
  // the cast only drops `P`, which cannot survive on the non-generic StoryMeta.
  return spec as unknown as ComposerMeta;
}
