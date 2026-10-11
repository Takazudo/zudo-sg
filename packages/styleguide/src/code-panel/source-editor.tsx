"use client";

// CodeMirror-backed source editor. SSR-safe: the heavy `@codemirror/*` graph is
// pulled only by the inner dynamic `import('./editor-setup')`, so this island
// never drags CodeMirror onto zfb's neutral SSR platform. Renders a plain <pre>
// fallback until the editor mounts.

import { computed, getScope, signal, Show } from "@takazudo/zfb/zudo-react";
import type { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

export interface SourceEditorProps {
  value: string;
  language: "css" | "tsx";
  editable?: boolean;
  /** Accessible name for the editor (and its <pre> fallback before it mounts). */
  label?: string;
  onChange?: (value: string) => void;
  /**
   * Extra CodeMirror extensions (e.g. a host theme), applied after — and so
   * overriding — the engine's own. For direct `SourceEditor` use only: they are
   * not serializable across the `CodePanel` island boundary, so `CodePanel`
   * does not accept them. Initial configuration only, like `value` — change
   * them by remounting with a new `key`.
   */
  extensions?: Extension[];
}

export default function SourceEditor({
  value,
  language,
  editable = false,
  label,
  onChange,
  extensions,
}: SourceEditorProps) {
  const containerRef = { current: null as HTMLDivElement | null };
  let view: EditorView | null = null;
  const loaded = signal(false);
  const scope = getScope();

  scope.onActivate(() => {
    let disposed = false;
    void import("./editor-setup.js").then(({ createEditorView }) => {
      if (disposed || !containerRef.current) return;
      view = createEditorView(value, containerRef.current, {
        language,
        editable,
        label,
        onChange: (v) => onChange?.(v),
        extensions,
      });
      loaded.value = true;
    });
    return () => {
      disposed = true;
      view?.destroy();
      view = null;
    };
  });

  return (
    <div class="relative text-small">
      <Show when={computed(() => !loaded.value)}>{() => (
        <pre
          class="m-0 overflow-auto rounded-md bg-sg-surface-2 p-hsp-sm text-xs text-sg-muted"
          aria-label={label}
        >
          <code>{value}</code>
        </pre>
      )}</Show>
      <div ref={containerRef} class={computed(() => loaded.value ? "" : "hidden")} />
    </div>
  );
}
