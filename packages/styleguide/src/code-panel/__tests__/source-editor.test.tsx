// @vitest-environment happy-dom
//
// SourceEditor accessible name (#901): the `label` prop must reach the <pre>
// fallback shown before the real CodeMirror editor mounts (see
// source-editor.tsx — the dynamic `import('./editor-setup')` is async, so the
// fallback is what's on screen at render time). The CodeMirror side of
// `label` is covered by `editor-setup.test.ts`.
import "../../__tests__/dom-test-setup.js";
import { render } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import SourceEditor from "../source-editor.js";

describe("SourceEditor fallback label (#901)", () => {
  it("carries the label as aria-label on the <pre> fallback", () => {
    render(
      <SourceEditor
        value="const a = 1;"
        language="tsx"
        label="Source code for Card: Default"
      />,
    );
    const pre = document.querySelector("pre");
    expect(pre).toHaveAttribute("aria-label", "Source code for Card: Default");
  });

  it("has no aria-label on the fallback when no label is given", () => {
    render(<SourceEditor value="const a = 1;" language="tsx" />);
    const pre = document.querySelector("pre");
    expect(pre).not.toHaveAttribute("aria-label");
  });
});
