// scripts/lib/scaffold-config.mjs
//
// Single source of truth for "where does @zudo-sg/ui's component tree live,
// what's it imported as, and does this project even have a barrel-export
// convention" — read by scripts/new-component.mjs and scripts/gen-sg-registry.mjs
// so both stay in lockstep, and so a fork that relocates the components
// root, renames the package, or drops the barrel-file convention only edits
// this one file (#191).
//
// Pure data, no fs/process — every path value here is a REPO-ROOT-RELATIVE
// POSIX string; callers `resolve()` it against their own ROOT constant.

/**
 * Repo-root-relative path to the directory scanned for `*.stories.tsx` files
 * at any depth — both the one-level `<name>/<name>.stories.tsx` layout and
 * the category-nested `<category>/<name>/<name>.stories.tsx` layout (see
 * STORIES.md §2).
 */
export const COMPONENTS_ROOT = "packages/ui/src";

/**
 * Repo-root-relative path to the barrel file `new-component.mjs` inserts an
 * `export { … }` block into. Set to `null` for a project with no
 * barrel-file convention — new-component.mjs then always skips the
 * barrel-insert step, same as always passing --skip-barrel.
 */
export const BARREL_INDEX = "packages/ui/src/index.ts";

/**
 * The npm package name components are imported from — used in generated
 * `usage` snippets (component-scaffold.mjs's storiesTemplate) and in the
 * package-scoped import specifiers gen-sg-registry.mjs emits into
 * src/styleguide/data/sg-registry.ts.
 */
export const UI_PACKAGE_NAME = "@zudo-sg/ui";
