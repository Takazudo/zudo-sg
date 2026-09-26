// CodeMirror EditorView factory — the dynamic-import payload.
//
// SSR-safety: every `@codemirror/*` import lives in THIS module, which is ONLY
// reached via a dynamic `import()` from the (browser-only) code-panel island.
// That keeps the heavy editor subgraph off zfb's neutral SSR esbuild platform —
// the same boundary the preview island uses. Do NOT statically import this
// from any page or SSR module.

import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
  keymap,
} from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { engineTheme } from "./editor-theme.js";

export interface CreateEditorOptions {
  /** "css" enables the CSS language (live-injection buffer); else TS/JSX. */
  language: "css" | "tsx";
  /** Whether the editor is editable (false = read-only source view). */
  editable: boolean;
  /** Accessible name for the editor's `.cm-content` (role="textbox"). */
  label?: string;
  /** Fired on every document change with the full text. */
  onChange?: (value: string) => void;
  /** Host extensions appended after the engine's; they win over its `Prec.low` theme. */
  extensions?: Extension[];
}

export function createEditorView(
  doc: string,
  parent: HTMLElement,
  opts: CreateEditorOptions,
): EditorView {
  const langExtension =
    opts.language === "css" ? css() : javascript({ jsx: true, typescript: true });

  const extensions: Extension[] = [
    lineNumbers(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    langExtension,
    engineTheme,
    EditorView.lineWrapping,
    EditorState.readOnly.of(!opts.editable),
    EditorView.editable.of(opts.editable),
  ];

  if (opts.editable) {
    extensions.push(highlightActiveLine(), highlightActiveLineGutter());
  }

  if (opts.label) {
    extensions.push(EditorView.contentAttributes.of({ "aria-label": opts.label }));
  }

  if (opts.onChange) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) opts.onChange!(update.state.doc.toString());
      }),
    );
  }

  if (opts.extensions) {
    extensions.push(...opts.extensions);
  }

  return new EditorView({
    state: EditorState.create({ doc, extensions }),
    parent,
  });
}
