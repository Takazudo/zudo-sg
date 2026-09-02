// Catalogue tile-size contract — the single source of truth for the segmented
// control's option set, its localStorage key, and the `<html>` attribute the
// gallery CSS keys off.
//
// Mirrors the house pattern in src/features/styleguide/chrome/panel-contract.ts
// (+ panel-scripts-source.ts): pure constants and DOM helpers, importable from
// SSR (constants only) and from the client island alike, with the inline
// restore script built from those same constants so a rename flows through
// instead of drifting.
//
// The size is a per-viewer convenience, not content: every read and write is
// wrapped so private-mode / disabled storage degrades to the default rather
// than throwing.

/** Attribute set on `<html>`; `gallery.css` reads it to pick the track size. */
export const ATTR_TILE_SIZE = "data-sg-tile-size";

/** localStorage key (styleguide-private `sg-` namespace). */
export const LS_TILE_SIZE = "sg-catalog-tile-size";

export type TileSize = "compact" | "large";

export interface TileSizeOption {
  id: TileSize;
  label: string;
  /**
   * Grid track minimum in CSS px. Must equal the `--sg-tile-min-n` value the
   * matching `gallery.css` rule sets — the unit test asserts the two agree.
   */
  trackMin: number;
}

export const TILE_SIZES: readonly TileSizeOption[] = [
  { id: "compact", label: "Compact", trackMin: 272 },
  { id: "large", label: "Large", trackMin: 400 },
];

export const DEFAULT_TILE_SIZE: TileSize = "compact";

export function isTileSize(value: unknown): value is TileSize {
  return TILE_SIZES.some((option) => option.id === value);
}

/** Persisted size, or the default when storage is unavailable or unset. */
export function readTileSize(): TileSize {
  try {
    const raw = localStorage.getItem(LS_TILE_SIZE);
    return isTileSize(raw) ? raw : DEFAULT_TILE_SIZE;
  } catch {
    return DEFAULT_TILE_SIZE;
  }
}

/** Write the attribute (drives the CSS) and persist it, best-effort. */
export function applyTileSize(size: TileSize, el?: HTMLElement): void {
  (el ?? document.documentElement).setAttribute(ATTR_TILE_SIZE, size);
  try {
    localStorage.setItem(LS_TILE_SIZE, size);
  } catch {
    /* private mode / disabled storage — the attribute still took effect */
  }
}

/**
 * Inline `<head>` script source. Runs before first paint so a reader who chose
 * Large does not watch 72 tiles re-lay themselves out when the island mounts.
 * Built from the constants above; keep it dependency-free and self-contained —
 * an inline script cannot import this module at runtime.
 */
export const TILE_SIZE_RESTORE_SCRIPT = [
  "try{",
  `var v=localStorage.getItem(${JSON.stringify(LS_TILE_SIZE)});`,
  `if(${JSON.stringify(TILE_SIZES.map((option) => option.id))}.indexOf(v)>-1)`,
  `document.documentElement.setAttribute(${JSON.stringify(ATTR_TILE_SIZE)},v)`,
  "}catch(e){}",
].join("");
