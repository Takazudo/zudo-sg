import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { Link } from "../link";

describe("Link", () => {
  it("renders an anchor with href", () => {
    render(<Link href="/docs">Docs</Link>);
    const el = screen.getByRole("link", { name: "Docs" });
    expect(el).toHaveAttribute("href", "/docs");
  });

  it("adds target + rel for external links", () => {
    render(
      <Link href="https://example.com" external>
        Ext
      </Link>,
    );
    const el = screen.getByRole("link");
    expect(el).toHaveAttribute("target", "_blank");
    expect(el).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not add target/rel for internal links", () => {
    render(<Link href="/x">Internal</Link>);
    const el = screen.getByRole("link");
    expect(el).not.toHaveAttribute("target");
    expect(el).not.toHaveAttribute("rel");
  });

  it("lets the caller override rel/target on an external link", () => {
    render(
      <Link href="https://example.com" external rel="nofollow" target="_self">
        Ext
      </Link>,
    );
    const el = screen.getByRole("link");
    expect(el).toHaveAttribute("rel", "nofollow");
    expect(el).toHaveAttribute("target", "_self");
  });

  it("appends a trailing arrow glyph for the standalone variant", () => {
    render(
      <Link href="/start" variant="standalone">
        Start
      </Link>,
    );
    expect(screen.getByRole("link").textContent).toContain("→");
  });
});
