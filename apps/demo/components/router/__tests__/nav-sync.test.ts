import { afterEach, expect, it, vi } from "vitest";

// Import only the event constant through a mock: the real side-effect router is
// covered by C2/P1, while this test isolates the persisted chrome integration.
vi.mock("@takazudo/zfb-runtime/client-router", () => ({ TRANSITION_AFTER_SWAP: "zfb:after-swap" }));
afterEach(() => { document.body.innerHTML = ""; document.body.style.overflow = ""; });

it("updates persisted sections after swap and closes/unlocks the mobile drawer", async () => {
  document.body.innerHTML = `
    <details data-nav-item data-current="true" open><div role="group"><a href="/old">Old</a></div></details>
    <details data-nav-item><div role="group"><a href="${location.pathname}">Current</a></div></details>
    <input id="zui-nav-toggle" type="checkbox" checked aria-expanded="true">`;
  document.body.style.overflow = "hidden";
  await import("../nav-sync");
  document.dispatchEvent(new Event("zfb:after-swap"));
  const items = document.querySelectorAll("details");
  expect(items[0].hasAttribute("data-current")).toBe(false);
  expect(items[0].open).toBe(false);
  expect(items[1].getAttribute("data-current")).toBe("true");
  expect(items[1].open).toBe(true);
  const toggle = document.querySelector<HTMLInputElement>("#zui-nav-toggle")!;
  expect(toggle.checked).toBe(false);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(toggle.getAttribute("aria-label")).toBe("Open menu");
  expect(document.body.style.overflow).toBe("");
});
