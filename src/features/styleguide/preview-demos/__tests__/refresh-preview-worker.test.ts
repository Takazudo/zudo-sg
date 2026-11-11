import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshPreviewWorker } from "../refresh-preview-worker";

afterEach(() => vi.unstubAllGlobals());

function registration(scope = "/preview/", script = "/mockServiceWorker.js") {
  const active = Object.assign(new EventTarget(), {
    scriptURL: new URL(script, location.origin).href, state: "activated",
  });
  const value = { update: vi.fn(async () => {}), scope: new URL(scope, location.origin).href, active, installing: null as typeof active | null, waiting: null };
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: active as typeof active | null,
    register: vi.fn(async () => value),
  });
  vi.stubGlobal("navigator", { serviceWorker });
  return { value, serviceWorker };
}

describe("preview registration before MSW enable", () => {
  it("awaits activation and controller claim at a non-root base", async () => {
    const { value, serviceWorker } = registration("/nested/preview/", "/nested/mockServiceWorker.js");
    value.installing = Object.assign(new EventTarget(), { scriptURL: value.active.scriptURL, state: "installing" });
    serviceWorker.controller = null;
    const complete = vi.fn();
    const update = refreshPreviewWorker("/nested/mockServiceWorker.js", "/nested/preview/").then(complete);
    await vi.waitFor(() => expect(serviceWorker.register).toHaveBeenCalledOnce());
    expect(serviceWorker.register).toHaveBeenCalledWith(new URL("/nested/mockServiceWorker.js", location.origin).href, {
      scope: new URL("/nested/preview/", location.origin).href, updateViaCache: "none",
    });
    expect(complete).not.toHaveBeenCalled();
    value.installing.state = "activated";
    value.installing.dispatchEvent(new Event("statechange"));
    await Promise.resolve();
    expect(complete).not.toHaveBeenCalled();
    serviceWorker.controller = value.active;
    serviceWorker.dispatchEvent(new Event("controllerchange"));
    await update;
    expect(complete).toHaveBeenCalledOnce();
  });

  it("rejects unexpected scope or script without starting MSW", async () => {
    const { value } = registration("/");
    await expect(refreshPreviewWorker("/mockServiceWorker.js", "/preview/")).rejects.toThrow("scope");
    value.scope = new URL("/preview/", location.origin).href;
    value.active.scriptURL = new URL("/other-worker.js", location.origin).href;
    await expect(refreshPreviewWorker("/mockServiceWorker.js", "/preview/")).rejects.toThrow("Missing preview");
  });

  it("surfaces failed registration and activation, and allows registration to retry", async () => {
    const { value, serviceWorker } = registration();
    serviceWorker.register.mockRejectedValueOnce(new Error("registration failed"));
    await expect(refreshPreviewWorker("/mockServiceWorker.js", "/preview/")).rejects.toThrow("registration failed");
    await refreshPreviewWorker("/mockServiceWorker.js", "/preview/");
    value.installing = Object.assign(new EventTarget(), { scriptURL: value.active.scriptURL, state: "redundant" });
    await expect(refreshPreviewWorker("/mockServiceWorker.js", "/preview/")).rejects.toThrow("became redundant");
  });
});
