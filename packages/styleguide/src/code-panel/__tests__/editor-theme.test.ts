// @vitest-environment happy-dom
//
// Engine editor theme wiring (#910): active-line highlighting only on the
// editable editor, and host `extensions` override the `Prec.low` engine theme.
import "../../__tests__/dom-test-setup.js";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorView, type CreateEditorOptions } from "../editor-setup.js";

const views: EditorView[] = [];

function mount(opts: Partial<CreateEditorOptions> = {}): HTMLElement {
  const parent = document.createElement("div");
  document.body.append(parent);
  views.push(
    createEditorView("const a = 1;\nconst b = 2;", parent, {
      language: "tsx",
      editable: false,
      ...opts,
    }),
  );
  return parent;
}

afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
  document.body.innerHTML = "";
});

describe("active line highlighting", () => {
  it("renders .cm-activeLine and .cm-activeLineGutter when editable", () => {
    const parent = mount({ editable: true });
    expect(parent.querySelector(".cm-activeLine")).not.toBeNull();
    expect(parent.querySelector(".cm-activeLineGutter")).not.toBeNull();
  });

  it("renders neither when read-only", () => {
    const parent = mount({ editable: false });
    expect(parent.querySelector(".cm-activeLine")).toBeNull();
    expect(parent.querySelector(".cm-activeLineGutter")).toBeNull();
  });
});

// Happy DOM does not cascade CodeMirror's style-mod sheet into
// getComputedStyle, so the tests read the mounted <style> the way the browser
// cascades it: rules for the editor's scope classes, in source order — with
// equal specificity (`.ͼN .cm-gutters`), the later rule wins.
function gutterBackgroundRules(parent: HTMLElement): string[] {
  const editor = parent.querySelector<HTMLElement>(".cm-editor")!;
  const css = [...document.querySelectorAll("style")].map((s) => s.textContent ?? "").join("\n");
  const rules: string[] = [];
  for (const match of css.matchAll(/\.(ͼ[0-9a-z]+) \.cm-gutters \{([^}]*)\}/g)) {
    const [, scope, body] = match;
    const bg = body!.match(/background-color:\s*([^;]+)/);
    if (bg && editor.classList.contains(scope!)) rules.push(bg[1]!.trim());
  }
  return rules;
}

describe("engine theme", () => {
  it("styles the gutters with --sg-code-* variables, over the base theme", () => {
    const rules = gutterBackgroundRules(mount());
    expect(rules.at(-1)).toBe("var(--sg-code-gutter-bg)");
  });

  it("lets a host `extensions` theme win on a conflicting property", () => {
    const rules = gutterBackgroundRules(
      mount({
        extensions: [EditorView.theme({ ".cm-gutters": { backgroundColor: "rgb(1, 2, 3)" } })],
      }),
    );
    expect(rules).toContain("var(--sg-code-gutter-bg)");
    expect(rules.at(-1)).toBe("rgb(1, 2, 3)");
  });
});
