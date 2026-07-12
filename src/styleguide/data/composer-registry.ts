// Derived Composer registry — the /composer sub-application's catalog seam.
//
// This DERIVES the Composer catalog from the SAME generated `storyModules`
// map the styleguide already builds (see `./sg-registry.ts`). It does NOT add a
// second filesystem scan or `import.meta.glob`: it filters the already-imported
// modules for the ones whose `meta.composer` was explicitly set via
// `defineComposer(...)`. Components that have not opted in are never exposed.
//
// Two projections come out of one definition (locked by epic #243):
//   - the RUNTIME registry (`composerEntries`) keeps the trusted, typed
//     `component` function and non-serializable `adapters` — it drives the
//     preview iframe;
//   - the SERIALIZABLE manifest (`composerManifest`) strips every function so
//     it can cross to the parent window / chooser / inspector as pure JSON.
//
// Display title/category/description are sourced from the owning `StoryMeta`
// (never duplicated in the definition). `Story.render()` is deliberately NOT
// part of the Composer renderer contract — the Composer instantiates the real
// `component`, not a showcase variant.

import type {
  ComposerConstraints,
  ComposerFieldMeta,
  ComposerMeta,
  ComposerSlotMeta,
  ComposerSource,
  JsonValue,
  StoryCategory,
  StoryMeta,
  StoryModule,
} from "@zudo-sg/ui";
import { storyModules } from "./sg-registry";
import { composerManifestEntrySchema } from "./composer-schema";

/**
 * One Composer catalog entry (RUNTIME side). Joins the trusted definition
 * (component fn + adapters retained) with display metadata read from the
 * owning `StoryMeta`.
 */
export interface ComposerEntry {
  /** Stable, opaque component id (persisted document key). */
  componentId: string;
  /** Component schema version. */
  version: number;
  /** Display name, from `StoryMeta.title`. */
  title: string;
  /** Sidebar bucket, from `StoryMeta.category`. */
  category: StoryCategory;
  /** One-sentence description, from `StoryMeta.description`. */
  description: string;
  /** Glob path key of the owning story module. */
  path: string;
  /** Full trusted definition — retains `component` and `adapters`. */
  definition: ComposerMeta;
}

/**
 * The SERIALIZABLE projection of a Composer entry — pure JSON, safe to send to
 * the parent window / chooser / inspector. Contains NO `component` function and
 * NO `adapters`.
 */
export interface ComposerManifestEntry {
  componentId: string;
  version: number;
  title: string;
  category: StoryCategory;
  description: string;
  source: ComposerSource;
  defaults: Record<string, JsonValue>;
  fields: ComposerFieldMeta[];
  slots: ComposerSlotMeta[];
  constraints?: ComposerConstraints;
}

// ── JSON-safety guard ──────────────────────────────────────────────────────

/**
 * Preact marks its VNodes by nulling their `constructor` (see preact's
 * `isValidElement`); a plain object literal keeps `constructor === Object`.
 * We use that marker to reject VNodes even though they are otherwise
 * object-literal shaped.
 */
function isVNodeLike(value: object): boolean {
  return (
    Object.getPrototypeOf(value) === Object.prototype &&
    (value as { constructor?: unknown }).constructor === undefined
  );
}

/**
 * Recursively decides whether a value is JSON-safe: only strings, finite
 * numbers, booleans, null, arrays, and plain objects — never functions,
 * undefined, symbols, bigints, class instances, or Preact VNodes.
 */
export function isJsonSafe(value: unknown, ancestors: Set<unknown> = new Set()): boolean {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "boolean") return true;
  if (t === "number") return Number.isFinite(value as number);
  if (t !== "object") return false; // undefined, function, symbol, bigint
  const obj = value as object;
  if (isVNodeLike(obj)) return false;
  if (ancestors.has(obj)) return false; // circular reference on the current path
  const proto = Object.getPrototypeOf(obj);
  if (!Array.isArray(obj) && proto !== Object.prototype && proto !== null) {
    return false; // Date, Map, class instance…
  }
  // Track ancestors only (backtrack after) so a shared reference in a DAG is
  // not mistaken for a cycle.
  ancestors.add(obj);
  const children = Array.isArray(obj)
    ? obj
    : Object.values(obj as Record<string, unknown>);
  const ok = children.every((v) => isJsonSafe(v, ancestors));
  ancestors.delete(obj);
  return ok;
}

