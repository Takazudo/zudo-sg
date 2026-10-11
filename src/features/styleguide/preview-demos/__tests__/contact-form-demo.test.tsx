import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { disposeAll, fire, getByRole, renderIsland, renderSsr } from "@zudo-sg/demo-ui/src/test-utils/zudo-react";
import ContactFormDemo from "../contact-form-demo";
import ContactPreviewRoute from "../../../../../pages/preview/contact";

const mock = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  setup: vi.fn(),
}));
vi.mock("msw", () => ({ http: { post: vi.fn() }, HttpResponse: { json: vi.fn() } }));
vi.mock("msw/browser", () => ({ setupWorker: (...args: unknown[]) => {
  mock.setup(...args);
  return { start: mock.start, stop: mock.stop };
} }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.start.mockResolvedValue({ scope: "https://example.test/preview/" });
});
afterEach(() => disposeAll());

describe("root contact preview boundary", () => {
  it("renders the loading fallback with scanner metadata without starting MSW", () => {
    const html = renderSsr(<ContactPreviewRoute />, { components: [ContactFormDemo], build: "root-host-test" });
    expect(html).toContain("Loading demo…");
    expect(html).toContain('data-zfb-island-skip-ssr="ContactFormDemo"');
    expect(html).toContain('data-zfb-build="root-host-test"');
    expect(html).toContain('/_zudo-sg/preview.css');
    expect(mock.setup).not.toHaveBeenCalled();
  });

  it("starts one scoped worker, remounts the form on variant changes, and stops on disposal", async () => {
    const island = renderIsland(ContactFormDemo, {});
    await vi.waitFor(() => expect(mock.start).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(island.container.querySelector('[data-contact-form]')).not.toBeNull());
    await island.flush();
    expect(mock.start).toHaveBeenCalledWith({
      serviceWorker: { url: "/mockServiceWorker.js", options: { scope: "/preview/" } },
      onUnhandledRequest: "bypass",
    });
    const first = island.container.querySelector('[data-contact-form]')!;
    const failure = getByRole(island.container, "button", { name: "5xx-recovery demo" });
    fire(failure, "click");
    await island.flush();
    expect(getByRole(island.container, "button", { name: "5xx-recovery demo" })).toBe(failure);
    expect(failure).toHaveAttribute("aria-pressed", "true");
    expect(first.isConnected).toBe(false);
    const second = island.container.querySelector('[data-contact-form]')!;
    expect(second).not.toBe(first);
    expect(island.container.textContent).toContain("/preview/api/contact-demo/send-fail");
    fire(getByRole(island.container, "button", { name: "Success demo" }), "click");
    await island.flush();
    expect(second.isConnected).toBe(false);
    expect(mock.start).toHaveBeenCalledOnce();
    island.dispose();
    expect(mock.stop).toHaveBeenCalledOnce();
  });

  it("stops a worker whose registration finishes after disposal", async () => {
    let resolveStart!: (registration: { scope: string }) => void;
    mock.start.mockImplementationOnce(() => new Promise((resolve) => { resolveStart = resolve; }));
    const island = renderIsland(ContactFormDemo, {});
    await vi.waitFor(() => expect(mock.start).toHaveBeenCalledOnce());
    island.dispose();
    resolveStart({ scope: "https://example.test/preview/" });
    await vi.waitFor(() => expect(mock.stop).toHaveBeenCalledTimes(2));
    expect(island.container.isConnected).toBe(false);
  });

  it("shows start failures and allows a fresh mount to retry", async () => {
    mock.start.mockRejectedValueOnce(new Error("registration failed"));
    const failed = renderIsland(ContactFormDemo, {});
    await vi.waitFor(() => expect(failed.container.textContent).toContain("registration failed"));
    await failed.flush();
    failed.dispose();
    const retry = renderIsland(ContactFormDemo, {});
    await vi.waitFor(() => expect(retry.container.querySelector('[data-contact-form]')).not.toBeNull());
    await retry.flush();
    expect(mock.start).toHaveBeenCalledTimes(2);
  });

  it("rejects an unexpected service worker scope and stops the worker", async () => {
    mock.start.mockResolvedValueOnce({ scope: "https://example.test/" });
    const island = renderIsland(ContactFormDemo, {});
    await vi.waitFor(() => expect(island.container.textContent).toContain("unexpected scope"));
    await island.flush();
    expect(mock.stop).toHaveBeenCalledOnce();
  });
});
