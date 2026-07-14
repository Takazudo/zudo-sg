// Public surface of the Composer document model + source generator (issue #245).
//
// Downstream waves (controller #247, preview #248, tree/chooser #250, inspector
// / export #249, integration #251, and the round-2 interaction issues) import
// from here. Everything below is pure and JSON-safe except where a type comes
// from the authoring contract in `@zudo-sg/ui`.

// ── Document model ───────────────────────────────────────────────────────────
export type {
  JsonObject,
  CompositionSchemaV1,
  CompositionSchemaVersion,
  CompositionNode,
  GlobalTemplateOutletTarget,
  GlobalTemplateOutlet,
  GlobalTemplatePublication,
  PatternPublication,
  CompositionPublication,
  CompositionBinding,
  CompositionDocumentV1,
  CompositionDocument,
  InsertionTarget,
  ComponentManifestEntry,
  ComponentManifest,
} from "./model/types";
export {
  COMPOSITION_SCHEMA_V1,
  COMPOSITION_SCHEMA_VERSION,
  VIRTUAL_ROOT_SLOT_ID,
  createManifest,
} from "./model/types";

export type { CompositionRecordId } from "./model/record-identity";

export type { CompositionDocumentDecodeOutcome } from "./model/codec";
export {
  decodeCompositionDocumentV1,
  decodeCompositionDocument,
} from "./model/codec";

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
  ReuseDiagnosticCode,
  ReuseDiagnosticReason,
  DiagnoseDocumentOptions,
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

// ── Composition library records + provider boundary ─────────────────────────
export * from "./library";

// Revision-aware persistence coordination (framework and provider independent).
export * from "./persistence";

// ── Browser persistence ─────────────────────────────────────────────────────
export * from "./storage/indexeddb";

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

// Dev-only browser file-provider capability. The factory returns undefined in
// production because its virtual configuration is build-gated by zfb.
export * from "./storage/file-provider";
