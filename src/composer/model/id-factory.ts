// Compatibility shim for Composer imports.
//
// ID factories are app-neutral and now live in `src/shared`; this module keeps
// the established Composer import path and export names intact.

export type { IdFactory } from "../../shared/id-factory";
export { createSequentialIdFactory, createUuidIdFactory } from "../../shared/id-factory";
