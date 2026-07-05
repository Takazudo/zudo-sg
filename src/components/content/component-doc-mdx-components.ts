// Per-component docs (#119) — the MDX component overrides passed to a
// `componentDocs` entry's `<Content components={…} />` on the component detail
// page.
//
// The zfb content bridge already merges its own `defaultComponents` (the 11
// typography passthroughs: h2/h3/h4/p/a/strong/blockquote/ul/ol/table/code) as
// the base of every render (see buildContentComponent in @takazudo/zfb's
// content module). Wrapping the render in `.zd-content` then styles those bare
// tags via zudo-doc's content.css — so this map only needs to supply the
// non-typography tags the bridge does NOT know about: the admonition
// components emitted by `:::note` directives / `<Note>` JSX / github-alerts.
//
// This mirrors the admonition subset of zudo-doc's own createMdxComponents
// map, using the host's real admonition component so `:::note` in a component
// doc renders byte-identically to `:::note` in a regular doc page.

import { makeAdmonition } from "./content-admonition";

/** Admonition tag → component, matching the directive vocabulary in zfb.config.ts. */
export const componentDocMdxComponents = {
  Note: makeAdmonition("note"),
  Tip: makeAdmonition("tip"),
  Info: makeAdmonition("info"),
  Warning: makeAdmonition("warning"),
  Danger: makeAdmonition("danger"),
  Caution: makeAdmonition("caution"),
  Important: makeAdmonition("important"),
};
