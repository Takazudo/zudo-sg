/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Host-owned root page (ADR decision 7: `/` stays host-owned — it is the
// host's static-import root for site-wide islands).
import type { JSX } from "preact";
// Islands seed — optional since zfb 2.18.0, kept so the fixture exercises
// the public subpath (ADR finding 4 amendment). See pages/lib/_zudo-sg-islands.ts.
import "./lib/_zudo-sg-islands";

export const frontmatter = { title: "Engine host fixture" };

export default function IndexPage(): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Engine host fixture</title>
      </head>
      <body>
        <h1 data-host-index>Engine host fixture</h1>
        <a href="/styleguide/components">Components</a>
      </body>
    </html>
  );
}
