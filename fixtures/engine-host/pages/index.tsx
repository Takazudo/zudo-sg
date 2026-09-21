/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The root page stays host-owned so it can import site-wide islands.
import type { JSX } from "preact";
// Optional islands seed; see pages/lib/_zudo-sg-islands.ts.
import "./lib/_zudo-sg-islands";
// Statically imported (not just reached through `chromeBindingsModule`'s
// virtual re-export) so zfb's island scanner is guaranteed to discover
// PreviewTokenPanelBootstrap and register it under its SSR marker — mirrors
// the sibling zudo-doc showcase's pages/index.tsx import of the same chain.
import { BodyEndIslands } from "./lib/_body-end-islands";

export const frontmatter = { title: "Styleguide starter" };

export default function IndexPage(): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Styleguide starter</title>
      </head>
      <body class="min-h-screen bg-bg font-sans text-base leading-normal text-fg">
        <main class="mx-auto flex max-w-[48rem] flex-col gap-vsp-lg px-hsp-lg py-vsp-2xl">
          <h1 data-host-index class="text-2xl font-bold leading-tight">Styleguide starter</h1>
          <p class="text-muted">Explore your components, their stories, and the design tokens that bring them together.</p>
          <nav aria-label="Styleguide" class="flex flex-wrap gap-hsp-md">
            <a
              href="/components"
              class="inline-flex px-hsp-sm py-vsp-sm font-semibold text-accent underline hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Components
            </a>
            <a
              href="/tokens"
              class="inline-flex px-hsp-sm py-vsp-sm font-semibold text-accent underline hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Design Tokens
            </a>
          </nav>
        </main>
        <BodyEndIslands />
      </body>
    </html>
  );
}
