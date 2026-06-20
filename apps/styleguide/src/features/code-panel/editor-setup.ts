// CodeMirror EditorView factory — the dynamic-import payload.
//
// SSR-safety: every `@codemirror/*` import lives in THIS module, which is ONLY
// reached via a dynamic `import()` from the (browser-only) code-panel island.
// That keeps the heavy editor subgraph off zfb's neutral SSR esbuild platform —
// the same boundary the preview island uses. Do NOT statically import this
// from any page or SSR module.

import { EditorView, lineNumbers, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { oneDark } from "@codemirror/theme-one-dark";

export interface CreateEditorOptions {
  /** "css" enables the CSS language (live-injection buffer); else TS/JSX. */
  language: "css" | "tsx";
  /** Whether the editor is editable (false = read-only source view). */
  editable: boolean;
  /** Fired on every document change with the full text. */
  onChange?: (value: string) => void;
}

export function createEditorView(
  doc: string,
  parent: HTMLElement,
  opts: CreateEditorOptions,
): EditorView {
  const langExtension =
    opts.language === "css" ? css() : javascript({ jsx: true, typescript: true });

  const extensions = [
    lineNumbers(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    langExtension,
    oneDark,
    EditorView.lineWrapping,
    EditorState.readOnly.of(!opts.editable),
    EditorView.editable.of(opts.editable),
  ];

  if (opts.onChange) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) opts.onChange!(update.state.doc.toString());
      }),
    );
  }

  return new EditorView({
    state: EditorState.create({ doc, extensions }),
    parent,
  });
}
