// Public surface of the Composer document model + source generator (issue #245).
//
// Downstream waves (controller #247, preview #248, tree/chooser #250, inspector
// / export #249, integration #251, and the round-2 interaction issues) import
// from here. Everything below is pure and JSON-safe except where a type comes
// from the authoring contract in `@zudo-sg/ui`.

// ── Document model ───────────────────────────────────────────────────────────
export type {
  JsonObject,
  CompositionSchemaVersion,
  CompositionNode,
  CompositionDocument,
  InsertionTarget,
  ComponentManifestEntry,
  ComponentManifest,
} from "./model/types";
export {
  COMPOSITION_SCHEMA_VERSION,
  VIRTUAL_ROOT_SLOT_ID,
  createManifest,
} from "./model/types";

export { isJsonSafe, isPlainObject, cloneJson } from "./model/json";

export type { IdFactory } from "./model/id-factory";
export { createSequentialIdFactory, createUuidIdFactory } from "./model/id-factory";

export type { NodeLocation, DocumentIndex } from "./model/index-model";
export {
  orderedSlotIds,
  traverse,
  indexDocument,
  traversalOrder,
  findLocation,
} from "./model/index-model";

// ── Validation + diagnostics ─────────────────────────────────────────────────
export type {
  DiagnosticCode,
  DiagnosticReason,
  NodeDiagnostic,
  DocumentDiagnostics,
  TargetValidation,
} from "./model/validate";
export {
  isStructurallyValidDocument,
  classifyNode,
  diagnoseDocument,
  isNodeOpaque,
  validateInsertionTarget,
} from "./model/validate";

// ── Commands ─────────────────────────────────────────────────────────────────
export type { CommandResult } from "./model/commands";
export {
  addNode,
  updateProps,
  reorderNode,
  removeNode,
  repairSelection,
  cloneSubtreeWithNewIds,
  insertSubtree,
  moveSubtree,
} from "./model/commands";

// ── Recovery ─────────────────────────────────────────────────────────────────
export type { LoadOutcome } from "./model/recovery";
export { loadCompositionDocument, resetToSample } from "./model/recovery";

// ── Native sample ────────────────────────────────────────────────────────────
export { createSampleDocument, SAMPLE_DOCUMENT } from "./sample/sample-document";
export {
  SAMPLE_COMPONENT_IDS,
  SAMPLE_COMPONENT_VERSION,
  SAMPLE_SLOT_IDS,
} from "./sample/sample-ids";

// ── Source generation ────────────────────────────────────────────────────────
export type {
  ImportPlan,
  JsxSourceAdapter,
  JsxSourceAdapterContext,
  GenerateJsxOptions,
  JsxGenerationResult,
} from "./source/generate-jsx";
export { generateJsx } from "./source/generate-jsx";
