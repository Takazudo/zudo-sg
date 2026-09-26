// Engine-owned CodeMirror theme driven by the `--sg-code-*` custom properties
// declared in `styles.css`. Import ONLY from `editor-setup.ts` so it stays
// behind the dynamic-import SSR boundary described there.
//
// Colors are CSS variables rather than literals so the page's color scheme
// (flipped at runtime) carries through `light-dark()` defaults, and a host can
// retheme the editor by overriding the tokens on `:root`. Both extensions are
// `Prec.low` so a host's own `extensions` theme wins on conflicting rules.

import { Prec, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const code = (name: string): string => `var(--sg-code-${name})`;

const selectionBg = { backgroundColor: code("selection-bg") };

const engineEditorTheme = EditorView.theme({
  "&": {
    color: code("fg"),
    backgroundColor: code("bg"),
  },
  ".cm-content": {
    caretColor: code("cursor"),
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: code("cursor"),
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": selectionBg,
  ".cm-selectionBackground": selectionBg,
  ".cm-content ::selection": selectionBg,
  ".cm-gutters": {
    color: code("gutter-fg"),
    backgroundColor: code("gutter-bg"),
    border: "none",
  },
  ".cm-activeLine": {
    backgroundColor: code("active-line-bg"),
  },
  ".cm-activeLineGutter": {
    backgroundColor: code("active-line-bg"),
  },
});

const engineHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: code("keyword") },
  { tag: [t.string, t.special(t.string), t.regexp, t.escape], color: code("string") },
  { tag: [t.number, t.bool, t.null, t.atom, t.unit, t.color], color: code("number") },
  { tag: t.comment, color: code("comment"), fontStyle: "italic" },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName],
    color: code("function"),
  },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: code("property") },
  { tag: [t.typeName, t.className, t.namespace], color: code("type") },
  { tag: t.tagName, color: code("tag") },
  { tag: t.attributeName, color: code("attribute") },
  { tag: t.invalid, color: code("keyword") },
]);

export const engineTheme: Extension = [
  Prec.low(engineEditorTheme),
  Prec.low(syntaxHighlighting(engineHighlightStyle)),
];
