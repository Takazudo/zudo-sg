/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Inline, server-rendered thumbnails for the /components catalogue (#540).
//
// The catalogue page already imports the story registry server-side, so it can
// call `story.render(...)` directly instead of booting a preview iframe per
// tile. That matters: `/components/preview` boots a bundle that STATICALLY
// imports all 72 story modules, so 72 iframes would mean 72 browsing contexts
// each parsing the whole story set, all still alive after a full scroll.
// Rendering inline costs zero runtime, and the thumbnails land in the static
// HTML — the catalogue shows components with JavaScript disabled.
//
// WHY THE HTML GOES THROUGH A STRING
// A thumbnail is a SNAPSHOT, not a live component: it is `inert`, decorative,
// and 72 of them share one document. Rendering to a string lets us
//   1. prefix every `id` (and every attribute that references one) per tile, so
//      72 snapshots cannot collide — `zui-nav-toggle` alone appears in three
//      stories, and duplicate ids silently redirect `<label for>` across tiles;
//   2. drop `<script>` blocks (two stories embed a `type="application/json"`
//      search index for their enhancer), so no story can ever ship bytes that
//      execute on the catalogue.
// The scoping is done once, eagerly, at module init — mirroring
// `storyEntries` in src/styleguide/data/registry.ts — which also keeps the
// nested render out of the page's own render pass.
//
// Framing (virtual viewport, scale, fit) lives in catalog/gallery.css; this
// module only supplies the per-tile geometry variable and the markup.

import type { JSX } from "preact";
import { render as renderToStaticHtml } from "preact-render-to-string";
import type { StoryCategory, StoryControl } from "@zudo-sg/ui";
import { storyEntries, type StoryEntry } from "@/styleguide/data/registry";

/** Virtual-viewport width (CSS px) a thumbnail lays its component out at. */
export const THUMB_VIEWPORT_W = 720;

/**
 * Narrower virtual viewport for categories whose components are atoms — a
 * button or a paragraph laid out at 720px is a speck in the tile.
 */
export const THUMB_VIEWPORT_W_ATOM = 400;

/** Categories that use the atom-scale virtual viewport. */
export const ATOM_SCALE_CATEGORIES: readonly StoryCategory[] = [
  "Typography",
  "Actions",
  "Feedback",
  "News",
  "Media",
];

/**
 * Per-component opt-out to a static note, keyed by story slug. A component
 * earns an entry ONLY when it throws during the server render, needs a client
 * island to show anything at all, or escapes its tile; the value is the reason,
 * rendered in the tile so a reader never meets an unexplained blank.
 *
 * Intentionally empty: all 72 components render server-side today (the unit
 * test in `__tests__/component-thumb.test.tsx` is the guard), and
 * `position: fixed` escapes are contained by the scale transform's containing
 * block rather than opted out. `buildThumb` also falls back to this path on a
 * thrown render, so one broken story degrades to a labelled tile instead of
 * taking the whole catalogue build down.
 */
export const THUMB_OPT_OUTS: Readonly<Record<string, string>> = {};

/** Virtual-viewport width for a category's tiles. */
export function thumbViewportWidth(category: StoryCategory): number {
  return ATOM_SCALE_CATEGORIES.includes(category)
    ? THUMB_VIEWPORT_W_ATOM
    : THUMB_VIEWPORT_W;
}

/**
 * The scale `gallery.css` applies, as a number: the tile's track minimum over
 * the virtual-viewport width.
 *
 * Deliberately has no runtime caller. The CSS owns the arithmetic — it computes
 * `--sg-thumb-scale` from the same two custom properties so the tile-size
 * control can change the track without re-rendering 72 thumbnails — and this is
 * the checkable mirror of it, which the contract test in `__tests__` pins
 * against both the CSS formula and TILE_SIZES.
 */
export function thumbScale(trackMin: number, viewportWidth: number): number {
  return trackMin / viewportWidth;
}

/** Seed render args from each control's declared default (as the preview does). */
function defaultsFromControls(
  controls: StoryControl[] | undefined,
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const control of controls ?? []) args[control.prop] = control.defaultValue;
  return args;
}

/** Attributes whose value is one or more space-separated id references. */
const ID_REF_ATTRS = [
  "for",
  "form",
  "list",
  "headers",
  "aria-controls",
  "aria-labelledby",
  "aria-describedby",
  "aria-details",
  "aria-owns",
  "aria-activedescendant",
];

