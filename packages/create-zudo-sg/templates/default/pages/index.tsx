/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// The root page stays host-owned so it can import site-wide islands.
import type { JSX } from "preact";
// Optional islands seed; see pages/lib/_zudo-sg-islands.ts.
import "./lib/_zudo-sg-islands";

export const frontmatter = { title: "Styleguide starter" };

export default function IndexPage(): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Styleguide starter</title>
      </head>
      <body>
        <h1 data-host-index>Styleguide starter</h1>
        <a href="/components">Components</a>
      </body>
    </html>
  );
}
