import { render, screen } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../button";

describe("Button", () => {
  it("renders a <button> with type=button by default", () => {
    render(<Button>Save</Button>);
    const el = screen.getByRole("button", { name: "Save" });
    expect(el.tagName).toBe("BUTTON");
    expect(el).toHaveAttribute("type", "button");
  });

  it("renders an <a> when href is provided", () => {
    render(<Button href="/docs">Docs</Button>);
    const el = screen.getByRole("link", { name: "Docs" });
    expect(el.tagName).toBe("A");
    expect(el).toHaveAttribute("href", "/docs");
  });

  it("applies variant + size classes (primary/md by default)", () => {
    render(<Button>Go</Button>);
    const el = screen.getByRole("button", { name: "Go" });
    expect(el.className).toContain("bg-brand");
    expect(el.className).toContain("text-sm");
  });

  it("maps ghost variant to its class set", () => {
    render(<Button variant="ghost">Go</Button>);
    expect(screen.getByRole("button").className).toContain("bg-transparent");
  });

  it("adds w-full when block is set", () => {
    render(<Button block>Wide</Button>);
    expect(screen.getByRole("button").className).toContain("w-full");
  });

  it("forwards onClick and respects disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    const el = screen.getByRole("button", { name: "Nope" });
    expect(el).toBeDisabled();
    el.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("merges a caller-supplied class", () => {
    render(<Button class="custom-x">Go</Button>);
    expect(screen.getByRole("button").className).toContain("custom-x");
  });
});
