// Live CSS belongs to its code panel, and survives iframe loading/reloading.
// Registered VariantFrames replay only after their own accepted ready message;
// legacy direct callers retain the selector-based injection API.
import { PREVIEW_ROUTE_PATH } from "../preview/route.js";

const INJECTED_STYLE_ATTR = "data-sg-injected-css";
type Owner = { styles: Map<HTMLIFrameElement, Map<string, HTMLStyleElement>> };
type Buffer = { owner: Owner; cssKey: string; css: string; previewUrl: string };
type Registration = { tokens: Set<symbol>; readyDocument: Document | null };
const buffers = new Map<string, Buffer>();
const registrations = new Map<HTMLIFrameElement, Registration>();
const legacyLoads = new Map<HTMLIFrameElement, () => void>();
const styleOwners = new WeakMap<HTMLStyleElement, Owner>();
const owners = new Set<Owner>();

function normalizedPath(url: URL): string {
  return url.pathname.replace(/\/$/u, "") || "/";
}
function bufferId(previewUrl: string, cssKey: string): string {
  let target = previewUrl;
  if (typeof document !== "undefined") {
    try {
      const url = new URL(previewUrl, document.baseURI);
      target = `${url.origin}${normalizedPath(url)}`;
    } catch {
      // Invalid routes never match a frame, but still have an owner lifecycle.
    }
  }
  return JSON.stringify([target, cssKey]);
}
function matches(iframe: HTMLIFrameElement, previewUrl: string): boolean {
  try {
    const base = new URL(iframe.ownerDocument.baseURI);
    const source = new URL(iframe.getAttribute("src") ?? "", base);
    const target = new URL(previewUrl, base);
    const origin = new URL(iframe.ownerDocument.URL).origin;
    return source.origin === origin && target.origin === origin &&
      normalizedPath(source) === normalizedPath(target);
  } catch {
    return false;
  }
}
function forgetStyle(owner: Owner, iframe: HTMLIFrameElement, cssKey: string): void {
  const styles = owner.styles.get(iframe);
  styles?.delete(cssKey);
  if (!styles?.size) owner.styles.delete(iframe);
}
function releaseFrameStyles(iframe: HTMLIFrameElement, currentDocument?: Document | null): void {
  for (const owner of owners) {
    for (const [cssKey, style] of owner.styles.get(iframe) ?? []) {
      if (currentDocument && style.ownerDocument === currentDocument) continue;
      if (styleOwners.get(style) === owner) style.remove();
      forgetStyle(owner, iframe, cssKey);
    }
  }
}
function frameDocument(iframe: HTMLIFrameElement): Document | null {
  try {
    return iframe.contentDocument;
  } catch {
    return null; // Cross-origin frames are never a live-CSS target.
  }
}
function stylesFor(doc: Document, cssKey: string): HTMLStyleElement[] {
  return Array.from(doc.querySelectorAll<HTMLStyleElement>(`style[${INJECTED_STYLE_ATTR}]`))
    .filter((style) => style.getAttribute(INJECTED_STYLE_ATTR) === cssKey);
}
function injectInto(iframe: HTMLIFrameElement, buffer: Buffer): void {
  const doc = frameDocument(iframe);
  if (!doc?.head) return;
  const registration = registrations.get(iframe);
  if (registration && registration.readyDocument !== doc) return;
  const existing = stylesFor(doc, buffer.cssKey);
  if (!buffer.css) {
    for (const style of existing) {
      const previousOwner = styleOwners.get(style);
      if (previousOwner) forgetStyle(previousOwner, iframe, buffer.cssKey);
      style.remove();
      styleOwners.delete(style);
    }
    return;
  }
  let style = existing[0];
  if (!style) {
    style = doc.createElement("style");
    style.setAttribute(INJECTED_STYLE_ATTR, buffer.cssKey);
    style.id = `sg-injected-${buffer.cssKey}`;
    doc.head.appendChild(style);
  }
  style.textContent = buffer.css;
  const previousOwner = styleOwners.get(style);
  if (previousOwner) forgetStyle(previousOwner, iframe, buffer.cssKey);
  styleOwners.set(style, buffer.owner);
  const ownedStyles = buffer.owner.styles.get(iframe) ?? new Map();
  ownedStyles.set(buffer.cssKey, style);
  buffer.owner.styles.set(iframe, ownedStyles);
}
function pruneLegacyLoads(): void {
  for (const [iframe, listener] of legacyLoads) {
    if (!iframe.isConnected || registrations.has(iframe) ||
      !Array.from(buffers.values()).some((buffer) => buffer.css && matches(iframe, buffer.previewUrl))) {
      iframe.removeEventListener("load", listener);
      legacyLoads.delete(iframe);
    }
  }
}
function ensureLegacyLoad(iframe: HTMLIFrameElement): void {
  if (registrations.has(iframe) || legacyLoads.has(iframe)) return;
  const listener = () => replayCssToPreview(iframe);
  iframe.addEventListener("load", listener);
  legacyLoads.set(iframe, listener);
}

