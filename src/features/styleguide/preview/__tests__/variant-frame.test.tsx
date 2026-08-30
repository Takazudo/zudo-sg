import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import type { StoryControl } from "@zudo-sg/ui";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AFTER_NAVIGATE_EVENT } from "@takazudo/zudo-doc/transitions";
import { MSG_READY, MSG_REQUEST_READY, MSG_SET_THEME } from "../messages";
import VariantFrame from "../variant-frame";

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

describe("VariantFrame", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "dark";
  });

  it("keeps the exact sandbox token set required by form stories", () => {
    render(
      <VariantFrame
        slug="contact-form"
        exportName="Default"
        name="Contact form"
      />,
    );

    const iframe = screen.getByTitle("contact-form — Contact form");
    expect(iframe).toHaveAttribute(
      "sandbox",
      "allow-same-origin allow-scripts allow-forms",
    );
  });

  it("offers an honest non-shrinking desktop viewport in a focusable scroller", () => {
    render(
      <VariantFrame
        slug="cta-button"
        exportName="Playground"
        name="CTA button"
      />,
    );

    expect(
      Array.from(
        screen
          .getByRole("group", { name: "Preview viewport" })
          .querySelectorAll("button"),
      ).map((button) => button.textContent),
    ).toEqual(["Mobile", "Tablet", "Desktop", "Full"]);

    const scroller = screen.getByRole("region", {
      name: "Preview viewport canvas",
    });
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller.className).toContain("overflow-x-auto");

    const frameWrapper = screen
      .getByTitle("cta-button — CTA button")
      .parentElement;
    expect(frameWrapper?.className).toContain("shrink-0");

    for (const [label, width] of [
      ["Mobile", "320px"],
      ["Tablet", "768px"],
      ["Desktop", "1280px"],
      ["Full", "100%"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(frameWrapper).toHaveStyle({ width });
    }
  });

  it("defaults to Follow catalog and waits for this frame's readiness before sending", () => {
    render(
      <VariantFrame slug="cta-button" exportName="Playground" name="First" />,
    );

    const iframe = screen.getByTitle("cta-button — First") as HTMLIFrameElement;
    const postMessage = vi
      .spyOn(iframe.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    const themeGroup = screen.getByRole("group", { name: "Preview theme" });

    expect(
      themeGroup.getElementsByTagName("button")[0],
    ).toHaveAttribute("aria-pressed", "true");
    expect(themeMessages(postMessage)).toEqual([]);

    readyFrame(iframe);

    expect(themeMessages(postMessage)).toEqual([
      { type: MSG_SET_THEME, theme: "dark" },
    ]);
  });

  it("probes the frame after installing its listener to recover a missed ready signal", () => {
    const postMessage = vi.fn();
    const frameWindow = { postMessage } as unknown as Window;
    const contentWindow = vi
      .spyOn(HTMLIFrameElement.prototype, "contentWindow", "get")
      .mockReturnValue(frameWindow);

    const { unmount } = render(
      <VariantFrame slug="cta-button" exportName="Playground" name="First" />,
    );

    expect(postMessage).toHaveBeenCalledWith(
      { type: MSG_REQUEST_READY },
      "*",
    );

    // Keep the mocked contentWindow in place through effect cleanup so the
    // registry unregisters the same frame identity it registered.
    unmount();
    contentWindow.mockRestore();
  });

  it("isolates simultaneous frames and keeps a pinned frame opposite catalog changes", async () => {
    render(
      <>
        <VariantFrame slug="cta-button" exportName="Playground" name="First" />
        <VariantFrame slug="cta-button" exportName="Pair" name="Second" />
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

    // A ready signal from one contentWindow must not unlock the other frame.
    readyFrame(first);
    expect(themeMessages(firstPost)).toEqual([
      { type: MSG_SET_THEME, theme: "dark" },
    ]);
    expect(themeMessages(secondPost)).toEqual([]);

    readyFrame(second);
    fireEvent.click(
      screen.getAllByRole("group", { name: "Preview theme" })[1].querySelectorAll(
        "button",
      )[1],
    );
    expect(themeMessages(secondPost).at(-1)).toEqual({
      type: MSG_SET_THEME,
      theme: "light",
    });

    document.documentElement.dataset.theme = "light";
    await waitFor(() => {
      expect(themeMessages(firstPost).at(-1)).toEqual({
        type: MSG_SET_THEME,
        theme: "light",
      });
    });
    expect(themeMessages(secondPost)).toHaveLength(2);

    document.documentElement.dataset.theme = "dark";
    document.dispatchEvent(new Event(AFTER_NAVIGATE_EVENT));
    await waitFor(() => {
      expect(themeMessages(firstPost).at(-1)).toEqual({
        type: MSG_SET_THEME,
        theme: "dark",
      });
    });
    expect(themeMessages(secondPost)).toHaveLength(2);
  });

  it("resynchronizes immediately when a pinned frame returns to Follow", () => {
    render(
      <VariantFrame slug="cta-button" exportName="Playground" name="CTA button" />,
    );

    const iframe = screen.getByTitle("cta-button — CTA button") as HTMLIFrameElement;
    const postMessage = vi
      .spyOn(iframe.contentWindow!, "postMessage")
      .mockImplementation(() => undefined);
    const themeGroup = screen.getByRole("group", { name: "Preview theme" });
    const [follow, light] = themeGroup.querySelectorAll("button");
    readyFrame(iframe);

    fireEvent.click(light);
    document.documentElement.dataset.theme = "dark";
    fireEvent.click(follow);

    expect(themeMessages(postMessage).at(-1)).toEqual({
      type: MSG_SET_THEME,
      theme: "dark",
    });
    expect(follow).toHaveAttribute("aria-pressed", "true");
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
    render(
      <VariantFrame
        slug="cta-button"
        exportName="Playground"
        name="CTA button"
        controls={controls}
      />,
    );

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

    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    expect(input.value).toBe("Kept value");
    expect(iframe).toHaveStyle({ height: "247px" });
  });
});
