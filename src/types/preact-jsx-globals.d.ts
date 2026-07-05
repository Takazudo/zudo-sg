/// <reference types="preact/compat" />
// Global Preact JSX anchor for the root tsconfig (#113).
//
// The root tsconfig type-checks with `jsx: "preserve"` (zfb owns the JSX
// transform), so JSX intrinsic attributes resolve against the global `JSX`
// namespace. `@types/react` is installed (it backs the `react` -> preact/compat
// paths alias for React-API compat), and absent anything else its global JSX —
// which requires `className`, not `class` — governs the whole program. Pulling
// preact/compat's types in makes Preact's `class`-accepting intrinsics the
// resolved source instead.
//
// This used to happen incidentally: the only src files importing preact/compat
// were the image-enlarge / mermaid-enlarge / use-modal-dialog island forks.
// #113 retired those (they duplicated package islands and collided with them
// under packageOwnedRoutes), which dropped preact/compat from the program and
// let @types/react's `className`-only JSX win — breaking every `class=` across
// the src + packages/ui import graph. This reference re-anchors preact/compat
// independently of which components exist. Types only — zero runtime/bundle cost.
