/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-owned root page — descriptor-host fixture (epic #879, S7). No zdtp
// token panel wiring: this fixture ships no `tokens` block, so the
// preview-tokens trigger stays off by default (issue #872).

import type { JSX } from "preact";

export const frontmatter = { title: "Descriptor host fixture" };

export default function IndexPage(): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Descriptor host fixture</title>
      </head>
      <body class="min-h-screen bg-bg font-sans text-base leading-normal text-fg">
        <main class="mx-auto flex max-w-[48rem] flex-col gap-vsp-lg px-hsp-lg py-vsp-2xl">
          <h1 data-host-index class="text-2xl font-bold leading-tight">Descriptor host fixture</h1>
          <p class="text-muted">
            Stories are registered as plain-data descriptors, previewed through this
            host's own external frame.
          </p>
          <nav aria-label="Styleguide" class="flex flex-wrap gap-hsp-md">
            <a
              href="/components"
              class="inline-flex px-hsp-sm py-vsp-sm font-semibold text-accent underline hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Components
            </a>
          </nav>
        </main>
      </body>
    </html>
  );
}
