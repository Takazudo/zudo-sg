/**
 * CommonMark fenced-code-block scanner over raw markdown SOURCE.
 *
 * Exists because `@takazudo/zfb-md-wasm`'s `renderHtml` discards the fence
 * info string: a fenced block comes back as syntect-themed markup with inline
 * colours and no record of the language it was written with (see
 * `markdown-runtime.ts`'s header for the full spike write-up). Recovering the
 * language therefore has to happen on the source side, and the result is
 * matched positionally against the rendered blocks.
 *
 * Scope is deliberately TOP-LEVEL fences only (CommonMark §4.5: up to three
 * leading spaces, a run of three or more backticks or tildes). Fences nested
 * in a blockquote or list item carry a container prefix this flat scanner does
 * not strip, so they are simply not found — the caller's count guard detects
 * the resulting mismatch and degrades instead of mis-assigning languages.
 */

/** One fenced block that carried a non-empty info string. */
export interface SourceFence {
  /** First whitespace-delimited word of the info string, e.g. `ts` in ```` ```ts title="a" ````. */
  language: string;
  /** Fence body with the opening fence's indentation removed, no trailing newline. */
  code: string;
}

const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;

function isClosingFence(line: string, marker: string, length: number): boolean {
  const match = /^ {0,3}(`+|~+)[ \t]*$/.exec(line);
  if (!match) return false;
  const run = match[1];
  return run.startsWith(marker) && run.length >= length;
}

function stripIndent(line: string, indent: number): string {
  let removed = 0;
  while (removed < indent && line[removed] === " ") removed += 1;
  return line.slice(removed);
}

/**
 * Collect every top-level fenced block whose info string names a language, in
 * document order. Info-less fences are skipped: zfb renders those as a bare
 * `<pre><code>` with no syntect class, so they are not substitution targets.
 */
export function scanInfoStringFences(source: string): SourceFence[] {
  // CommonMark §2.1 counts CRLF and a lone CR as line endings. Splitting on
  // `\n` alone would leave a trailing `\r` that the fence patterns below
  // cannot consume (`.` and `$` both stop at a carriage return), so every
  // fence in a CRLF document would go unseen.
  const lines = source.split(/\r\n|\r|\n/);
  const fences: SourceFence[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const open = FENCE_OPEN.exec(lines[index]);
    if (!open) continue;

    const [, indentText, run, rawInfo] = open;
    const marker = run[0];
    // CommonMark: a backtick fence's info string may not contain a backtick,
    // otherwise the line is ordinary paragraph text with inline code in it.
    if (marker === "`" && rawInfo.includes("`")) continue;

    const indent = indentText.length;
    const body: string[] = [];
    let cursor = index + 1;
    for (; cursor < lines.length; cursor += 1) {
      if (isClosingFence(lines[cursor], marker, run.length)) break;
      body.push(stripIndent(lines[cursor], indent));
    }
    // An unclosed fence runs to the end of the document; either way the scan
    // resumes after the block so a fence body can never open a nested fence.
    index = cursor;

    const language = rawInfo.trim().split(/\s+/)[0] ?? "";
    if (language !== "") {
      fences.push({ language, code: body.join("\n") });
    }
  }

  return fences;
}
