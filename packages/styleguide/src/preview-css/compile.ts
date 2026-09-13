// Preview-CSS compiler: turns a host `previewStyles` entry into the single
// standalone stylesheet served/emitted at `previewCssUrl`
// (docs/adr/styleguide-engine.md decision 4). No zfb hooks live here — the
// plugin (#663) owns serving, watching and build emit.
//
// Pipeline mirrors what @tailwindcss/vite does internally: `compile` the entry,
// scan `compiler.sources` (+ `compiler.root` unless "none") with the oxide
// `Scanner`, `build(candidates)`, rescope token roots, then `optimize`.

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { compile, optimize } from "@tailwindcss/node";
import { Scanner, type SourceEntry } from "@tailwindcss/oxide";
import { toForwardSlash } from "../host-paths.js";

/** Attribute carried by the preview document's `<html>`. */
export const PREVIEW_DOC_ATTRIBUTE = "data-sg-preview-doc";

export interface CompilePreviewCssOptions {
  /** Minify the output (default `true`). */
  minify?: boolean;
}

export interface CompilePreviewCssResult {
  /** The compiled, rescoped, optimized stylesheet. */
  css: string;
  /**
   * Absolute forward-slash paths of every CSS/JS file the compile read: the
   * entry first, then each `onDependency` file (imports, plugins, configs).
   * Deduplicated. A change to any of these requires a recompile.
   */
  dependencies: string[];
  /**
   * Absolute forward-slash paths of the content files the candidate scan
   * read (the `@source` globs). Editing one can add/remove utilities, so a
   * dev watcher should treat them as recompile triggers as well.
   */
  sourceFiles: string[];
  /** Number of utility candidates the scan produced. */
  candidateCount: number;
}

/**
 * zfb injects the host's global stylesheet into every route AFTER the preview
 * `<link>` with no per-route opt-out, and both worlds define colliding
 * `--color-*` tokens. Rescoping the preview world's token roots to
 * `:root[data-sg-preview-doc]` (specificity 0,1,1 vs 0,1,0) keeps the preview
 * tokens winning regardless of link order. Must run on the unminified
 * `build()` output — `optimize` collapses the whitespace these patterns match.
 */
export function scopeTokensToPreviewDoc(css: string): string {
  const scoped = `:root[${PREVIEW_DOC_ATTRIBUTE}]`;
  return css
    .replaceAll(":root, :host {", `${scoped}, :host {`)
    .replaceAll(":root {", `${scoped} {`);
}

/**
 * Compile a host preview stylesheet entry.
 *
 * @param entryAbsPath absolute path to the entry CSS file (resolve the host's
 *   project-root-relative `previewStyles` option before calling).
 */
export async function compilePreviewCss(
  entryAbsPath: string,
  options: CompilePreviewCssOptions = {},
): Promise<CompilePreviewCssResult> {
  const { minify = true } = options;
  const entry = resolve(entryAbsPath);
  const input = await readFile(entry, "utf8");

  const dependencies = new Set<string>([toForwardSlash(entry)]);
  const compiler = await compile(input, {
    base: dirname(entry),
    from: entry,
    onDependency: (path) => {
      dependencies.add(toForwardSlash(resolve(path)));
    },
  });

  const sources: SourceEntry[] = compiler.sources.map((source) => ({ ...source }));
  if (compiler.root && compiler.root !== "none") {
    sources.push({ base: compiler.root.base, pattern: compiler.root.pattern, negated: false });
  }

  const scanner = new Scanner({ sources });
  const candidates = scanner.scan();

  const built = scopeTokensToPreviewDoc(compiler.build(candidates));
  const css = optimize(built, { file: toForwardSlash(entry), minify }).code;

  return {
    css,
    dependencies: [...dependencies],
    sourceFiles: scanner.files.map((file) => toForwardSlash(file)),
    candidateCount: candidates.length,
  };
}
