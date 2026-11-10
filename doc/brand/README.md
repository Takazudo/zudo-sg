# zudo-sg: A06 / Rhythm

The approved identity is **A06 / Rhythm**, accepted on 2026-11-11 (Asia/Tokyo).
Five solid panels form a shallow oblique composition: one large upper-left
panel, two stacked smaller panels at the upper right, and two unequal base
panels. Softened corners, the supplied proportions, and the transparent gutters
are part of the canonical geometry. Do not redraw, simplify, add facets, or
recolor individual panels. Other logo candidates are not part of this kit.

## Assets and use

| Role | Location relative to `doc/` |
| --- | --- |
| Standard currentColor symbol | `public/img/brand/zudo-sg-symbol.svg` |
| Byte-identical home hero alias | `public/img/logo.svg` |
| Compact currentColor header symbol | `public/img/brand/zudo-sg-symbol-small.svg` |
| Fixed black/white standard and compact symbols | `public/img/brand/zudo-sg-symbol*-black.svg`, `*-white.svg` |
| Portable outlined Jost lockups | `public/img/brand/zudo-sg-lockup.svg`, `zudo-sg-lockup-white.svg` |
| Adaptive compact SVG favicon | `public/favicon.svg` |
| Compact raster/ICO fallbacks | `public/favicon-16x16.png`, `favicon-32x32.png`, `favicon.ico` |
| Supplied 1200×630 social card | `public/img/ogp.png` |
| Self-hosted font and original license | `public/fonts/jost-600.woff2`, `public/fonts/OFL.txt` |

Use the compact optical master at 16–32 CSS px and in the documentation header.
Use the standard master in the home hero and at larger placements. Both SVG
masters have transparent backgrounds and gutters. The header keeps the
package's own icon size and spacing.

The adaptive SVG favicon uses dark ink on a light color scheme and white ink
in a dark color scheme. The PNG and ICO favicon fallbacks intentionally have
opaque white backing, including their gutters. The ICO contains 16, 32, and
48 px compact frames. The separate 48 px PNG in the input kit is a proof asset
only and is not a site file.

The product name is always live, selectable, lowercase `zudo-sg` in the header
and the home hero. Set it in upright Jost SemiBold 600 with normal letter
spacing and no text transformation. Outlined lockups are portable graphics
only. Article, sidebar, navigation, and control fonts stay on the theme. Do
not replace `--font-sans` globally. The header icon is decorative.

## Supported integration

`zfb.config.ts` sets `siteName` to `zudo-sg` and uses the package's `logo`,
`headerBrand`, explicit `favicon`, and complete `metaTags` options. `metaTags`
is shallow-merged, so the object keeps description, keywords, Open Graph, and
Twitter roles together. Package-owned chrome paints the header and hero
symbols as currentColor masks. The header icon stays decorative, and the brand
link's accessible name stays `zudo-sg`.

`src/styles/global.css` scopes Jost to those two live names. ZFB leaves
project-authored CSS URLs unchanged and emits the stylesheet under `assets/`:
`../fonts/jost-600.woff2` therefore resolves relative to the emitted stylesheet,
not this source file. It applies on the home page and on nested routes, and a
configured base is applied once. The font uses `font-display: swap` and the
theme sans as fallback. Website builds do not call a font generator or an
external font service.

## Provenance and source

Copied from the owner-supplied `zudo-sg-a06-doc-brand-kit.zip`. Every entry of
its `MANIFEST.sha256` was verified before integration. Production artwork,
font, and OFL bytes are unchanged. The ZIP itself is not committed.

Input ZIP SHA-256:

`6462e81041b0ca930e6a6f03888eaa921615bf4af1c3866b9804bf209a37a7d4`

Canonical source SHA-256:

| Input | SHA-256 |
| --- | --- |
| `assets/zudo-sg-symbol.svg` | `a6f2e891c1dc0642dba83342d491ee816d11757b5b663e8af5bf9ad60d3a7925` |
| `assets/zudo-sg-symbol-small.svg` | `f2b0ecfcba23c3a22a39af06fb8d8b05fe4a86e77a275ec855d62ab962962f91` |
| `fonts/jost-600.woff2` | `fa418d4c46615b4e07e2011eed91a3e399f88bf67bd8bc39e3fee14a04e442b5` |
| `fonts/OFL.txt` | `b9c2ddb5e698b4287241ab26190c8e4c5e3a395d486ac80e96e8f979b44ed625` |

- `source/rhythm.json`: unchanged canonical standard and compact geometry.
- `source/brand-layout.json`: supplied lockup measurements and font identity.
  Only `typography.file` is rebased to `../../public/fonts/jost-600.woff2` so
  it points at the production font from `doc/brand/source/`.
- `source/ogp.svg`: unchanged outlined source composition for the supplied PNG.
- The standard and compact currentColor symbols, outlined lockups, WOFF2, and
  OFL are byte-identical copies of the accepted kit. Fixed-ink SVGs change
  only color values. Favicons and the social card are deterministic derivatives
  of those masters.
- Jost and its OFL, and the scoped typography pattern, originate in
  [ZFB's brand assets at 2f5c865](https://github.com/Takazudo/zudo-front-builder/tree/2f5c8658360941f1d4be135d2f8508ae464d3542/docs/brand).
  Keep the unmodified OFL beside the WOFF2. Copyright 2020 The Jost Project
  Authors (https://github.com/indestructible-type). This font license does not
  change the repository license.

The integration follows the docs branding in
[zudo-stl-fix at 1be34cb](https://github.com/Takazudo/zudo-stl-fix/tree/1be34cb3de961e72bf5cff4c56e16bdc64adba8d/doc).
The ZIP, comparison boards, proof sheets, the 48 px PNG, and temporary
generators are not website assets. The root host logo, demo branding, engine
packages, and dependency versions are outside this docs-only change.
