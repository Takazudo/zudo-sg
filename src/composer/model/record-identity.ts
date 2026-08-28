// Compatibility shim for the Composer's domain-specific record identity.
//
// The implementation is provider-neutral and lives in `src/shared`; aliases
// preserve every established Composer name and import path.

export type { RecordId as CompositionRecordId } from "../../shared/record-identity";
export {
  RECORD_ID_PATTERN as COMPOSITION_RECORD_ID_PATTERN,
  isSafeRecordId as isSafeCompositionRecordId,
} from "../../shared/record-identity";
