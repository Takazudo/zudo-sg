import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import type { StoryControl } from "@zudo-sg/ui";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";
import { MSG_READY, MSG_REQUEST_READY, MSG_SET_THEME } from "../messages";
import VariantFrame, {
  DEFAULT_THEME_MODE,
  DEFAULT_VIEWPORT_ID,
  type ThemeMode,
  type ViewportId,
} from "../variant-frame";

function readyFrame(iframe: HTMLIFrameElement): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      source: iframe.contentWindow,
      data: { type: MSG_READY },
    }),
  );
}

function themeMessages(spy: ReturnType<typeof vi.spyOn>): unknown[] {
  return spy.mock.calls
    .map(([message]) => message)
    .filter(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        (message as { type?: unknown }).type === MSG_SET_THEME,
    );
}

/** A stage under toolbar control — theme/viewport always arrive as props. */
function Stage(props: {
  slug?: string;
  exportName?: string;
  name?: string;
  controls?: StoryControl[];
  themeMode?: ThemeMode;
  viewportId?: ViewportId;
}) {
  return (
    <VariantFrame
      slug={props.slug ?? "cta-button"}
      exportName={props.exportName ?? "Playground"}
      name={props.name ?? "CTA button"}
      controls={props.controls}
      themeMode={props.themeMode ?? DEFAULT_THEME_MODE}
      viewportId={props.viewportId ?? DEFAULT_VIEWPORT_ID}
    />
  );
}

