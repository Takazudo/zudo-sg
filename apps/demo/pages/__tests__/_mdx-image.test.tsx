import { render, screen } from "@testing-library/preact";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { MdxImage } from "../_mdx-image";

describe("MdxImage", () => {
  it("renders a local image with stable intrinsic and responsive presentation", () => {
    render(
      <p>
        <MdxImage
          src="/images/dummy/vacuum.webp"
          alt="Unbranded vacuum components on a warm studio surface"
        />
      </p>,
    );

    const image = screen.getByRole("img", {
      name: "Unbranded vacuum components on a warm studio surface",
    });

    expect(image.tagName).toBe("IMG");
    expect(image.getAttribute("src")).toBe("/images/dummy/vacuum.webp");
    expect(image.getAttribute("width")).toBe("1600");
    expect(image.getAttribute("height")).toBe("1000");
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.getAttribute("decoding")).toBe("async");
    expect(image.className).toContain("w-full");
    expect(image.className).toContain("h-auto");
    expect(image.className).toContain("border-border");
    expect(image.style.aspectRatio).toBe("16 / 10");
    expect(image.style.objectFit).toBe("cover");
  });

  it("renders no bracketed stand-in text and is registered as the MDX img override", () => {
    const { container } = render(
      <p>
        <MdxImage src="unrecognised-source.jpg" alt="Abstract corporate workspace" />
      </p>,
    );

    expect(screen.getByRole("img").getAttribute("src")).toBe("/images/dummy/corporate.webp");
    expect(container.textContent).toBe("");

    const componentMap = readFileSync(resolve(process.cwd(), "apps/demo/pages/_mdx-components.ts"), "utf8");
    expect(componentMap).toMatch(/img:\s*MdxImage/);
  });
});
