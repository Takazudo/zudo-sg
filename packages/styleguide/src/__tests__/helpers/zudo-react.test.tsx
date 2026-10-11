// @vitest-environment happy-dom
import "../dom-test-setup.js";
import { describe, expect, it } from "vitest";
import { Island } from "@takazudo/zfb";
import { signal } from "@takazudo/zfb/zudo-react";
import {
  disposeAll,
  fire,
  flushAll,
  getByRole,
  getByText,
  queryAllByRole,
  queryByText,
  renderIsland,
  renderSsr,
} from "./zudo-react.js";

function Counter(_props: Record<string, unknown>) {
  const count = signal(0);
  return (
    <button
      on:click={() => {
        count.value += 1;
      }}
    >
      {count}
    </button>
  );
}

function queryFixture(): HTMLDivElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <button>Save <span>changes</span></button>
    <a href="/guide" aria-label="Guide link">Documentation</a>
    <label for="email">Email address</label><input id="email" type="email">
    <label><input type="checkbox">Subscribe</label>
    <input type="radio" id="choice"><label for="choice">Choice one</label>
    <label for="fruit">Fruit</label><select id="fruit"><option>Apple</option></select>
    <div role="status" aria-labelledby="status-label">Ready</div>
    <span id="status-label">Connection status</span>
  `;
  return root;
}

describe("zudo-react test helpers", () => {
  it("renders SSR markup and full-page Island scanner metadata", () => {
    expect(renderSsr(<p>Ready &gt;</p>)).toBe("<p>Ready &gt;</p>");

    const html = renderSsr(
      <Island when="load">
        <Counter />
      </Island>,
      { components: [Counter], build: "helper-test" },
    );
    expect(html).toContain('data-zfb-island="Counter"');
    expect(html).toContain('data-zfb-build="helper-test"');
  });

  it("hydrates, dispatches a click, flushes, and disposes", async () => {
    const island = renderIsland(Counter, {});
    const button = getByRole(island.container, "button", { name: "0" });

    expect(island.html).toContain("0");
    expect(fire(button, "click")).toBe(true);
    await island.flush();
    expect(getByRole(island.container, "button", { name: "1" })).toBe(button);

    island.dispose();
    expect(island.container.isConnected).toBe(false);
  });

  it("supports mount mode and an explicit island identity", () => {
    const island = renderIsland(Counter, {}, {
      mode: "mount",
      identity: { component: "Counter", build: "test" },
    });

    expect(getByText(island.container, "0")).toBe(getByRole(island.container, "button"));
    island.dispose();
  });

  it("throws on a real hydration mismatch and cleans up the activated test", () => {
    let host: Element | undefined;

    expect(() =>
      renderIsland(Counter, {}, {
        beforeActivate(test) {
          host = test.host;
          test.host.querySelector("button")!.textContent = "changed before hydration";
        },
      }),
    ).toThrow(/ZR_HYDRATION_MISMATCH/);

    expect(host?.isConnected).toBe(false);
  });

  it("allows a negative test to inspect an expected hydration diagnostic", () => {
    const island = renderIsland(Counter, {}, {
      allowDiagnostics: true,
      beforeActivate(test) {
        test.host.querySelector("button")!.textContent = "changed before hydration";
      },
    });

    expect(island.diagnostics.map(({ code }) => code)).toContain("ZR_HYDRATION_MISMATCH");
    island.dispose();
  });

  it("matches supported native roles and author-provided accessible names", () => {
    const root = queryFixture();

    expect(getByRole(root, "button", { name: "Save changes" }).tagName).toBe("BUTTON");
    expect(getByRole(root, "link", { name: "Guide link" }).getAttribute("href")).toBe("/guide");
    expect(getByRole(root, "textbox", { name: "Email address" }).id).toBe("email");
    expect(getByRole(root, "checkbox", { name: "Subscribe" }).tagName).toBe("INPUT");
    expect(getByRole(root, "radio", { name: "Choice one" }).id).toBe("choice");
    expect(getByRole(root, "combobox", { name: "Fruit" }).id).toBe("fruit");
    expect(getByRole(root, "status", { name: "Connection status" }).textContent).toBe("Ready");
    expect(queryAllByRole(root, "button", { name: /save/i })).toHaveLength(1);
    expect(queryAllByRole(root, "status", { name: "Ready" })).toHaveLength(0);

    root.insertAdjacentHTML("beforeend", "<button>Save changes</button>");
    expect(queryAllByRole(root, "button", { name: "Save changes" })).toHaveLength(2);
    expect(() => getByRole(root, "button", { name: "Save changes" })).toThrow(
      /found 2 matching elements/,
    );
  });

  it("uses direct text nodes and reports missing or ambiguous matches", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>Ready</p><p><span>Nested</span></p>";

    expect(getByText(root, "Ready").tagName).toBe("P");
    expect(getByText(root, /^Nested$/).tagName).toBe("SPAN");
    expect(queryByText(root, "missing")).toBeNull();
    expect(() => getByText(root, "missing")).toThrow(/found no matching element/);

    root.insertAdjacentHTML("beforeend", "<p>Ready</p>");
    expect(() => getByText(root, "Ready")).toThrow(/found 2 matching elements/);
    expect(() => queryByText(root, "Ready")).toThrow(/found 2 matches/);
    expect(() => getByRole(root, "button")).toThrow(/found no matching element/);
  });

  it("dispatches mouse, keyboard, input, and generic bubbling events", () => {
    const parent = document.createElement("div");
    const input = document.createElement("input");
    parent.append(input);

    let mouseEvent: Event | undefined;
    let keyboardEvent: Event | undefined;
    let inputEvent: Event | undefined;
    let customEvent: Event | undefined;
    parent.addEventListener("click", (event) => (mouseEvent = event));
    input.addEventListener("keydown", (event) => (keyboardEvent = event));
    input.addEventListener("input", (event) => (inputEvent = event));
    input.addEventListener("custom", (event) => (customEvent = event));

    expect(fire(input, "click")).toBe(true);
    fire(input, "keydown", { key: "Enter" });
    fire(input, "input", { data: "x", inputType: "insertText" });
    fire(input, "custom");

    expect(mouseEvent).toBeInstanceOf(MouseEvent);
    expect(mouseEvent?.bubbles).toBe(true);
    expect(keyboardEvent).toBeInstanceOf(KeyboardEvent);
    expect((keyboardEvent as KeyboardEvent).key).toBe("Enter");
    expect(inputEvent).toBeInstanceOf(InputEvent);
    expect((inputEvent as InputEvent).data).toBe("x");
    expect(customEvent).toBeInstanceOf(Event);
  });

  it("flushes all open islands and disposes every registered test", async () => {
    const first = renderIsland(Counter, {}, { mode: "mount" });
    const second = renderIsland(Counter, {}, { mode: "mount" });
    fire(getByRole(first.container, "button"), "click");
    fire(getByRole(second.container, "button"), "click");

    await flushAll();
    expect(getByText(first.container, "1")).toBeTruthy();
    expect(getByText(second.container, "1")).toBeTruthy();

    disposeAll();
    expect(first.container.isConnected).toBe(false);
    expect(second.container.isConnected).toBe(false);
  });
});
