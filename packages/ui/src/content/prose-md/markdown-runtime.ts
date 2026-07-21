/**
 * Client-side markdown → sanitized HTML runtime, backed by
 * `@takazudo/zfb-md-wasm` (the wasm build of zfb's own markdown pipeline, so
 * a live preview matches what zfb renders at build time).
 *
 * ## Fence handling: why the source is re-scanned
 *
 * The site renders fences in zfb's CLASS mode — semantic `hi-*` token classes
 * under `pre.hi-root`, coloured through `--zfb-hi-*` → `--zd-syntax-*`. That
 * is a TOP-LEVEL `codeHighlight: { mode: "class" }` key in `zfb.config.ts`
 * (set by `@takazudo/zudo-doc`'s preset), and the wasm boundary does NOT
 * expose it. Verified empirically against the pinned `0.1.0-next.89` package:
 *
 *   - `pipeline.features` is `MarkdownFeaturesConfig` and is validated by a
 *     Rust `deny_unknown_fields` deserializer whose accepted keys are
 *     `githubAlerts, readingTime, githubAutolinks, codeEnrichment, codeTabs,
 *     ruby, tocExport, imageDimensions, linkValidation, transclude,
 *     directives, mermaid, headingMarkerToc, headingIds` — no highlight key,
 *     so `features.codeHighlight` comes back as an `options` error diagnostic.
 *   - `pipeline.theme` only accepts a syntect THEME NAME. `theme: null` does
 *     not disable highlighting; it falls back to `base16-ocean.dark`, and
 *     `theme: "class"` is rejected as an unknown theme.
 *   - So every info-string fence renders as
 *     `<pre class="syntect-base16-ocean-dark">` with inline `style="color:…"`
 *     spans and no record of its original language.
 *
 * Hence the interim strategy: scan the markdown SOURCE for fenced blocks
 * (`fence-scan.ts`), then substitute positionally — Nth source fence carrying
 * an info string ↔ Nth `<pre class="syntect-*">` in document order — with
 * `highlightCode(code, { language })`, which IS closed to class mode and emits
 * the `hi-*` markup the site already styles. `roleClasses` is deliberately not
 * passed: this project themes via `data-theme` + `light-dark()` tokens, never
 * Tailwind `dark:` utilities. If the two counts disagree (a fence nested in a
 * blockquote or list item, which the flat scanner does not see) the
 * substitution is skipped wholesale and the syntect blocks are downgraded to
 * bare `hi-root` markup, so a mismatch loses colour rather than mislabelling
 * code. Lifting this needs a language-preserving unhighlighted fence mode in
 * `renderHtml` upstream.
 *
 * ## Sanitization is mandatory
 *
 * `renderHtml` is not a sanitizer. Verified against `next.89`: raw
 * `<script>alert(1)</script>`, `<a onclick="…">`, `<svg onload="…">`,
 * `<iframe src="…">` and `[x](javascript:…)` all pass through with zero
 * diagnostics. Every returned string therefore goes through DOMPurify with an
 * explicit prose allowlist (below) as the LAST step, after fence
 * substitution, so highlight markup is covered too. `style` is not allowed,
 * which also strips any inline syntect colours left by the mismatch path.
 *
 * ## Caller responsibilities
 *
 * Stale-result protection is the CALLER's. `renderMarkdown` is a plain
 * promise with no cancellation; a component that re-renders on every keystroke
 * must drop results whose input no longer matches its current state. Only the
 * module import is cached — a rejected import is evicted so a later mount can
 * retry a transient chunk load.
 */

import DOMPurify from "dompurify";
import type {
  Diagnostic,
  DiagnosticSource,
  HighlightDiagnosticSource,
  PipelineOptions,
} from "@takazudo/zfb-md-wasm";
import { scanInfoStringFences } from "./fence-scan";

export type MarkdownDiagnosticSource = DiagnosticSource | HighlightDiagnosticSource | "sanitize";

export interface MarkdownDiagnostic {
  severity: "error" | "warning";
  source: MarkdownDiagnosticSource;
  message: string;
  line: number | null;
  column: number | null;
}

export interface MarkdownRenderResult {
  /** Sanitized HTML fragment, or `null` when any error diagnostic was raised. */
  html: string | null;
  diagnostics: MarkdownDiagnostic[];
}