const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const ID_ATTR_RE = /\sid="([^"]*)"/g;
const ID_REF_ATTR_RE = new RegExp(`\\s(${ID_REF_ATTRS.join("|")})="([^"]*)"`, "g");
const FRAGMENT_HREF_RE = /\shref="#([^"\s]+)"/g;
const FRAGMENT_URL_RE = /url\(#([^)"\s]+)\)/g;

/**
 * Make one rendered story safe to inline alongside 71 others: strip `<script>`
 * blocks and namespace every id (and every reference to one) under `prefix`,
 * so intra-tile wiring — a `<label for>`, an `aria-controls`, an SVG
 * `url(#gradient)` — keeps working while nothing leaks across tiles.
 *
 * Attribute-shaped text inside a component's own *content* (a code sample that
 * literally prints ` id="…"`) would be rewritten too. That is cosmetic in a
 * decorative snapshot and no current story does it.
 */
export function scopeThumbHtml(html: string, prefix: string): string {
  const scopeRefList = (value: string): string =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .map((ref) => `${prefix}${ref}`)
      .join(" ");

  return html
    .replace(SCRIPT_RE, "")
    .replace(ID_ATTR_RE, (_match, id: string) => ` id="${prefix}${id}"`)
    .replace(
      ID_REF_ATTR_RE,
      (_match, attr: string, value: string) => ` ${attr}="${scopeRefList(value)}"`,
    )
    .replace(FRAGMENT_HREF_RE, (_match, id: string) => ` href="#${prefix}${id}"`)
    .replace(FRAGMENT_URL_RE, (_match, id: string) => `url(#${prefix}${id})`);
}

/** Per-tile id namespace. Story slugs are unique by construction. */
export function thumbIdPrefix(slug: string): string {
  return `sgt-${slug}-`;
}

type Thumb = { kind: "html"; html: string } | { kind: "note"; reason: string };

function buildThumb(entry: StoryEntry): Thumb {
  const optOut = THUMB_OPT_OUTS[entry.slug];
  if (optOut) return { kind: "note", reason: optOut };

  // `variants[0]` is the first-AUTHORED story, and its export name is read from
  // the registry — never assumed to be "Default", which many components have
  // no such export for (hero is Primary/Secondary, cta-button Playground/Pair).
  const variant = entry.variants[0];
  try {
    // `render` returns ComponentChildren (possibly a string or an array), so
    // wrap it in a fragment rather than casting it to a VNode.
    const html = renderToStaticHtml(
      <>{variant.story.render(defaultsFromControls(variant.story.controls))}</>,
    );
    return { kind: "html", html: scopeThumbHtml(html, thumbIdPrefix(entry.slug)) };
  } catch (error) {
    return {
      kind: "note",
      reason: `Preview unavailable: ${(error as Error).message}`,
    };
  }
}

/** All thumbnails, rendered once at module init (eager + synchronous). */
const thumbBySlug = new Map<string, Thumb>(
  storyEntries.map((entry) => [entry.slug, buildThumb(entry)]),
);

export interface ComponentThumbProps {
  entry: StoryEntry;
}

/**
 * One tile's thumbnail slot. `aria-hidden` + `inert` keep the snapshot out of
 * the accessibility tree AND out of the tab order — 72 rendered components
 * carry a lot of focusable controls, and focusable content inside an
 * `aria-hidden` subtree is an accessibility defect, not just noise.
 */
export function ComponentThumb({ entry }: ComponentThumbProps): JSX.Element {
  const thumb = thumbBySlug.get(entry.slug) ?? buildThumb(entry);
  const viewportWidth = thumbViewportWidth(entry.meta.category);

  return (
    <div
      class="sg-thumb"
      data-sg-preview-scope
      aria-hidden="true"
      inert
      style={
        viewportWidth === THUMB_VIEWPORT_W
          ? undefined
          : `--sg-thumb-vw-n: ${viewportWidth}`
      }
    >
      {thumb.kind === "note" ? (
        <p class="sg-thumb-note">{thumb.reason}</p>
      ) : (
        <div
          class="sg-thumb-inner"
          dangerouslySetInnerHTML={{ __html: thumb.html }}
        />
      )}
    </div>
  );
}

ComponentThumb.displayName = "ComponentThumb";
