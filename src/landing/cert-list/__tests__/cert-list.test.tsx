import { render, screen } from "@testing-library/preact";
import { describe, expect, it } from "vitest";
import { CertList } from "../cert-list";

describe("CertList", () => {
  it("renders each cert's code badge, name, and scope", () => {
    render(
      <CertList
        heading="Certifications"
        certs={[{ code: "ISO 9001", name: "Quality management system", scope: "Scope text." }]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Certifications" })).toBeInTheDocument();
    expect(screen.getByText("ISO 9001")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quality management system" })).toBeInTheDocument();
    expect(screen.getByText("Scope text.")).toBeInTheDocument();
  });

  it("omits the heading in bare mode", () => {
    render(<CertList heading="Certifications" certs={[{ code: "A", name: "B", scope: "C" }]} bare />);
    expect(screen.queryByRole("heading", { name: "Certifications" })).not.toBeInTheDocument();
  });
});
