/**
 * Sitemapper app-chrome icon set — renderer-safe plain `.ts` + Preact `h()`.
 *
 * `makeIcon(renderSvg, defaultSize)` produces a named-export icon component.
 * Every icon uses a 16px viewBox, `currentColor`, `aria-hidden="true"`, and the
 * local `--spacing-icon-*` ladder in `src/styles/global.css`.
 *
 * The retained glyphs are the exact Sitemapper tree actions: disclosure
 * chevrons, add, duplicate, delete, and page identity.
 */

import { h } from "preact";
import type { FunctionComponent, JSX, VNode } from "preact";

export type IconSize = "xs" | "sm" | "md" | "lg";

export interface IconProps {
  /** Explicit pixel width — bypasses the size-class wrapper span. */
  width?: number;
  /** Explicit pixel height — bypasses the size-class wrapper span. */
  height?: number;
  /** Token-driven size (default `"md"`), via `w-icon-*` / `h-icon-*`. */
  size?: IconSize;
  class?: string;
  style?: string | JSX.CSSProperties;
}

export type IconComponent = FunctionComponent<IconProps>;

// Preact's `VNode<P>` is invariant in `P` (its `type` field is a
// contravariant `ComponentType<P>`), so a `VNode<{ d: string }>` from
// `h("path", …)` is NOT assignable to the default `VNode<{}>` — the internal
// signatures use this erased alias instead.
type AnyVNode = VNode<any>;

const sizeClasses: Record<IconSize, string> = {
  xs: "w-icon-xs h-icon-xs",
  sm: "w-icon-sm h-icon-sm",
  md: "w-icon-md h-icon-md",
  lg: "w-icon-lg h-icon-lg",
};

type IconRenderFn = (
  width: number | string,
  height: number | string,
  cls: string | undefined,
  style: string | JSX.CSSProperties | undefined,
) => AnyVNode;

/**
 * Factory that produces an `XxxIcon` component from a single SVG render
 * function (zudo-text pattern).
 *
 * - Explicit-size branch (`width`/`height` prop given): delegates directly to
 *   `renderSvg` with the numeric dimensions, `class`, and `style`.
 * - Default branch: wraps `renderSvg("100%", "100%", …)` in a flex `<span>`
 *   that carries the size class, `class`, and `style`.
 *
 * `defaultSize` fills in the other dimension when only one of
 * `width`/`height` is supplied.
 */
function makeIcon(renderSvg: IconRenderFn, defaultSize = 16): IconComponent {
  return function Icon({ width, height, size = "md", class: cls, style }: IconProps): AnyVNode {
    if (width !== undefined || height !== undefined) {
      return renderSvg(width ?? defaultSize, height ?? defaultSize, cls, style);
    }
    return h(
      "span",
      {
        class: `inline-flex items-center justify-center shrink-0 ${sizeClasses[size]}${cls ? ` ${cls}` : ""}`,
        style,
      },
      renderSvg("100%", "100%", undefined, undefined),
    );
  };
}

type SvgChildProps = Record<string, string | number>;

/** Shared `<svg>` shell: 16 viewBox, `aria-hidden`, per-icon paint props. */
function svgRoot(
  width: number | string,
  height: number | string,
  cls: string | undefined,
  style: string | JSX.CSSProperties | undefined,
  paint: SvgChildProps,
  children: AnyVNode[],
): AnyVNode {
  return h(
    "svg",
    {
      "aria-hidden": "true",
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 16 16",
      width,
      height,
      class: cls,
      style,
      ...paint,
    },
    children,
  );
}

const FILLED: SvgChildProps = { fill: "currentColor" };

function stroked(strokeWidth: number): SvgChildProps {
  return {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": strokeWidth,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  };
}

function evenOddPath(d: string): AnyVNode {
  return h("path", { "fill-rule": "evenodd", "clip-rule": "evenodd", d });
}

// ── Chevrons (ported from zudo-text) ─────────────────────────────────────────

export const ChevronRightIcon: IconComponent = makeIcon((w, hgt, cls, style) =>
  svgRoot(w, hgt, cls, style, FILLED, [
    evenOddPath(
      "M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z",
    ),
  ]),
);

export const ChevronDownIcon: IconComponent = makeIcon((w, hgt, cls, style) =>
  svgRoot(w, hgt, cls, style, FILLED, [
    evenOddPath(
      "M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z",
    ),
  ]),
);

export const ChevronUpIcon: IconComponent = makeIcon((w, hgt, cls, style) =>
  svgRoot(w, hgt, cls, style, FILLED, [
    evenOddPath(
      "M11.78 9.78a.75.75 0 0 1-1.06 0L8 7.06 5.28 9.78a.75.75 0 0 1-1.06-1.06l3.25-3.25a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06Z",
    ),
  ]),
);

// ── Actions (ported from zudo-text) ──────────────────────────────────────────

export const PlusIcon: IconComponent = makeIcon((w, hgt, cls, style) =>
  svgRoot(w, hgt, cls, style, FILLED, [
    h("path", {
      d: "M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z",
    }),
  ]),
);

export const TrashIcon: IconComponent = makeIcon((w, hgt, cls, style) =>
  svgRoot(w, hgt, cls, style, FILLED, [
    evenOddPath(
      "M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.712Z",
    ),
  ]),
);

// ── Actions (authored new, matching the zudo-text flat/line weight) ──────────

/** Two offset pages — the Sitemapper duplicate-page glyph. */
export const CopyIcon: IconComponent = makeIcon((w, hgt, cls, style) =>
  svgRoot(w, hgt, cls, style, stroked(1.5), [
    h("rect", { x: 5.5, y: 5.5, width: 8.5, height: 8.5, rx: 1.25 }),
    h("path", {
      d: "M3.25 10.75h-.5c-.83 0-1.5-.67-1.5-1.5v-6c0-.83.67-1.5 1.5-1.5h6c.83 0 1.5.67 1.5 1.5v.5",
    }),
  ]),
);

// ── Page tree glyph ──────────────────────────────────────────────────────────

/** Page/root node: framed page with a header rule. */
export const PageIcon: IconComponent = makeIcon((w, hgt, cls, style) =>
  svgRoot(w, hgt, cls, style, stroked(1.5), [
    h("rect", { x: 1.75, y: 2.25, width: 12.5, height: 11.5, rx: 1.25 }),
    h("line", { x1: 1.75, y1: 5.25, x2: 14.25, y2: 5.25 }),
  ]),
);
