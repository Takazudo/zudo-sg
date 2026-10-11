"use client";

/**
 * Client-side markdown renderer. The runtime returns DOMPurify-sanitized
 * markup; this island only owns when that markup replaces the raw fallback.
 */
import { computed, getScope, signal, Show } from "@takazudo/zfb/zudo-react";
import { cx } from "../../lib/cx";
import { renderMarkdown, type MarkdownDiagnostic } from "./markdown-runtime";

// Typography for `.zc-prose-md` lives in `./prose-md.css`, wired into the
// shared component stylesheet by `src/styles/components.css`.

export type ProseMdProps = {
  markdown: string;
  class?: string;
};

type RenderState =
  | { status: "pending" }
  | { status: "ready"; html: string }
  | { status: "error"; diagnostics: MarkdownDiagnostic[] };

/** First error diagnostic (falling back to any diagnostic), or a generic message. */
function summarizeError(diagnostics: MarkdownDiagnostic[]): string {
  const primary =
    diagnostics.find((diagnostic) => diagnostic.severity === "error") ?? diagnostics[0];
  return primary?.message ?? "Unable to render this markdown.";
}

/** Client-side markdown renderer. Remount to render a different markdown prop. */
export function ProseMd({ markdown, class: cls }: ProseMdProps) {
  const state = signal<RenderState>({ status: "pending" });
  const scope = getScope();
  const ready = computed(() => state.value.status === "ready");
  const error = computed(() => state.value.status === "error");

  scope.onActivate(() => {
    const controller = new AbortController();
    void renderMarkdown(markdown).then((result) => {
      if (controller.signal.aborted) return;
      state.value =
        result.html === null
          ? { status: "error", diagnostics: result.diagnostics }
          : { status: "ready", html: result.html };
    });
    return () => controller.abort();
  });

  return (
    <Show
      when={ready}
      fallback={() => (
        <Show
          when={error}
          fallback={() => (
            <div class={cx("zc-prose-md", "zc-prose-md--pending", cls)}>
              <pre class="zc-prose-md-raw">{markdown}</pre>
            </div>
          )}
        >
          {() => {
            const current = state.value;
            if (current.status !== "error") return null;
            return (
              <div class={cx("zc-prose-md", "zc-prose-md--error", cls)} role="alert">
                Couldn't render this markdown: {summarizeError(current.diagnostics)}
              </div>
            );
          }}
        </Show>
      )}
    >
      {() => {
        const current = state.value;
        if (current.status !== "ready") return null;
        return (
          <div
            class={cx("zc-prose-md", cls)}
            // `renderMarkdown()` returns the DOMPurify-sanitized allowlisted HTML.
            rawHtml={current.html}
          />
        );
      }}
    </Show>
  );
}
