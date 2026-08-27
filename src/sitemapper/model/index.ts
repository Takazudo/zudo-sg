// Public Sitemapper model contract — the sole import surface for downstream waves.
//
// Keeping schema, validation, codec, recovery, and ephemeral indexing behind one
// barrel prevents storage, commands, catalog, and UI from forming reverse domain
// dependencies or importing Composer-owned model types.

export type {
  CompositionRef,
  SitemapDocument,
  SitemapNode,
  SitemapSchemaVersion,
} from "./types";
export { SITEMAP_SCHEMA_VERSION } from "./types";

export type { SitemapDocumentIndex, SitemapNodeLocation } from "./index-model";
export type {
  SitemapDocumentIndex as DocumentIndex,
  SitemapNodeLocation as NodeLocation,
} from "./index-model";
export { findLocation, indexDocument, traversalOrder, traverse } from "./index-model";

export type {
  SitemapValidationFailureCode,
  SitemapValidationResult,
} from "./validate";
export type {
  SitemapValidationFailureCode as ValidationFailureCode,
  SitemapValidationResult as ValidationResult,
} from "./validate";
export { isStructurallyValidDocument } from "./validate";

export type { SitemapDocumentDecodeOutcome } from "./codec";
export { decodeSitemapDocument, encodeSitemapDocument } from "./codec";

export type {
  SitemapLoadOutcome,
  SitemapRecoveryReason,
} from "./recovery";
export type { SitemapLoadOutcome as LoadOutcome } from "./recovery";
export { loadSitemapDocument } from "./recovery";