export type MarkdownModule = Pick<
  typeof import("@takazudo/zfb-md-wasm"),
  "renderHtml" | "highlightCode"
>;

export type MarkdownModuleImporter = () => Promise<MarkdownModule>;

export interface MarkdownRuntime {
  renderMarkdown(source: string): Promise<MarkdownRenderResult>;
}

/**
 * Mirrors the site's build-time markdown behavior: `cjkFriendly` from
 * `src/config/settings.ts`, and zfb's CONSERVATIVE GFM default (strikethrough
 * + table on, autolinks / task lists / footnotes off) — neither the zudo-doc
 * preset nor `zfb.config.ts` overrides `markdown.gfm`, so the build runs this
 * exact set. Spelled out rather than left to the wasm default so a future
 * upstream default change surfaces as a test failure instead of a silent
 * preview/build divergence.
 */
const PIPELINE_OPTIONS: PipelineOptions = {
  gfm: {
    strikethrough: true,
    table: true,
    autolinkLiteral: false,
    taskListItem: false,
    footnoteDefinition: false,
  },
  cjkFriendly: true,
};

/**
 * Safe to match non-greedily: fence bodies are entity-escaped, so no `</pre>`
 * can appear inside. Built fresh per use — a shared `/g` literal carries
 * `lastIndex` state between calls.
 */
function highlightedPrePattern(): RegExp {
  return /<pre class="syntect-[^"]*">[\s\S]*?<\/pre>/g;
}

const HIGHLIGHT_ROOT_CLASS = "hi-root";

/**
 * Prose allowlist for the sanitizer. Covers what zfb's markdown pipeline can
 * emit for this project's fences and GFM set, plus the `hi-*` highlight markup
 * (`class` on `pre`/`code`/`span`). `style` is intentionally absent.
 */
const ALLOWED_TAGS = [
  "a", "abbr", "blockquote", "br", "code", "dd", "del", "div", "dl", "dt", "em",
  "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "img", "ins",
  "kbd", "li", "mark", "ol", "p", "pre", "s", "samp", "section", "span", "strong",
  "sub", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul", "var",
];

