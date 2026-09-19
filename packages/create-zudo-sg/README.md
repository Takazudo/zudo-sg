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

The initializer is available from its first npm release; nothing is published
by this epic.

The command defaults to no dependency installation and prints the five
commands after it creates the project. Pass `--install` when the initializer
should run `pnpm install` for you. The generated `package.json` pins the
package manager to pnpm, and this release has no npm, yarn, or `--pm` mode.

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
- `zudo-sg.config.mjs` with a local `ui/` components root, registry output,
  preview stylesheet, category order, and token-manifest inputs.
- `pages/index.tsx` and an optional `pages/lib/_zudo-sg-islands.ts` import
  shim for the host page.
- Three small Preact examples under `ui/`: Button, Card, and Counter, with
  co-located stories and a Button MDX document.
- `src/styleguide/sg-registry.ts`, an empty generated seed. Run
  `pnpm gen-registry` after changing stories.
- `src/content/docs/getting-started.mdx`, a seed page for the generated host's
  documentation route.
- `src/styles/preview-entry.css` and `src/styles/ui-tokens.css`, which provide
  the standalone preview stylesheet and the token source used by
  `pnpm gen-token-manifest`.
- `tsconfig.json` and `pnpm-workspace.yaml`, a workspace policy suitable for a
  fresh host.

The initializer replaces the package-name placeholder in the template and
renames the package-safe `_gitignore` to `.gitignore`. The token manifest is
generated after installation; it is intentionally not checked into the
template seed.

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
