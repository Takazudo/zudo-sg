// The Composer preview postMessage protocol — the ONLY thing that crosses the
// `/composer` ⇄ `/composer/preview` trust boundary.
//
// ── Trust model (locked by epic #243) ────────────────────────────────────────
// The preview runs in an isolated same-origin iframe. Only JSON DATA crosses
// the bridge: never a component function, never a VNode, never source text.
// The iframe imports the TRUSTED Composer registry itself (#244) and maps the
// received document's stable slot ids onto real Preact props locally. Nothing
// received from a message is ever parsed as code or evaluated.
//
// Every inbound message passes THREE gates, in this order (see `guard` below):
//   1. `event.source` is the exact expected window (the iframe's contentWindow
//      on the parent side; `window.parent` on the iframe side);
//   2. `event.origin === location.origin` — the preview is same-origin, so any
//      other origin is a foreign frame and is dropped;
//   3. the payload validates against a STRICT zod schema (unknown `type`,
//      wrong shape, or ANY extra key is rejected).
// Outbound messages always use an EXACT target origin, never `"*"`.
//
// ── Versioning + additive growth ─────────────────────────────────────────────
// Every envelope carries `channel` + `v`. `channel` keeps the protocol from
// colliding with the styleguide's `sg:*` messages or zudo-doc's theme bridge
// (both of which share this `window`); `v` lets a future breaking change be
// rejected rather than misread.
//
// Waves 7-9 (#256 request-node-menu / request-insert-menu, #257 inline-edit
// commit, #258 move/copy) ADD message types to this module. To add one:
//   1. declare its `.strict()` schema next to its peers below;
//   2. append it to `PARENT_TO_PREVIEW_MEMBERS` / `PREVIEW_TO_PARENT_MEMBERS`;
//   3. add a handler to the corresponding options interface.
// Nothing else changes — the guards, the union types, and the exhaustive
// switches all derive from those two member tuples.

import { z } from "zod";
import type { CompositionDocument, CompositionNode, InsertionTarget } from "@/composer";
import { COMPOSITION_SCHEMA_VERSION } from "@/composer";
import { jsonValueSchema } from "@/styleguide/data/composer-schema";

/** Envelope discriminator — keeps Composer traffic off other message buses. */
export const COMPOSER_PREVIEW_CHANNEL = "composer-preview" as const;

/** Protocol version. Bump only on a BREAKING envelope change. */
export const COMPOSER_PREVIEW_PROTOCOL_VERSION = 1 as const;

// ── Session ─────────────────────────────────────────────────────────────────

/** Edit shows authoring affordances; Preview renders the bare components. */
export type PreviewMode = "edit" | "preview";
export type PreviewTheme = "light" | "dark";

/**
 * The slice of `/composer` SESSION state the preview needs. Deliberately not
 * document state: it is never persisted into the `CompositionDocument`.
 */
export interface PreviewSession {
  mode: PreviewMode;
  theme: PreviewTheme;
  /** Currently selected node id, mirrored from the tree/canvas. */
  selectedId: string | null;
}

export const previewSessionSchema = z
  .object({
    mode: z.enum(["edit", "preview"]),
    theme: z.enum(["light", "dark"]),
    selectedId: z.string().min(1).nullable(),
  })
  .strict();

// ── Composition document (wire schema) ──────────────────────────────────────

/**
 * Wire-level zod schema for #245's `CompositionNode`. `.strict()` so a payload
 * carrying an extra key (a smuggled `component`, a stray `__proto__`-ish field,
 * a future-schema property) is REJECTED rather than silently forwarded into the
 * renderer. The type annotation pins it to the model's own type, so the schema
 * cannot drift from `@/composer` without a compile error.
 */
export const compositionNodeSchema: z.ZodType<CompositionNode> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      componentId: z.string().min(1),
      componentVersion: z.number().int().nonnegative(),
      props: z.record(z.string(), jsonValueSchema),
      slots: z.record(z.string(), z.array(compositionNodeSchema)),
    })
    .strict(),
);

