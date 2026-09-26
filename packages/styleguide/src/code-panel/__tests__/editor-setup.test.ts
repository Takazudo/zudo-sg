// @vitest-environment happy-dom
//
// Editor accessible names (#901): `createEditorView`'s optional `label` pushes
// an `EditorView.contentAttributes` extension onto `.cm-content` (the
// `role="textbox"` CodeMirror renders); omitting `label` leaves it unset.
import "../../__tests__/dom-test-setup.js";
import { describe, expect, it } from "vitest";
import { createEditorView } from "../editor-setup.js";

describe("createEditorView label (#901)", () => {
  it("renders .cm-content with the given aria-label", () => {
    const parent = document.createElement("div");
    const view = createEditorView("const a = 1;", parent, {
      language: "tsx",
      editable: false,
      label: "Source code for Card: Default",
    });
    try {
      const content = parent.querySelector(".cm-content");
      expect(content).toHaveAttribute("aria-label", "Source code for Card: Default");
    } finally {
      view.destroy();
    }
  });

  it("leaves .cm-content without an aria-label when none is given", () => {
    const parent = document.createElement("div");
    const view = createEditorView("const a = 1;", parent, {
      language: "tsx",
      editable: false,
    });
    try {
      const content = parent.querySelector(".cm-content");
      expect(content).not.toHaveAttribute("aria-label");
    } finally {
      view.destroy();
    }
  });
});
