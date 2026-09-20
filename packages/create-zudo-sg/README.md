# create-zudo-sg

`create-zudo-sg` is the pnpm-only initializer for a new
[`@takazudo/zudo-sg`](https://github.com/Takazudo/zudo-sg/tree/main/packages/styleguide)
styleguide host. It copies a small, working Preact + zfb project into a new
directory; the generated project is private and is ready to customize.

## Quick start

```sh
pnpm create zudo-sg@latest my-styleguide
cd my-styleguide
pnpm install
pnpm gen-registry
pnpm gen-token-manifest
pnpm dev
```

The command defaults to no dependency installation and prints the five
commands after it creates the project. Pass `--install` when the initializer
should run `pnpm install` for you. The generated `package.json` pins the
package manager to pnpm, and this release has no npm, yarn, or `--pm` mode.
Commit the generated `pnpm-lock.yaml` so the host's dependency resolution is
reproducible.

## Usage

```txt
create-zudo-sg [project-dir] [options]
```

| Option | Description |
| --- | --- |
| `[project-dir]` | Directory to create. If omitted, the CLI prompts when it has a TTY. |
| `--name <pkg-name>` | Package name written to the generated `package.json`; defaults to the directory basename. |
| `--install` | Run `pnpm install` after copying the template. |
| `--no-install` | Do not install dependencies (the default). |
| `--yes` | Do not prompt. A project directory is required with this flag. |
| `--help` | Print usage and options. |
| `--version` | Print the initializer version. |

The target directory must be empty or not exist. The package name must follow
npm's lowercase package-name rules; scoped names are accepted with
`--name @scope/project`. The initializer does not add feature prompts or
overwrite an existing project.

## What the scaffold contains

The template is a minimal host, not a copy of this repository's full site. It
contains:

- `zfb.config.ts` composing `zudoDoc()` and `withZudoSg()` with a root base.
- `zfb.config.ts` uses an inline `favicon: "auto"`; replace it with a path or `FaviconConfig` when adding real icons under `public/`.
- `zudo-sg.config.mjs` with a local `ui/` components root, registry output,
  preview stylesheet, category order, and token-manifest inputs.
- `pages/index.tsx` and an optional `pages/lib/_zudo-sg-islands.ts` import
  shim for the host page.
- Three small Preact examples under `ui/`: Button, Card, and Counter, with
  co-located stories and a Button MDX document.
- `src/styleguide/sg-registry.ts`, generated from the three example stories.
  Run `pnpm gen-registry` after changing stories; the CLI also bootstraps a
  missing or whitespace-only output.
- `src/content/docs/getting-started.mdx`, a seed page for the generated host's
  documentation route.
- `src/styles/global.css`, the automatically discovered host stylesheet, plus
  `src/styles/preview-entry.css` for standalone previews and
  `src/styles/ui-tokens.css`, the token source used by `pnpm gen-token-manifest`.
- `tsconfig.json` and `pnpm-workspace.yaml`, a workspace policy suitable for a
  fresh host.

The initializer replaces the package-name placeholder in the template and
renames the package-safe `_gitignore` to `.gitignore`. The token manifest is
generated after installation; it is intentionally not checked into the
template seed.

## Styles

zfb discovers `src/styles/global.css` automatically; no page import or config
entry is needed. Keep its imports in this order:

1. Declare `@layer zd-preflight, zd-flow`, then import
   `tailwindcss/preflight` in `layer(zd-preflight)` and unlayered
   `tailwindcss/utilities`.
2. Import `@takazudo/zudo-doc/theme.css`, then `./ui-tokens.css` and any
   component package stylesheet. The theme supplies the framework tokens and
   resets the color-token namespace; preflight is the only element reset.
3. Import zudo-doc's `safelist.css`, `content.css`, `features.css`, and
   `page-loading.css`, in that order.
4. Import `@takazudo/zdtp/dashboard/styles.css` after content styles so the
   `/tokens` dashboard wins ties with prose rules, then
   `@takazudo/zudo-sg/styles.css` and `@takazudo/zudo-sg/safelist.css`.
5. Keep the `@source` globs for `pages/`, `ui/`, and `src/content/`; add your
   component package's source glob alongside them. zfb resolves these
   global-entry paths from the project root.

Keep the engine styles and Tailwind utilities unlayered: utility margins must
outrank `zd-flow`, while engine chrome overrides must compete with utilities.
Do not add the full `tailwindcss` import or a second preflight. If an existing
host defines consumer-only color tokens before zudo-doc's theme, replace
`theme.css` with `theme-no-reset.css` to preserve them. That variant only
omits the color-token reset; tokens defined by both stylesheets still follow
source order.

### Three token worlds and engine overrides

The generated host has three color-token worlds: zudo-doc's `--zd-*` roles for the
documentation shell, zudo-sg's raw `--sg-*` roles for catalog chrome, and the host
component library's own `@theme` color tokens (usually `--color-*`) for previewed
components. Keep the engine and component-library roles separate.

The engine defaults are plain `--sg-*` properties under `:where(:root)`, so zudo-doc's
`theme.css` `--color-*` reset cannot erase them. Retheme engine chrome with an ordinary,
unlayered override in any import position:

```css
:root {
  --sg-border: oklch(0.72 0.02 65);
}
```

If the host previously used bare `--color-border` to style engine chrome, migrate that
declaration to `--sg-border` (and migrate each other chrome role to its corresponding
`--sg-*` role). `--color-border` can still style the host's own components. The
order-proof engine hook does not change the import-order contract for those host-owned
`@theme` colors: import `theme.css` before them, or deliberately use
`theme-no-reset.css` when their earlier declaration must be preserved. This is the
zudo-doc namespace contract for host-owned color tokens; the engine's raw `--sg-*`
namespace is separate.

The preview document uses `src/styles/preview-entry.css` independently. Add
your component package's styles and source scan there too when previews need
them; its `@source` paths are relative to that stylesheet. Keep dashboard and
catalog chrome imports in the host's global entry.

## Release-age exemptions

The generated `pnpm-workspace.yaml` exempts only the exact versions shipped by
this starter: zfb, its runtime and wasm packages, zudo-doc, zdtp, the engine,
and zfb's platform binaries. Later dependency upgrades are not covered by
these entries and follow the consumer's normal `minimumReleaseAge` policy.
The platform binaries have their own entries because the package resolver
checks each optional package independently.

## Host requirements and caveats

The starter targets Preact + zfb hosts. Keep these dependencies in a host
that adopts the engine:

- `@takazudo/zdtp` is required by the injected `/tokens` route at build time.
- `diff` and `katex` are required by the published zudo-doc route dist that
  the host loads, even when the corresponding optional features are disabled.

Keep the `tokens` block in `zudo-sg.config.mjs` as well. The initializer's
configuration is typed with `tokens` required, and `gen-token-manifest` needs
its two CSS paths and `manifestOut`; removing it makes the printed setup step
fail and leaves the token dashboards without their manifest.

For a host that already exists, use the manual composition and dependency
steps in the [`@takazudo/zudo-sg` installation guide](https://github.com/Takazudo/zudo-sg/tree/main/packages/styleguide#installation)
instead of copying this template by hand.

## License

MIT
