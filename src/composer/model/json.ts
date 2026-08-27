// Compatibility shim for Composer imports.
//
// JSON helpers live in the app-neutral shared module; keep this path stable so
// existing Composer code and consumers do not need to migrate in this wave.

export { cloneJson, isJsonSafe, isPlainObject } from "../../shared/json";
