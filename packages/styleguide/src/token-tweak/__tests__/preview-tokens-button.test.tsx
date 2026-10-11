// @vitest-environment happy-dom
import "../../__tests__/dom-test-setup.js";
import { fire, getByRole, renderIsland } from "../../__tests__/helpers/zudo-react.js";
import { expect, it, vi } from "vitest";
import PreviewTokensButton from "../preview-tokens-button.js";

it("hydrates and dispatches one preview toggle per click, then removes its listener", async () => {
  const toggle = vi.fn();
  window.addEventListener("toggle-preview-token-panel", toggle);
  try {
    const island = renderIsland(PreviewTokensButton, {});
    const button = getByRole(island.container, "button", { name: "Preview tokens →" });
    expect(toggle).not.toHaveBeenCalled();
    fire(button, "click");
    await island.flush();
    expect(toggle).toHaveBeenCalledTimes(1);
    island.dispose();
    fire(button, "click");
    expect(toggle).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener("toggle-preview-token-panel", toggle);
  }
});
