// Prop names a Composition node may NEVER carry, at the MODEL layer (issue #287).
//
// This set was originally defined only in the preview protocol
// (`src/features/composer/preview/protocol.ts`), which rejects it on the wire,
// and `renderer.ts`'s `safeProps` strips it again defensively before render.
// Neither of those gates protects `updateProps` (`./commands.ts`): a direct
// model-layer caller (not routed through the postMessage bridge) could persist
// a reserved key straight into the stored `CompositionDocument`. Hoisting the
// set here lets the model reject it itself, independent of the preview
// boundary.
//
// The model package stays dependency-free of `src/features/` — this file has
// no imports at all — so `protocol.ts` re-exports this set instead of
// defining its own, keeping existing preview-side consumers unchanged.
//
// JSON-safety is not the same as safety. `dangerouslySetInnerHTML: { __html }`
// is perfectly JSON-safe, and several cohort components spread their rest props
// straight onto a DOM element (`ProseP` renders `<p {...rest} />`), so a
// document carrying that key would get raw HTML injected into a document that is
// SAME-ORIGIN with `/composer`. That is exactly the "nothing crossing this bridge
// is ever evaluated" invariant this protocol exists to hold, so the key is
// refused at the boundary rather than sanitized downstream.
//
// `key`/`ref` are Preact-reserved: `key` would hijack the renderer's own keying
// (the DOM-identity guarantee) and `ref` would hand a document out a live DOM
// handle. The prototype names are refused on principle — a JSON-parsed object
// can carry them as own properties.
//
// None of these are reachable from the authoring contract (#244): a Composer
// field is a scalar text/select/boolean/number/color prop, so no legitimate
// document can ever need one.
export const RESERVED_PROP_KEYS: ReadonlySet<string> = new Set([
  "dangerouslySetInnerHTML",
  "key",
  "ref",
  "__proto__",
  "constructor",
  "prototype",
]);
