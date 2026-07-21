"use client";

/**
 * ProseMd — renders a `markdown` string client-side via the markdown runtime
 * (`./markdown-runtime`, #371) and opts into the Composer as a
 * `"markdown-source"` inline-editable field (#372, #368).
 *
 * Three-state render:
 *   - pending  — the raw markdown text in a quiet placeholder block. This is
 *     what SSR/SSG output and the styleguide catalog preview show before
 *     hydration, and what a prop change shows again while the new source
 *     re-renders (no stale HTML is ever shown mid-transition).
 *   - ready    — the sanitized HTML from `renderMarkdown()`, mounted via
 *     `dangerouslySetInnerHTML`. The runtime sanitizes as its last step
 *     (DOMPurify, prose allowlist) — this component never re-sanitizes or
 *     assembles HTML itself.
 *   - error    — a compact diagnostics message.
 *
 * Stale-async protection: `renderMarkdown` is a plain promise with no
 * cancellation (see markdown-runtime.ts's header), so a fast-typing prop
 * change or an unmount must not let an older result land after a newer one
 * (or after teardown). A per-effect request token plus an unmount flag guard
 * every `.then()` continuation below.
 *
 * The wrapper only accepts `markdown` + `class` — no `{...rest}` prop spread,
 * unlike the sibling `Prose*` element overrides. That's a deliberate,
 * unrelated choice: `src/composer/model/reserved-keys.ts`'s
 * `RESERVED_PROP_KEYS` gate gets involved elsewhere (persisted-prop
 * prototype-pollution guarding), not here — this component simply has no
 * other prop to forward, and the rendered root's content is fully owned by
 * the sanitized markdown HTML.
 */
import { useEffect, useState } from "preact/hooks";
import { cx } from "../../lib/cx";
import { renderMarkdown, type MarkdownDiagnostic } from "./markdown-runtime";

// Typography for `.zc-prose-md` lives in `./prose-md.css`, wired into the
// single bundled stylesheet via `src/styles/global.css` — NOT imported here.
// @zudo-sg/ui has no build step and no CSS bundling of its own (see
// STORIES.md §1); the consumer's own `@import` graph is what actually ships
// CSS to the page.

export type ProseMdProps = {
  markdown: string;
  class?: string;
};

type RenderState =
  | { status: "pending" }
  | { status: "ready"; html: string }
  | { status: "error"; diagnostics: MarkdownDiagnostic[] };

const PENDING_STATE: RenderState = { status: "pending" };

/** First error diagnostic (falling back to the first of any severity), or a generic message. */
function summarizeError(diagnostics: MarkdownDiagnostic[]): string {
  const primary =
    diagnostics.find((diagnostic) => diagnostic.severity === "error") ?? diagnostics[0];
  return primary?.message ?? "Unable to render this markdown.";
}

/** Client-side markdown renderer. Opts into the Composer via `prose-md.stories.tsx`. */
export function ProseMd({ markdown, class: cls }: ProseMdProps) {
  const [state, setState] = useState<RenderState>(PENDING_STATE);

  useEffect(() => {
    let live = true;
    setState(PENDING_STATE);

    renderMarkdown(markdown).then((result) => {
      // Guards both an unmount (`live`) and a superseded effect run from a
      // later `markdown` change landing first (`live` flips to false on THIS
      // closure the instant the next effect's cleanup runs) — either way a
      // late arrival is dropped rather than overwriting newer content.
      if (!live) return;
      setState(
        result.html === null
          ? { status: "error", diagnostics: result.diagnostics }
          : { status: "ready", html: result.html },
      );
    });

    return () => {
      live = false;
    };
  }, [markdown]);

  if (state.status === "ready") {
    return (
      <div
        class={cx("zc-prose-md", cls)}
        // `state.html` is sanitized by the markdown runtime (DOMPurify, prose
        // allowlist) as its last step — see markdown-runtime.ts's header.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: state.html }}
      />
    );
  }

  if (state.status === "error") {
    return (
      <div class={cx("zc-prose-md", "zc-prose-md--error", cls)} role="alert">
        Couldn't render this markdown: {summarizeError(state.diagnostics)}
      </div>
    );
  }

  return (
    <div class={cx("zc-prose-md", "zc-prose-md--pending", cls)}>
      <pre class="zc-prose-md-raw">{markdown}</pre>
    </div>
  );
}