/** Wire-level zod schema for #245's `CompositionDocument`. */
export const compositionDocumentSchema: z.ZodType<CompositionDocument> = z
  .object({
    schemaVersion: z.literal(COMPOSITION_SCHEMA_VERSION),
    id: z.string().min(1),
    name: z.string(),
    root: z.array(compositionNodeSchema),
  })
  .strict();

/**
 * Wire-level schema for #245's shared `InsertionTarget`. The preview emits this
 * verbatim on `request-add` — an insert-at-INDEX target, never an append-only
 * slot reference (the round-2 contract).
 */
export const insertionTargetSchema: z.ZodType<InsertionTarget> = z
  .object({
    parentId: z.string().min(1).nullable(),
    slotId: z.string().min(1),
    index: z.number().int().nonnegative(),
  })
  .strict();

// ── Envelope ────────────────────────────────────────────────────────────────

const envelope = {
  channel: z.literal(COMPOSER_PREVIEW_CHANNEL),
  v: z.literal(COMPOSER_PREVIEW_PROTOCOL_VERSION),
} as const;

/** A monotonically increasing snapshot revision. Stale ones are ignored. */
const revisionSchema = z.number().int().nonnegative();

// ── parent → preview ────────────────────────────────────────────────────────

/** Full snapshot: the whole document plus the session it must be drawn under. */
export const renderMessageSchema = z
  .object({
    ...envelope,
    type: z.literal("render"),
    revision: revisionSchema,
    document: compositionDocumentSchema,
    session: previewSessionSchema,
  })
  .strict();

/**
 * Session-only update (Edit/Preview toggle, theme change, selection move). Sent
 * instead of a full `render` when the document has not changed — but it is
 * revision-stamped exactly like a `render`, so the two share one ordering.
 */
export const modeMessageSchema = z
  .object({
    ...envelope,
    type: z.literal("mode"),
    revision: revisionSchema,
    session: previewSessionSchema,
  })
  .strict();

/** Append future parent → preview messages here (see the module header). */
export const PARENT_TO_PREVIEW_MEMBERS = [renderMessageSchema, modeMessageSchema] as const;

export const parentToPreviewSchema = z.discriminatedUnion("type", [...PARENT_TO_PREVIEW_MEMBERS]);

export type RenderMessage = z.infer<typeof renderMessageSchema>;
export type ModeMessage = z.infer<typeof modeMessageSchema>;
export type ParentToPreviewMessage = z.infer<typeof parentToPreviewSchema>;

// ── preview → parent ────────────────────────────────────────────────────────

/**
 * The iframe finished booting and is listening. Emitted on EVERY load — a late
 * load or a reload re-emits it, and the parent answers by replaying only its
 * newest snapshot (see `bridge.ts`).
 */
export const readyMessageSchema = z.object({ ...envelope, type: z.literal("ready") }).strict();

/** A node (or empty canvas) was clicked in Edit mode. */
export const selectMessageSchema = z
  .object({
    ...envelope,
    type: z.literal("select"),
    /** Revision the preview was showing when the user acted. */
    revision: revisionSchema,
    nodeId: z.string().min(1).nullable(),
  })
  .strict();

/** An insert point was activated. Carries #245's insert-at-index target. */
export const requestAddMessageSchema = z
  .object({
    ...envelope,
    type: z.literal("request-add"),
    revision: revisionSchema,
    target: insertionTargetSchema,
  })
  .strict();

/** A render/protocol failure the preview recovered from, surfaced to the host. */
export const errorMessageSchema = z
  .object({
    ...envelope,
    type: z.literal("error"),
    /** Revision in effect when it failed; `null` before the first snapshot. */
    revision: revisionSchema.nullable(),
    message: z.string().min(1),
    /** False only if the preview cannot continue without a reload. */
    recoverable: z.boolean(),
  })
  .strict();

/** Append future preview → parent messages here (see the module header). */
export const PREVIEW_TO_PARENT_MEMBERS = [
  readyMessageSchema,
  selectMessageSchema,
  requestAddMessageSchema,
  errorMessageSchema,
] as const;

export const previewToParentSchema = z.discriminatedUnion("type", [...PREVIEW_TO_PARENT_MEMBERS]);

