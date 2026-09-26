/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Inline, server-rendered thumbnails for a host's `/components` catalogue
// (#540, moved into the engine package by #653).
//
// The catalogue page already has the story registry server-side, so it can
// call `story.render(...)` directly instead of booting a preview iframe per
// tile. That matters: a preview route boots a bundle that STATICALLY imports
// every story module, so N iframes would mean N browsing contexts each
// parsing the whole story set, all still alive after a full scroll. Rendering
// inline costs zero runtime, and the thumbnails land in the static HTML — the
// catalogue shows components with JavaScript disabled.
//
// WHY THE HTML GOES THROUGH A STRING
// A thumbnail is a SNAPSHOT, not a live component: it is `inert`, decorative,
// and shares its document with every other tile. Rendering to a string lets us
//   1. prefix every `id` (and every attribute that references one) per tile, so
//      tiles cannot collide — an id used by more than one story would silently
//      redirect `<label for>` (or similar) across tiles;
//   2. drop `<script>` blocks (a story may embed a `type="application/json"`
//      search index for its own enhancer), so no story can ever ship bytes
//      that execute on the catalogue.
// The scoping happens lazily, per slug, memoized in `thumbCache` below — a
// component thumbnail is computed once no matter how many times its tile
// re-renders (a static build renders the catalogue page once, so in practice
// this runs once per story anyway; the memo just keeps a second render, or a
// future dynamic caller, from re-rendering to a string twice).
//
// Framing (virtual viewport, scale, fit) lives in the package's `styles.css`;
// this module only supplies the per-tile geometry variable and the markup.

import type { JSX } from "preact";
import { render as renderToStaticHtml } from "preact-render-to-string";
import type { StoryControl } from "../stories/types.js";
import type { StoryEntry } from "../registry/registry.js";
import type { CatalogEntry } from "../registry/catalog.js";

/** Virtual-viewport width (CSS px) a thumbnail lays its component out at. */
export const THUMB_VIEWPORT_W = 720;

/**
 * Narrower virtual viewport for categories whose components are atoms — a
 * button or a paragraph laid out at 720px is a speck in the tile.
 */
export const THUMB_VIEWPORT_W_ATOM = 400;

/**
 * Categories that use the atom-scale virtual viewport. Category values are
 * plain strings (host-declared `categoryOrder`, ADR decision 5) — the engine
 * does not own a closed category union.
 */
export const ATOM_SCALE_CATEGORIES: readonly string[] = [
  "Typography",
  "Actions",
  "Feedback",
  "News",
  "Media",
  "Forms",
];

/**
 * Per-component opt-out to a static note, keyed by story slug. A component
 * earns an entry ONLY when it throws during the server render, needs a client
 * island to show anything at all, or escapes its tile; the value is the reason,
 * rendered in the tile so a reader never meets an unexplained blank.
 *
 * Intentionally empty by default — a host wires its own entries in only where
 * a real story needs the opt-out. `buildThumb` also falls back to this path on
 * a thrown render, so one broken story degrades to a labelled tile instead of
 * taking the whole catalogue build down.
 */
export const THUMB_OPT_OUTS: Readonly<Record<string, string>> = {};

/** Virtual-viewport width for a category's tiles. */
export function thumbViewportWidth(category: string): number {
  return ATOM_SCALE_CATEGORIES.includes(category)
    ? THUMB_VIEWPORT_W_ATOM
    : THUMB_VIEWPORT_W;
}

/**
 * The scale the package's `styles.css` applies, as a number: the tile's track
 * minimum over the virtual-viewport width.
 *
 * Deliberately has no runtime caller. The CSS owns the arithmetic — it computes
 * `--sg-thumb-scale` from the same two custom properties so the tile-size
 * control can change the track without re-rendering every thumbnail — and this
 * is the checkable mirror of it, which the contract test in `__tests__` pins
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
const STYLE_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const ID_ATTR_RE = /\sid="([^"]*)"/g;
const ID_REF_ATTR_RE = new RegExp(`\\s(${ID_REF_ATTRS.join("|")})="([^"]*)"`, "g");
const FRAGMENT_HREF_RE = /\shref="#([^"\s]+)"/g;
const FRAGMENT_URL_RE = /url\(#([^)"\s]+)\)/g;

/**
 * Make one rendered story safe to inline alongside every other tile: strip
 * `<script>` and `<style>` blocks, and namespace every id (and every
 * reference to one) under `prefix`, so intra-tile wiring — a `<label for>`, an
 * `aria-controls`, an SVG `url(#gradient)` — keeps working while nothing leaks
 * across tiles.
 *
 * `<style>` is stripped for two independent reasons, either of which alone
 * would justify it. It is invalid here: `<style>` is metadata content, so
 * html-validate rejects it under a `<div>` (`element-permitted-content`). And
 * it is *global*: a story-only rule pinning something to its own frame would,
 * inlined verbatim, apply to the whole catalogue page rather than just the
 * tile that carries it. Nothing is lost: the tile's `transform` already
 * establishes a containing block, which is what actually keeps
 * fixed-position content inside its own box here.
 *
 * Attribute-shaped text inside a component's own *content* (a code sample that
 * literally prints ` id="…"`) would be rewritten too. That is cosmetic in a
 * decorative snapshot.
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
    .replace(STYLE_RE, "")
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
  // no such export for.
  const variant = entry.variants[0];
  if (!variant) return { kind: "note", reason: "No variants declared" };
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

/**
 * Per-slug memo. Populated lazily on first render — the engine has no access
 * to a host's full story list up front (that would be a `@/`-style host
 * import), so unlike the old host-owned module this cannot warm the whole
 * cache eagerly at import time. A host that renders every `ComponentThumb`
 * once per build (the catalogue page's normal use) gets the same effective
 * behavior: each thumbnail is still computed exactly once.
 */
const thumbCache = new Map<string, Thumb>();

function getThumb(entry: StoryEntry): Thumb {
  const cached = thumbCache.get(entry.slug);
  if (cached) return cached;
  const thumb = buildThumb(entry);
  thumbCache.set(entry.slug, thumb);
  return thumb;
}

export interface ComponentThumbProps {
  entry: StoryEntry;
}

/**
 * One tile's thumbnail slot. `aria-hidden` + `inert` keep the snapshot out of
 * the accessibility tree AND out of the tab order — a catalogue page renders a
 * lot of focusable controls this way, and focusable content inside an
 * `aria-hidden` subtree is an accessibility defect, not just noise.
 */
export function ComponentThumb({ entry }: ComponentThumbProps): JSX.Element {
  const thumb = getThumb(entry);
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

/** Tile note for a descriptor story until descriptor thumbnails land (epic #879, E3). */
export const DESCRIPTOR_THUMB_PENDING_NOTE = "Thumbnail pending: descriptor stories have no server-rendered preview yet.";

export interface CatalogThumbProps {
  entry: CatalogEntry;
}

/**
 * Catalog tile thumbnail for either registry mode. A module entry renders its
 * story inline through `ComponentThumb`; a descriptor entry has no render
 * function, so it gets a labelled note rather than a blank tile.
 */
export function CatalogThumb({ entry }: CatalogThumbProps): JSX.Element {
  if (entry.source === "module") return <ComponentThumb entry={entry.storyEntry} />;
  return (
    <div class="sg-thumb" data-sg-preview-scope data-sg-thumb-pending aria-hidden="true" inert>
      <p class="sg-thumb-note">{DESCRIPTOR_THUMB_PENDING_NOTE}</p>
    </div>
  );
}

CatalogThumb.displayName = "CatalogThumb";
