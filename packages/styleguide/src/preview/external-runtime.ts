// Opt-in external runtime contract. Import-safe in Node/SSR: no renderer,
// browser initialization, or fixture code belongs in this module.
import {
  MSG_HEIGHT,
  MSG_READY,
  MSG_REQUEST_READY,
  MSG_SET_THEME,
  MSG_UPDATE_PROPS,
  PROTOCOL_VERSION,
  type PreviewTheme,
} from "./messages.js";

/** Extension revision; the underlying legacy protocol remains v1. */
export const EXTERNAL_RUNTIME_VERSION = 1 as const;
export const MSG_RESET_FIXTURE = "sg:resetFixture" as const;
export const MSG_RUNTIME_ERROR = "sg:runtimeError" as const;
/** The parent must select strict mode before accepting the first message. */
export type ExternalRuntimeMode = "legacy" | "external-v1";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type SerializableProps = Record<string, JsonValue>;

const MAX_JSON_DEPTH = 32;
const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJson(value: unknown, ancestors: Set<object>, depth: number): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || depth > MAX_JSON_DEPTH || ancestors.has(value)) return false;
  if (!Array.isArray(value) && !isRecord(value)) return false;
  if (Object.getOwnPropertySymbols(value).length > 0) return false;
  ancestors.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Array.isArray(value)) {
      // Reject sparse arrays, custom properties and accessors rather than
      // silently changing their meaning during serialization.
      if (Object.keys(descriptors).length !== value.length + 1) return false;
      for (let index = 0; index < value.length; index++) {
        const property = descriptors[String(index)];
        if (!property || !("value" in property) || !isJson(property.value, ancestors, depth + 1)) return false;
      }
      return true;
    }
    return Object.entries(descriptors).every(([key, property]) =>
      !RESERVED_KEYS.has(key) && property.enumerable && "value" in property &&
      isJson(property.value, ancestors, depth + 1),
    );
  } finally {
    ancestors.delete(value);
  }
}

/** JSON data only; no accessors, cycles, prototype keys or lossy values. */
export function isJsonValue(value: unknown): value is JsonValue {
  try {
    return isJson(value, new Set(), 0);
  } catch {
    // Host-side validation may receive a revoked proxy or throwing reflection.
    return false;
  }
}

export function isSerializableProps(value: unknown): value is SerializableProps {
  try {
    return isRecord(value) && isJsonValue(value);
  } catch {
    return false;
  }
}

export interface ExternalFixtureIdentity {
  slug: string;
  variant: string;
}

/** A host challenge changes on load/navigation; a document nonce changes on reload. */
export interface ExternalRuntimeIdentity extends ExternalFixtureIdentity {
  sessionId: string;
  documentId: string;
  /** Starts at zero, advances only for an accepted full fixture reset. */
  generation: number;
}

export interface ExternalRuntimeCapabilities {
  fullReset: boolean;
}

interface ExternalEnvelope extends ExternalFixtureIdentity {
  v: typeof PROTOCOL_VERSION;
  runtimeVersion: typeof EXTERNAL_RUNTIME_VERSION;
  sessionId: string;
}

/** The frame answers this challenge even when its initial ready was missed. */
export interface ExternalRequestReadyMessage extends ExternalEnvelope {
  type: typeof MSG_REQUEST_READY;
}

interface ExternalDocumentMessage extends ExternalEnvelope, ExternalRuntimeIdentity {
  /** Monotonic per sender/session/generation. Receivers ignore repeats and older values. */
  sequence: number;
}

export interface ExternalReadyMessage extends ExternalDocumentMessage {
  type: typeof MSG_READY;
  capabilities: ExternalRuntimeCapabilities;
}
export interface ExternalHeightMessage extends ExternalDocumentMessage {
  type: typeof MSG_HEIGHT;
  height: number;
}
export interface ExternalUpdatePropsMessage extends ExternalDocumentMessage {
  type: typeof MSG_UPDATE_PROPS;
  /** Complete control snapshot, replacing previous overrides; never remounts by itself. */
  props: SerializableProps;
}
export interface ExternalSetThemeMessage extends ExternalDocumentMessage {
  type: typeof MSG_SET_THEME;
  theme: PreviewTheme;
}
export interface ExternalResetFixtureMessage extends ExternalDocumentMessage {
  type: typeof MSG_RESET_FIXTURE;
  /** Exactly generation + 1; the next ready/error must identify this generation. */
  nextGeneration: number;
}

export type ExternalRuntimeErrorCode = "unknown-fixture" | "import" | "render" | "asset";
export interface ExternalRuntimeError {
  code: ExternalRuntimeErrorCode;
  /** Display as text, never HTML. Do not send stacks or nonserializable Error objects. */
  message: string;
  recoverable: boolean;
}
export interface ExternalRuntimeErrorMessage extends ExternalDocumentMessage {
  type: typeof MSG_RUNTIME_ERROR;
  error: ExternalRuntimeError;
}
export type ExternalParentMessage = ExternalRequestReadyMessage | ExternalUpdatePropsMessage |
  ExternalSetThemeMessage | ExternalResetFixtureMessage;
