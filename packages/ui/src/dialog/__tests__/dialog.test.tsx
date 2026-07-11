import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "../dialog";

/** A pending promise plus its resolver, for holding an async submit in-flight. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("Dialog", () => {
  it("renders nothing when closed", () => {
    render(<Dialog open={false} title="Confirm" onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("exposes an accessible name via aria-labelledby wired to the title", () => {
    render(<Dialog open title="Delete project" onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId as string)?.textContent).toBe("Delete project");
    // The computed accessible name resolves through that wiring too.
    expect(screen.getByRole("dialog", { name: "Delete project" })).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Dialog open title="Confirm" onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click by default", () => {
    const onClose = vi.fn();
    render(<Dialog open title="Confirm" onClose={onClose} />);
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on backdrop click when closeOnBackdrop is false", () => {
    const onClose = vi.fn();
    render(<Dialog open title="Confirm" onClose={onClose} closeOnBackdrop={false} />);
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close when the panel (not the backdrop) is clicked", () => {
    const onClose = vi.fn();
    render(<Dialog open title="Confirm" onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes via the header close button and Cancel", () => {
    const onClose = vi.fn();
    render(<Dialog open title="Confirm" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("disables the actions while an async submit is in-flight", async () => {
    const gate = deferred();
    const onSubmit = vi.fn(() => gate.promise);
    render(<Dialog open title="Save" onClose={vi.fn()} onSubmit={onSubmit} submitLabel="Save" />);

    const submit = screen.getByRole("button", { name: "Save" });
    fireEvent.click(submit);

    await waitFor(() => expect(submit).toBeDisabled());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    gate.resolve();
    await waitFor(() => expect(submit).not.toBeDisabled());
  });

  it("keeps the dialog open and shows the error on submit failure, then allows retry", async () => {
    const onClose = vi.fn();
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network unreachable"))
      .mockResolvedValueOnce(undefined);

    render(<Dialog open title="Save" onClose={onClose} onSubmit={onSubmit} submitLabel="Save" />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Failure surfaces the error; the dialog stays open; onClose was not called.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Network unreachable");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // Retry: the button is re-enabled and a second submit is accepted.
    const submit = screen.getByRole("button", { name: "Save" });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  });

  it("moves focus into the dialog on open", async () => {
    render(<Dialog open title="Confirm" onClose={vi.fn()} onSubmit={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("restores focus to the trigger on close", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <div>
        <button type="button">Trigger</button>
        <Dialog open={false} title="Confirm" onClose={onClose} />
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    trigger.focus();
    expect(trigger).toHaveFocus();

    rerender(
      <div>
        <button type="button">Trigger</button>
        <Dialog open title="Confirm" onClose={onClose} />
      </div>,
    );
    await waitFor(() =>
      expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true),
    );

    rerender(
      <div>
        <button type="button">Trigger</button>
        <Dialog open={false} title="Confirm" onClose={onClose} />
      </div>,
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("shows a controlled busy state via the busy prop", () => {
    render(<Dialog open busy title="Save" onClose={vi.fn()} onSubmit={vi.fn()} submitLabel="Save" />);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
  });

  it("shows a controlled error via the error prop", () => {
    render(<Dialog open title="Save" error="Something broke" onClose={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something broke");
  });
});