/** VariantFrame owns readiness; registering alone never styles an about:blank document. */
export function registerCssPreview(iframe: HTMLIFrameElement): () => void {
  let registration = registrations.get(iframe);
  if (!registration) {
    registration = { tokens: new Set(), readyDocument: null };
    registrations.set(iframe, registration);
  }
  const token = Symbol("preview registration");
  registration.tokens.add(token);
  pruneLegacyLoads();
  return () => {
    const current = registrations.get(iframe);
    if (!current?.tokens.delete(token) || current.tokens.size) return;
    registrations.delete(iframe);
    releaseFrameStyles(iframe);
  };
}

/** Call only after VariantFrame accepts ready; always reads the latest retained buffers. */
export function replayCssToPreview(iframe: HTMLIFrameElement): void {
  const registration = registrations.get(iframe);
  const doc = frameDocument(iframe);
  releaseFrameStyles(iframe, doc);
  if (registration) registration.readyDocument = doc;
  for (const buffer of buffers.values()) {
    if (matches(iframe, buffer.previewUrl)) injectInto(iframe, buffer);
  }
}

/** Own a code panel's buffers. Retention is synchronous; only apply() should be debounced. */
export function createPreviewCssOwner(previewUrl: string = PREVIEW_ROUTE_PATH): {
  set(cssKey: string, css: string): void;
  apply(): void;
  dispose(): void;
} {
  const owner: Owner = { styles: new Map() };
  owners.add(owner);
  const keys = new Set<string>();
  let disposed = false;
  return {
    set(cssKey, css) {
      if (disposed) return;
      const id = bufferId(previewUrl, cssKey);
      // A replaced owner's late callbacks must not reclaim a newer panel's buffer.
      if (keys.has(id) && buffers.get(id)?.owner !== owner) return;
      keys.add(id);
      buffers.set(id, { owner, cssKey, css, previewUrl });
    },
    apply() {
      if (disposed || typeof document === "undefined") return;
      const frames = new Set([
        ...registrations.keys(),
        ...document.querySelectorAll<HTMLIFrameElement>("iframe[src]"),
      ]);
      for (const id of keys) {
        const buffer = buffers.get(id);
        if (buffer?.owner !== owner) continue;
        for (const iframe of frames) {
          if (!matches(iframe, previewUrl)) continue;
          if (buffer.css) ensureLegacyLoad(iframe);
          injectInto(iframe, buffer);
        }
      }
      pruneLegacyLoads();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const id of keys) {
        if (buffers.get(id)?.owner === owner) buffers.delete(id);
      }
      for (const styles of owner.styles.values()) {
        for (const style of styles.values()) {
          if (styleOwners.get(style) === owner) style.remove();
        }
      }
      owner.styles.clear();
      owners.delete(owner);
      pruneLegacyLoads();
    },
  };
}

const legacyOwners = new Map<string, ReturnType<typeof createPreviewCssOwner>>();
/** Selector-compatible direct injection, with current-value replay on later loads. */
export function injectCssToAllPreviews(
  cssKey: string,
  css: string,
  previewUrl: string = PREVIEW_ROUTE_PATH,
): void {
  const id = bufferId(previewUrl, cssKey);
  legacyOwners.get(id)?.dispose();
  const owner = createPreviewCssOwner(previewUrl);
  legacyOwners.set(id, owner);
  owner.set(cssKey, css);
  owner.apply();
  if (!css) {
    owner.dispose();
    legacyOwners.delete(id);
  }
}