const ALLOWED_ATTR = [
  "align", "alt", "class", "colspan", "dir", "height", "href", "id", "lang",
  "reversed", "rowspan", "src", "start", "title", "type", "width",
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escaped-but-unhighlighted `hi-root` markup, matching `highlightCode`'s own fallback shape. */
function fallbackHighlightMarkup(code: string): string {
  const lines = code.split("\n").map((line) => `<span class="line">${escapeHtml(line)}</span>`);
  return `<pre class="${HIGHLIGHT_ROOT_CLASS}"><code>${lines.join("")}</code></pre>`;
}

/**
 * Probe run through the sanitizer before it is trusted. `isSupported` is not
 * sufficient: under happy-dom 16.8.1 (this repo's vitest DOM) DOMPurify
 * reports `isSupported: true` yet returns its input essentially untouched —
 * `<script>` and `onerror=` survive. A DOM that merely looks complete enough
 * can therefore turn sanitization into a silent no-op, so verify the real
 * behavior once per instance instead of trusting the capability flag.
 */
const SANITIZER_PROBE = '<img src="x" onerror="alert(1)"><script>alert(2)</script>';

let purifier: typeof DOMPurify | null = null;
let purifierVerified = false;

/**
 * `dompurify`'s default export binds `window` at module-evaluation time, which
 * is absent when this module is first pulled in during an SSR pass. Re-bind on
 * every miss so a later browser-side call still gets a working instance.
 */
function getPurifier(): typeof DOMPurify | null {
  if (!purifier?.isSupported) {
    purifierVerified = false;
    purifier = DOMPurify.isSupported ? DOMPurify : DOMPurify();
  }
  if (!purifier.isSupported) return null;
  if (!purifierVerified) {
    const probe = purifier.sanitize(SANITIZER_PROBE, { ALLOWED_TAGS, ALLOWED_ATTR });
    if (/<script/i.test(probe) || /\son[a-z]+=/i.test(probe)) return null;
    purifierVerified = true;
  }
  return purifier;
}

/**
 * Sanitize an assembled prose fragment. Returns `null` when no working
 * sanitizer is available — DOMPurify degrades to a pass-through rather than
 * throwing, and returning unsanitized HTML would be worse than returning
 * nothing.
 */
export function sanitizeRenderedHtml(html: string): string | null {
  const instance = getPurifier();
  if (!instance) return null;
  return instance.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

function toDiagnostic(diagnostic: Diagnostic): MarkdownDiagnostic {
  return {
    severity: diagnostic.severity,
    source: diagnostic.source,
    message: diagnostic.message,
    line: diagnostic.line,
    column: diagnostic.column,
  };
}

/**
 * Rewrite syntect blocks left unsubstituted into bare `hi-root` markup. Their
 * inline colours are dropped by the sanitizer anyway; renaming the class at
 * least keeps the site's code-block styling.
 */
function neutralizeHighlightedBlocks(html: string): string {
  return html.replace(
    /<pre class="syntect-[^"]*">/g,
    `<pre class="${HIGHLIGHT_ROOT_CLASS}">`,
  );
}

async function substituteFences(
  html: string,
  source: string,
  module: MarkdownModule,
  diagnostics: MarkdownDiagnostic[],
): Promise<string> {
  const blocks = html.match(highlightedPrePattern()) ?? [];
  if (blocks.length === 0) return html;

  const fences = scanInfoStringFences(source);
  if (fences.length !== blocks.length) {
    diagnostics.push({
      severity: "warning",
      source: "highlight",
      message:
        `found ${fences.length} source fence(s) with an info string but ` +
        `${blocks.length} highlighted block(s); skipped language-aware ` +
        "highlighting for this document",
      line: null,
      column: null,
    });
    return neutralizeHighlightedBlocks(html);
  }

  const replacements = await Promise.all(
    fences.map(async ({ language, code }) => {
      const result = await module.highlightCode(code, { language });
      for (const diagnostic of result.diagnostics) {
        diagnostics.push({
          severity: diagnostic.severity,
          source: diagnostic.source,
          message: diagnostic.message,
          line: diagnostic.line,
          column: diagnostic.column,
        });
      }
      return result.html ?? fallbackHighlightMarkup(code);
    }),
  );

  let cursor = 0;
  return html.replace(highlightedPrePattern(), () => replacements[cursor++]);
}

/**
 * Build a markdown runtime over a module importer. The cached value is only
 * the package-root import; a rejection is evicted so the next call retries.
 */
export function createMarkdownRuntime(importModule: MarkdownModuleImporter): MarkdownRuntime {
  let modulePromise: Promise<MarkdownModule> | null = null;

  function loadModule(): Promise<MarkdownModule> {
    if (!modulePromise) {
      const pending = importModule().catch((error: unknown) => {
        if (modulePromise === pending) {
          modulePromise = null;
        }
        throw error;
      });
      modulePromise = pending;
    }
    return modulePromise;
  }

  return {
    async renderMarkdown(source) {
      const diagnostics: MarkdownDiagnostic[] = [];
      try {
        const module = await loadModule();
        const rendered = await module.renderHtml(source, {
          filename: "prose.md",
          pipeline: PIPELINE_OPTIONS,
        });
        diagnostics.push(...rendered.diagnostics.map(toDiagnostic));
        if (rendered.html === null) {
          return { html: null, diagnostics };
        }

        const assembled = await substituteFences(rendered.html, source, module, diagnostics);
        if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
          return { html: null, diagnostics };
        }

        const sanitized = sanitizeRenderedHtml(assembled);
        if (sanitized === null) {
          diagnostics.push({
            severity: "error",
            source: "sanitize",
            message: "no working DOM sanitizer available for the rendered markdown",
            line: null,
            column: null,
          });
          return { html: null, diagnostics };
        }
        return { html: sanitized, diagnostics };
      } catch (error) {
        // A module-load failure or a wasm trap (`ZfbMdWasmTrapError`) is the
        // only way this boundary throws; surface it as a diagnostic so callers
        // never have to wrap the call themselves.
        diagnostics.push({
          severity: "error",
          source: "internal",
          message: error instanceof Error ? error.message : String(error),
          line: null,
          column: null,
        });
        return { html: null, diagnostics };
      }
    },
  };
}

const defaultRuntime = createMarkdownRuntime(() => import("@takazudo/zfb-md-wasm"));

/** Render markdown to sanitized HTML using the shared lazily-loaded runtime. */
export function renderMarkdown(source: string): Promise<MarkdownRenderResult> {
  return defaultRuntime.renderMarkdown(source);
}
