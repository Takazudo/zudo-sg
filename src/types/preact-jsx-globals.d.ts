// Global Preact JSX anchor for the root tsconfig (#113).
//
// The root tsconfig type-checks with `jsx: "preserve"` (zfb owns the JSX
// transform), so JSX intrinsics resolve against the GLOBAL `JSX` namespace.
// That global comes from preact/compat's types, which re-export preact's
// `declare global { namespace JSX }` (preact/src/jsx) — the declaration that
// makes `class` (not `className`) a valid intrinsic attribute.
//
// It used to be loaded incidentally: the only src files importing
// `preact/compat` were the image-enlarge / mermaid-enlarge / use-modal-dialog
// island forks. #113 retired those forks (they duplicated package islands and
// collided with them under packageOwnedRoutes), which dropped preact/compat
// from the program and let @types/react's global JSX win instead — breaking
// every `class=` across the src + packages/ui import graph. This side-effect
// import re-anchors the Preact global JSX independently of which components
// exist. `.d.ts`, so it has zero runtime/bundle effect.
import "preact/compat";