export type ReadyMessage = z.infer<typeof readyMessageSchema>;
export type SelectMessage = z.infer<typeof selectMessageSchema>;
export type RequestAddMessage = z.infer<typeof requestAddMessageSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;
export type PreviewToParentMessage = z.infer<typeof previewToParentSchema>;

// ── Structural window/message types ─────────────────────────────────────────
//
// Structural (not `Window`/`MessageEvent`) so both sides can be unit-tested
// against plain fakes, and so a caller cannot accidentally hand the bridge a
// window it does not actually intend to talk to.

/** The three fields of a `MessageEvent` this protocol is allowed to look at. */
export interface MessageEventLike {
  readonly data: unknown;
  readonly origin: string;
  readonly source: unknown;
}

/** Anything that can receive an exact-origin `postMessage`. */
export interface MessagePoster {
  postMessage(message: unknown, targetOrigin: string): void;
}

/** Anything that can host the `message` listener. */
export interface MessageTarget {
  addEventListener(type: "message", listener: (event: MessageEventLike) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEventLike) => void): void;
}

// ── The guard ───────────────────────────────────────────────────────────────

export type GuardFailure = "wrong-source" | "wrong-origin" | "invalid-payload";

export type GuardResult<T> =
  | { ok: true; message: T }
  | { ok: false; reason: GuardFailure; detail?: string };

/**
 * The single security gate. `event.data` is NEVER read, parsed, or coerced
 * before the source/origin checks pass and zod has validated it — it is handed
 * to `safeParse` as an opaque `unknown` and nothing else.
 */
function guard<T>(
  schema: z.ZodType<T>,
  event: MessageEventLike,
  expected: { source: unknown; origin: string },
): GuardResult<T> {
  // A null/undefined expected source would make `===` match a message whose
  // `source` is also null (e.g. one posted from a detached context), so an
  // unresolved expectation is treated as "trust nothing".
  if (expected.source == null || event.source !== expected.source) {
    return { ok: false, reason: "wrong-source" };
  }
  if (event.origin !== expected.origin) {
    return { ok: false, reason: "wrong-origin" };
  }
  const parsed = schema.safeParse(event.data);
  if (!parsed.success) {
    return { ok: false, reason: "invalid-payload", detail: parsed.error.message };
  }
  return { ok: true, message: parsed.data };
}

/** Validate a message arriving AT the preview iframe FROM the parent. */
export function readParentToPreview(
  event: MessageEventLike,
  expected: { source: unknown; origin: string },
): GuardResult<ParentToPreviewMessage> {
  return guard(parentToPreviewSchema, event, expected);
}

/** Validate a message arriving AT the parent FROM the preview iframe. */
export function readPreviewToParent(
  event: MessageEventLike,
  expected: { source: unknown; origin: string },
): GuardResult<PreviewToParentMessage> {
  return guard(previewToParentSchema, event, expected);
}

// ── Constructors ────────────────────────────────────────────────────────────
//
// Every outbound message is built here, so the envelope can never be forgotten.

export function renderMessage(
  revision: number,
  document: CompositionDocument,
  session: PreviewSession,
): RenderMessage {
  return { ...envelopeValue(), type: "render", revision, document, session };
}

export function modeMessage(revision: number, session: PreviewSession): ModeMessage {
  return { ...envelopeValue(), type: "mode", revision, session };
}

export function readyMessage(): ReadyMessage {
  return { ...envelopeValue(), type: "ready" };
}

export function selectMessage(revision: number, nodeId: string | null): SelectMessage {
  return { ...envelopeValue(), type: "select", revision, nodeId };
}

export function requestAddMessage(revision: number, target: InsertionTarget): RequestAddMessage {
  return { ...envelopeValue(), type: "request-add", revision, target };
}

export function errorMessage(
  revision: number | null,
  message: string,
  recoverable = true,
): ErrorMessage {
  return { ...envelopeValue(), type: "error", revision, message, recoverable };
}

function envelopeValue(): { channel: typeof COMPOSER_PREVIEW_CHANNEL; v: typeof COMPOSER_PREVIEW_PROTOCOL_VERSION } {
  return { channel: COMPOSER_PREVIEW_CHANNEL, v: COMPOSER_PREVIEW_PROTOCOL_VERSION };
}