// ── Validation ───────────────────────────────────────────────────────────

/**
 * Validates a set of Composer definitions and returns a list of human-readable
 * error strings (empty = valid). Pure and side-effect-free so tests can feed it
 * fixtures directly. Checks (per the acceptance criteria):
 *   - stable-id sanity (non-empty componentId, integer version ≥ 0);
 *   - duplicate component ids across the set;
 *   - duplicate source imports (same module + export used by two definitions);
 *   - duplicate slot ids within a definition;
 *   - a prop used as both a scalar field and a structural slot (collision);
 *   - a prop used by two fields;
 *   - non-JSON-safe defaults;
 *   - default values invalid for their field's kind/domain;
 *   - inline-edit metadata consistency.
 */
export function validateComposerDefinitions(definitions: readonly ComposerMeta[]): string[] {
  const errors: string[] = [];
  const seenIds = new Map<string, number>();
  const seenImports = new Map<string, string>();

  definitions.forEach((def, index) => {
    const where = def.componentId ? `"${def.componentId}"` : `definition #${index}`;

    if (typeof def.componentId !== "string" || def.componentId.length === 0) {
      errors.push(`${where}: componentId must be a non-empty string`);
    }
    if (!Number.isInteger(def.version) || def.version < 0) {
      errors.push(`${where}: version must be a non-negative integer`);
    }

    // Duplicate component id.
    if (def.componentId) {
      const prev = seenIds.get(def.componentId);
      if (prev !== undefined) {
        errors.push(`${where}: duplicate componentId (also definition #${prev})`);
      } else {
        seenIds.set(def.componentId, index);
      }
    }

    // Duplicate source import: same export from the same module is ambiguous.
    if (def.source) {
      const importKey = `${def.source.exportKind}:${def.source.module}#${def.source.exportName}`;
      const prevOwner = seenImports.get(importKey);
      if (prevOwner !== undefined) {
        errors.push(
          `${where}: duplicate source import (${importKey}) already used by "${prevOwner}"`,
        );
      } else if (def.componentId) {
        seenImports.set(importKey, def.componentId);
      }
    }

    const fields = def.fields ?? [];
    const slots = def.slots ?? [];

    // Duplicate field props.
    const fieldProps = new Set<string>();
    for (const field of fields) {
      if (fieldProps.has(field.prop)) {
        errors.push(`${where}: prop "${field.prop}" is described by more than one field`);
      }
      fieldProps.add(field.prop);
    }

    // Duplicate slot ids + slot/field prop collisions.
    const slotIds = new Set<string>();
    const slotProps = new Set<string>();
    for (const slot of slots) {
      if (slotIds.has(slot.id)) {
        errors.push(`${where}: duplicate slot id "${slot.id}"`);
      }
      slotIds.add(slot.id);
      if (fieldProps.has(slot.prop)) {
        errors.push(
          `${where}: prop "${slot.prop}" is used as both a scalar field and a structural slot`,
        );
      }
      slotProps.add(slot.prop);
    }

    // Defaults: JSON-safe + valid for any field describing the same prop.
    const defaults = def.defaults ?? {};
    for (const [prop, value] of Object.entries(defaults)) {
      if (!isJsonSafe(value)) {
        errors.push(`${where}: default for "${prop}" is not JSON-safe`);
      }
      if (slotProps.has(prop)) {
        errors.push(`${where}: "${prop}" is a structural slot and cannot carry a scalar default`);
      }
    }
    for (const field of fields) {
      if (!(field.prop in defaults)) continue;
      const value = defaults[field.prop];
      const bad = (msg: string) => errors.push(`${where}: default for "${field.prop}" ${msg}`);
      switch (field.kind) {
        case "select":
          if (!field.options.includes(value as string)) {
            bad(`is not one of the select options [${field.options.join(", ")}]`);
          }
          break;
        case "boolean":
          if (typeof value !== "boolean") bad("must be a boolean");
          break;
        case "number":
          if (typeof value !== "number" || !Number.isFinite(value)) {
            bad("must be a finite number");
          } else {
            if (field.min !== undefined && value < field.min) bad(`is below min ${field.min}`);
            if (field.max !== undefined && value > field.max) bad(`is above max ${field.max}`);
          }
          break;
        case "text":
        case "color":
          if (typeof value !== "string") bad("must be a string");
          break;
      }
    }

    // Inline-edit metadata: at most one inline-editable field (MVP), and the
    // inline-editor adapter must target a real inline-edit text field.
    const inlineFields = fields.filter((f) => f.kind === "text" && f.inlineEdit);
    if (inlineFields.length > 1) {
      errors.push(`${where}: at most one inline-editable field is allowed (found ${inlineFields.length})`);
    }
    const adapterField = def.adapters?.inlineEditor?.field;
    if (adapterField !== undefined) {
      const target = fields.find((f) => f.prop === adapterField);
      if (!target || target.kind !== "text" || !target.inlineEdit) {
        errors.push(
          `${where}: inlineEditor adapter targets "${adapterField}", which is not an inline-editable text field`,
        );
      }
    }
  });

  return errors;
}

