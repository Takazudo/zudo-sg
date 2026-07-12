// Composer serializable-manifest schemas (zod, host-side).
//
// The authoring contract itself is plain TypeScript in @zudo-sg/ui (that
// package has no zod dependency). Runtime validation lives here, in the root
// host (which has zod ^4): these schemas validate the SERIALIZABLE manifest
// projection — the JSON-safe view of a Composer definition that crosses to the
// parent window / chooser / inspector (and, later, the preview iframe bridge).
//
// The manifest entry schema is STRICT: it actively rejects any unexpected key,
// so a leaked `component` function or `adapters` object fails validation. This
// is the runtime backstop for the invariant "a serializable manifest entry
// contains no component function."

import { z } from "zod";
import type { JsonValue } from "@zudo-sg/ui";

/** Recursive JSON-safe value schema (primitives, arrays, plain objects). */
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const composerSourceSchema = z
  .object({
    module: z.string().min(1),
    exportKind: z.enum(["named", "default"]),
    exportName: z.string().min(1),
    localName: z.string().min(1).optional(),
  })
  .strict();

export const composerFieldSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("text"),
      prop: z.string().min(1),
      label: z.string(),
      inlineEdit: z.object({ multiline: z.boolean().optional() }).strict().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("select"),
      prop: z.string().min(1),
      label: z.string(),
      options: z.array(z.string()).min(1),
    })
    .strict(),
  z.object({ kind: z.literal("boolean"), prop: z.string().min(1), label: z.string() }).strict(),
  z
    .object({
      kind: z.literal("number"),
      prop: z.string().min(1),
      label: z.string(),
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().optional(),
    })
    .strict(),
  z.object({ kind: z.literal("color"), prop: z.string().min(1), label: z.string() }).strict(),
]);

export const composerSlotSchema = z
  .object({
    id: z.string().min(1),
    prop: z.string().min(1),
    label: z.string(),
    accepts: z.array(z.string()).optional(),
    cardinality: z.enum(["single", "many"]),
  })
  .strict();

export const composerConstraintsSchema = z
  .object({
    allowedParents: z.array(z.string()).optional(),
    requiredSlots: z.array(z.string()).optional(),
  })
  .strict();

/**
 * The serializable manifest entry — the JSON-safe projection of a definition
 * joined with its owning story's display metadata. `.strict()` rejects any
 * extra key (e.g. a leaked `component`/`adapters`), enforcing serializability.
 */
export const composerManifestEntrySchema = z
  .object({
    componentId: z.string().min(1),
    version: z.number().int().nonnegative(),
    title: z.string().min(1),
    category: z.string().min(1),
    description: z.string(),
    source: composerSourceSchema,
    defaults: z.record(z.string(), jsonValueSchema),
    fields: z.array(composerFieldSchema),
    slots: z.array(composerSlotSchema),
    constraints: composerConstraintsSchema.optional(),
  })
  .strict();

export type ComposerManifestEntrySchema = z.infer<typeof composerManifestEntrySchema>;