describe("VariantFrame", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "dark";
  });

  it("keeps the exact sandbox token set required by form stories", () => {
    render(<Stage slug="contact-form" exportName="Default" name="Contact form" />);

    const iframe = screen.getByTitle("contact-form — Contact form");
    expect(iframe).toHaveAttribute(
      "sandbox",
      "allow-same-origin allow-scripts allow-forms",
    );
  });

  it("carries no global theme or viewport controls of its own", () => {
    render(<Stage />);

    expect(
      screen.queryByRole("group", { name: "Preview theme" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Preview viewport" }),
    ).not.toBeInTheDocument();
  });

  it("renders the toolbar's viewport preset in a focusable non-shrinking scroller", () => {
    const { rerender } = render(<Stage viewportId="full" />);

    const scroller = screen.getByRole("region", {
      name: "Preview viewport canvas",
    });
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller.className).toContain("overflow-x-auto");

    const frameWrapper = screen
      .getByTitle("cta-button — CTA button")
      .parentElement;
    expect(frameWrapper?.className).toContain("shrink-0");

    for (const [viewportId, width] of [
      ["mobile", "320px"],
      ["tablet", "768px"],
      ["desktop", "1280px"],
      ["full", "100%"],
    ] as Array<[ViewportId, string]>) {
      rerender(<Stage viewportId={viewportId} />);
      expect(frameWrapper).toHaveStyle({ width });
    }
  });

  it("waits for this frame's readiness before sending the toolbar's theme", () => {
    render(<Stage name="First" />);

    const iframe = screen.getByTitle("cta-button — First") as HTMLIFrameElement;
    const postMessage = vi
      .spyOn(iframe.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);

    expect(themeMessages(postMessage)).toEqual([]);

    readyFrame(iframe);

    expect(themeMessages(postMessage)).toEqual([
      { type: MSG_SET_THEME, theme: "dark" },
    ]);
  });

  it("adopts a non-default toolbar theme on its FIRST send, not the default", () => {
    // The late-mount contract in miniature: a stage that mounts while the
    // toolbar already sits on a pinned mode must resolve THAT mode when its
    // frame reports ready — never the catalog default it would have inherited
    // from a broadcast it was not around to hear.
    render(<Stage name="Late" themeMode="light" />);

    const iframe = screen.getByTitle("cta-button — Late") as HTMLIFrameElement;
    const postMessage = vi
      .spyOn(iframe.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);

    readyFrame(iframe);

    expect(themeMessages(postMessage)).toEqual([
      { type: MSG_SET_THEME, theme: "light" },
    ]);
  });

  it("probes the frame after installing its listener to recover a missed ready signal", () => {
    const postMessage = vi.fn();
    const frameWindow = { postMessage } as unknown as Window;
    const contentWindow = vi
      .spyOn(HTMLIFrameElement.prototype, "contentWindow", "get")
      .mockReturnValue(frameWindow);

    const { unmount } = render(<Stage name="First" />);

    expect(postMessage).toHaveBeenCalledWith({ type: MSG_REQUEST_READY }, "*");

    // Keep the mocked contentWindow in place through effect cleanup so the
    // registry unregisters the same frame identity it registered.
    unmount();
    contentWindow.mockRestore();
  });

  it("pushes a pinned theme and holds it against catalog changes and SPA swaps", async () => {
    const { rerender } = render(<Stage name="First" themeMode="follow" />);

    const iframe = screen.getByTitle("cta-button — First") as HTMLIFrameElement;
    const postMessage = vi
      .spyOn(iframe.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    readyFrame(iframe);
    expect(themeMessages(postMessage)).toEqual([
      { type: MSG_SET_THEME, theme: "dark" },
    ]);

    rerender(<Stage name="First" themeMode="light" />);
    expect(themeMessages(postMessage).at(-1)).toEqual({
      type: MSG_SET_THEME,
      theme: "light",
    });

    // Pinned: neither a catalog theme flip nor an SPA swap may move it.
    document.documentElement.dataset.theme = "light";
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    expect(themeMessages(postMessage)).toHaveLength(2);

    // Back to Follow: resynchronize immediately to the catalog's current value.
    document.documentElement.dataset.theme = "dark";
    rerender(<Stage name="First" themeMode="follow" />);
    expect(themeMessages(postMessage).at(-1)).toEqual({
      type: MSG_SET_THEME,
      theme: "dark",
    });
  });

  it("follows catalog theme changes and SPA swaps while on Follow", async () => {
    render(<Stage name="First" themeMode="follow" />);

    const iframe = screen.getByTitle("cta-button — First") as HTMLIFrameElement;
    const postMessage = vi
      .spyOn(iframe.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    readyFrame(iframe);

    document.documentElement.dataset.theme = "light";
    await waitFor(() => {
      expect(themeMessages(postMessage).at(-1)).toEqual({
        type: MSG_SET_THEME,
        theme: "light",
      });
    });

    document.documentElement.dataset.theme = "dark";
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await waitFor(() => {
      expect(themeMessages(postMessage).at(-1)).toEqual({
        type: MSG_SET_THEME,
        theme: "dark",
      });
    });
  });

  it("isolates simultaneous frames — one frame's readiness never unlocks another", () => {
    render(
      <>
        <Stage name="First" />
        <Stage exportName="Pair" name="Second" />
      </>,
    );

    const first = screen.getByTitle("cta-button — First") as HTMLIFrameElement;
    const second = screen.getByTitle("cta-button — Second") as HTMLIFrameElement;
    const firstPost = vi
      .spyOn(first.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    const secondPost = vi
      .spyOn(second.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);

    readyFrame(first);
    expect(themeMessages(firstPost)).toEqual([
      { type: MSG_SET_THEME, theme: "dark" },
    ]);
    expect(themeMessages(secondPost)).toEqual([]);
  });

  it("changes theme without resetting live controls or the synced height", () => {
    const controls: StoryControl[] = [
      {
        type: "text",
        prop: "children",
        label: "Label",
        defaultValue: "Browse products",
      },
    ];
    const { rerender } = render(<Stage controls={controls} />);

    const iframe = screen.getByTitle("cta-button — CTA button") as HTMLIFrameElement;
    const input = screen.getByLabelText("Label") as HTMLInputElement;
    readyFrame(iframe);
    window.dispatchEvent(
      new MessageEvent("message", {
        source: iframe.contentWindow,
        data: { type: "sg:height", height: 246.2 },
      }),
    );
    fireEvent.input(input, { target: { value: "Kept value" } });

    rerender(<Stage controls={controls} themeMode="light" />);

    expect(input.value).toBe("Kept value");
    expect(iframe).toHaveStyle({ height: "247px" });
  });
});
