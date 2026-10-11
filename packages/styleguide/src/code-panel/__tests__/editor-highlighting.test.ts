// @vitest-environment happy-dom
// Regression for #915: split Lezer NodeProp identities crashed highlighting
// while EditorView still mounted, so label/theme assertions alone passed.
import "../../__tests__/dom-test-setup.js";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { forceParsing } from "@codemirror/language";
import { describe, expect, it, vi } from "vitest";
import { createEditorView } from "../editor-setup.js";

describe("editor syntax highlighting", () => {
  it.each([
    { language: "tsx" as const, editable: false, doc: 'const title: string = "Hello";\nconst element = <h1>{title}</h1>;', token: "const" },
    { language: "css" as const, editable: true, doc: ".example { color: red; padding: 12px; }", token: "color" },
  ])("highlights $language without plugin failures", ({ language, editable, doc, token }) => {
    const errors: unknown[] = [];
    const onChange = vi.fn();
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = createEditorView(doc, parent, {
      language,
      editable,
      onChange,
      extensions: [EditorView.exceptionSink.of((error) => errors.push(error))],
    });
    const highlightedText = () => [...parent.querySelectorAll(".cm-line span[class]")]
      .map((span) => span.textContent).join(" ");

    try {
      expect(forceParsing(view, doc.length)).toBe(true);
      expect.soft(errors.map(String)).toEqual([]);
      expect.soft(highlightedText()).toContain(token);
      expect(view.state.facet(EditorState.readOnly)).toBe(!editable);
      expect(view.contentDOM.getAttribute("contenteditable")).toBe(String(editable));

      if (editable) {
        const next = ".example { color: blue; margin: 24px; }";
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
        expect(forceParsing(view, next.length)).toBe(true);
        expect(onChange).toHaveBeenCalledExactlyOnceWith(next);
        expect.soft(errors.map(String)).toEqual([]);
        expect.soft(highlightedText()).toContain("margin");
      }
    } finally {
      view.destroy();
      parent.remove();
    }
  });
});
