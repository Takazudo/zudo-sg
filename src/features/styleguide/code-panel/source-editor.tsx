"use client";

// CodeMirror-backed source editor. SSR-safe: the heavy `@codemirror/*` graph is
// pulled only by the inner dynamic `import('./editor-setup')`, so this island
// never drags CodeMirror onto zfb's neutral SSR platform. Renders a plain <pre>
// fallback until the editor mounts.

import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { EditorView } from "@codemirror/view";

export interface SourceEditorProps {
  value: string;
  language: "css" | "tsx";
  editable?: boolean;
  onChange?: (value: string) => void;
}

export default function SourceEditor({
  value,
  language,
  editable = false,
  onChange,
}: SourceEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let disposed = false;
    void import("./editor-setup").then(({ createEditorView }) => {
      if (disposed || !containerRef.current) return;
      viewRef.current = createEditorView(value, containerRef.current, {
        language,
        editable,
        onChange: (v) => onChangeRef.current?.(v),
      });
      setLoaded(true);
    });
    return () => {
      disposed = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // Editor is created once; `value`, `language`, and `editable` are read as
    // initial config only. They are intentionally omitted from the deps — the
    // editor owns its buffer thereafter, and re-running this effect would
    // destroy/recreate the CodeMirror view (losing cursor/scroll) on every
    // prop change. Callers that swap to an unrelated `value` (e.g. the code
    // panel's per-variant source view) must pass a `key` that changes with the
    // identity, so Preact remounts this component instead of leaving stale
    // content displayed (#105).
  }, []);

  return (
    <div class="relative text-small">
      {!loaded && (
        <pre class="m-0 overflow-auto rounded-md bg-surface-2 p-hsp-sm text-xs text-muted">
          <code>{value}</code>
        </pre>
      )}
      <div ref={containerRef} class={loaded ? "" : "hidden"} />
    </div>
  );
}
