import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { RecruitBand } from "../recruit-band";

describe("RecruitBand", () => {
  it("renders the heading, lead, and CTA link", () => {
    render(
      <RecruitBand
        heading="Build the future with us"
        lead="A demo lead paragraph."
        href="/recruit"
      />,
    );
    expect(screen.getByRole("heading", { name: "Build the future with us" })).toBeInTheDocument();
    expect(screen.getByText("A demo lead paragraph.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View openings/ })).toHaveAttribute("href", "/recruit");
  });

  it("uses a custom CTA label when provided", () => {
    render(<RecruitBand heading="Join us" href="/recruit" ctaLabel="See open roles" />);
    expect(screen.getByRole("link", { name: /See open roles/ })).toBeInTheDocument();
  });
});