export type ExternalPreviewMessage = ExternalReadyMessage | ExternalHeightMessage | ExternalRuntimeErrorMessage;
export type ExternalRuntimeMessage = ExternalParentMessage | ExternalPreviewMessage;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isCounter(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isExternalRuntimeIdentity(value: unknown): value is ExternalRuntimeIdentity {
  return isSerializableProps(value) && isNonEmptyString(value.slug) && isNonEmptyString(value.variant) &&
    isNonEmptyString(value.sessionId) && isNonEmptyString(value.documentId) && isCounter(value.generation);
}

export function isExternalRuntimeCapabilities(value: unknown): value is ExternalRuntimeCapabilities {
  return isSerializableProps(value) && Object.keys(value).length === 1 && typeof value.fullReset === "boolean";
}

export function isExternalRuntimeError(value: unknown): value is ExternalRuntimeError {
  return isSerializableProps(value) && Object.keys(value).every((key) => ["code", "message", "recoverable"].includes(key)) &&
    ["unknown-fixture", "import", "render", "asset"].includes(value.code as string) &&
    isNonEmptyString(value.message) && typeof value.recoverable === "boolean";
}

/** Check this before legacy guards: malformed extensions must not fall back to legacy mode. */
export function hasExternalRuntimeMarker(value: unknown): boolean {
  return typeof value === "object" && value !== null && Object.hasOwn(value, "runtimeVersion");
}

/** Shape validation only; pair with transport, identity and sequence checks before applying. */
export function isExternalRuntimeMessage(value: unknown): value is ExternalRuntimeMessage {
  if (!isSerializableProps(value) || value.v !== PROTOCOL_VERSION || value.runtimeVersion !== EXTERNAL_RUNTIME_VERSION ||
    !isNonEmptyString(value.slug) || !isNonEmptyString(value.variant) || !isNonEmptyString(value.sessionId)) return false;
  if (value.type === MSG_REQUEST_READY) {
    // A challenge cannot smuggle a conflicting document/generation/sequence.
    return value.documentId === undefined && value.generation === undefined && value.sequence === undefined;
  }
  if (!isExternalRuntimeIdentity(value) || !isCounter(value.sequence)) return false;
  switch (value.type) {
    case MSG_READY: return isExternalRuntimeCapabilities(value.capabilities);
    case MSG_HEIGHT: return typeof value.height === "number" && Number.isFinite(value.height) && value.height >= 0;
    case MSG_UPDATE_PROPS: return isSerializableProps(value.props);
    case MSG_SET_THEME: return value.theme === "light" || value.theme === "dark";
    case MSG_RESET_FIXTURE: return isCounter(value.nextGeneration) && value.nextGeneration === value.generation + 1;
    case MSG_RUNTIME_ERROR: return isExternalRuntimeError(value.error);
    default: return false;
  }
}

export function matchesExternalRuntimeIdentity(actual: ExternalRuntimeIdentity, expected: ExternalRuntimeIdentity): boolean {
  return actual.slug === expected.slug && actual.variant === expected.variant && actual.sessionId === expected.sessionId &&
    actual.documentId === expected.documentId && actual.generation === expected.generation;
}

/** Start lastSequence at -1; advance it only after every other check passes. */
export function isNewExternalRuntimeSequence(sequence: unknown, lastSequence: number): sequence is number {
  return isCounter(sequence) && Number.isSafeInteger(lastSequence) && lastSequence >= -1 && sequence > lastSequence;
}

/** Pure transport check. Null/opaque origins and unknown source windows never qualify. */
export function isExternalRuntimeMessageEvent(
  event: { origin: string; source: unknown; data: unknown },
  expected: { origin: string; source: unknown },
): event is { origin: string; source: unknown; data: ExternalRuntimeMessage } {
  return expected.origin !== "" && expected.origin !== "null" && expected.source != null &&
    event.origin === expected.origin && event.source === expected.source && isExternalRuntimeMessage(event.data);
}

/** Renderer-owned instance. Update retains hooks/editor state; dispose releases all fixture resources. */
export interface ExternalFixtureInstance {
  update(props: SerializableProps): void | Promise<void>;
  dispose(): void | Promise<void>;
  /** Optional fixture-specific stability barrier for captures, beyond the initial committed mount. */
  whenStable?(): Promise<void>;
}

export interface ExternalFixtureMountContext {
  identity: ExternalRuntimeIdentity;
  props: SerializableProps;
  /** Aborted on reset/disposal. A late instance must be disposed instead of installed. */
  signal: AbortSignal;
  reportError(error: ExternalRuntimeError): void;
}

/** Resolve only after the renderer commits; React closures remain in the host's external bundle. */
export type ExternalFixtureMount = (context: ExternalFixtureMountContext) => ExternalFixtureInstance | Promise<ExternalFixtureInstance>;
