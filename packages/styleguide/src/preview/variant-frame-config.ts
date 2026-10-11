import type { PreviewTheme } from "./messages.js";

export type ViewportId = "mobile" | "tablet" | "desktop" | "full";

export interface Viewport {
  id: ViewportId;
  label: string;
  width: string;
}

// Mobile is the narrowest, listed first; Full remains last so the fixed-width
// presets progress from narrowest to widest before the fluid option.
export const VIEWPORTS: Viewport[] = [
  { id: "mobile", label: "Mobile", width: "320px" },
  { id: "tablet", label: "Tablet", width: "768px" },
  { id: "desktop", label: "Desktop", width: "1280px" },
  { id: "full", label: "Full", width: "100%" },
];

/** Fluid width — the fixed presets are opt-in. */
export const DEFAULT_VIEWPORT_ID: ViewportId = "full";

export type ThemeMode = "follow" | PreviewTheme;

export interface ThemeOption {
  id: ThemeMode;
  label: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: "follow", label: "Follow catalog" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export const DEFAULT_THEME_MODE: ThemeMode = "follow";

/**
 * What a stage does about theme. `"none"` hands theme to the host (#883): the
 * stage never posts `sg:setTheme`, so a preview document that picks its own
 * theme (e.g. from a `previewParams` entry) is never overridden.
 */
export type FrameThemeMode = ThemeMode | "none";

/** Query keys the stage owns; `previewParams` entries using them are ignored. */
export const RESERVED_PREVIEW_PARAMS: readonly string[] = ["slug", "variant"];

/**
 * The preview document URL for one variant: `slug` and `variant` first, then
 * every `previewParams` entry URL-encoded in insertion order. A reserved key
 * in `previewParams` is dropped rather than thrown on — the identity pair must
 * stay authoritative, and throwing from an island would blank the whole page.
 */
export function buildPreviewSrc(
  previewUrl: string,
  slug: string,
  exportName: string,
  previewParams?: Readonly<Record<string, string>>,
): string {
  let src = `${previewUrl}?slug=${encodeURIComponent(slug)}&variant=${encodeURIComponent(exportName)}`;
  if (previewParams) {
    for (const [key, value] of Object.entries(previewParams)) {
      if (RESERVED_PREVIEW_PARAMS.includes(key)) continue;
      src += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }
  }
  return src;
}

export function viewportWidth(id: ViewportId): string {
  const preset = VIEWPORTS.find((v) => v.id === id) ?? VIEWPORTS.at(-1);
  return preset?.width ?? "100%";
}

export function readCatalogTheme(): PreviewTheme | null {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "light" || theme === "dark" ? theme : null;
}

/** Initial iframe height (px) before the frame reports its own, and after a variant change. */
export const INITIAL_FRAME_HEIGHT = 180;

/**
 * `allow-forms` is required by `packages/demo-ui/src/forms/` stories: #499 saw
 * Chromium block submission without it (the submit listener did not fire and
 * the frame did not navigate), while with it the listener fired and the frame
 * navigated to the real action. The catalog form stories omit their enhancer
 * islands, so `contact-form.stories.tsx` cannot show this: it renders
 * `<ContactForm />` alone; `ContactFormEnhancer` lives at previewRoute
 * `/preview/contact`, which the detail page links out to instead of rendering
 * in a preview iframe.
 */
export const DEFAULT_FRAME_SANDBOX: readonly string[] = [
  "allow-same-origin",
  "allow-scripts",
  "allow-forms",
];