// ── Projection ─────────────────────────────────────────────────────────────

/**
 * Projects a runtime entry to its serializable manifest form — dropping the
 * trusted `component` and `adapters`. Validated against the strict zod schema
 * so a leaked function (or any stray key) throws rather than silently shipping.
 */
export function toManifestEntry(entry: ComposerEntry): ComposerManifestEntry {
  const { definition } = entry;
  const manifest: ComposerManifestEntry = {
    componentId: entry.componentId,
    version: entry.version,
    title: entry.title,
    category: entry.category,
    description: entry.description,
    source: definition.source,
    defaults: definition.defaults ?? {},
    fields: definition.fields ?? [],
    slots: definition.slots ?? [],
    ...(definition.constraints ? { constraints: definition.constraints } : {}),
  };
  const parsed = composerManifestEntrySchema.safeParse(manifest);
  if (!parsed.success) {
    throw new Error(
      `Composer manifest projection for "${entry.componentId}" is not serializable: ${parsed.error.message}`,
    );
  }
  return manifest;
}

// ── Registry construction ───────────────────────────────────────────────────

/**
 * Builds the runtime Composer registry from a story-module map by filtering for
 * metas that explicitly opted in via `meta.composer`. Throws if any opted-in
 * definition is invalid (so a bad opt-in fails loudly at import time).
 */
export function buildComposerRegistry(modules: Record<string, StoryModule>): ComposerEntry[] {
  const entries: ComposerEntry[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    const meta = mod.default as StoryMeta | undefined;
    if (!meta || typeof meta.title !== "string") continue;
    const composer = meta.composer;
    if (!composer) continue; // only explicitly opted-in metas
    entries.push({
      componentId: composer.componentId,
      version: composer.version,
      title: meta.title,
      category: meta.category,
      description: meta.description,
      path,
      definition: composer,
    });
  }

  const errors = validateComposerDefinitions(entries.map((e) => e.definition));
  if (errors.length > 0) {
    throw new Error(`Invalid Composer definition(s):\n- ${errors.join("\n- ")}`);
  }
  return entries;
}

/**
 * The trusted runtime Composer registry — retains component functions and
 * adapters. Currently empty: no component has opted in yet (opting in the real
 * cohort is a later sub-issue, #246). Derived from the same `storyModules` the
 * styleguide catalog uses, so it never drifts and never triggers a second scan.
 */
export const composerEntries: ComposerEntry[] = buildComposerRegistry(storyModules);

/** The serializable manifest — pure JSON, no functions. */
export const composerManifest: ComposerManifestEntry[] = composerEntries.map(toManifestEntry);

const entryById = new Map<string, ComposerEntry>(composerEntries.map((e) => [e.componentId, e]));
const manifestById = new Map<string, ComposerManifestEntry>(
  composerManifest.map((e) => [e.componentId, e]),
);

/** Look up a trusted runtime entry by its stable component id. */
export function getComposerEntry(componentId: string): ComposerEntry | undefined {
  return entryById.get(componentId);
}

/** Look up a serializable manifest entry by its stable component id. */
export function getComposerManifestEntry(componentId: string): ComposerManifestEntry | undefined {
  return manifestById.get(componentId);
}

/** All opted-in component ids, in generated story order. */
export function getComposerComponentIds(): string[] {
  return composerEntries.map((e) => e.componentId);
}
