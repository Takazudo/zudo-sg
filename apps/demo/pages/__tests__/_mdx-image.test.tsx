import { disposeAll, renderIsland } from "@zudo-sg/demo-ui/src/test-utils/zudo-react.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { MdxImage } from "../_mdx-image";

afterEach(disposeAll);

describe("MdxImage", () => {
  it("renders a local image with stable intrinsic and responsive presentation", () => {
    const { container } = renderIsland(function ImageFixture() { return (
      <p>
        <MdxImage
          src="/images/dummy/vacuum.webp"
          alt="Unbranded vacuum components on a warm studio surface"
        />
      </p>
    ); }, {});

    const image = container.querySelector("img")!;

    expect(image.getAttribute("alt")).toBe("Unbranded vacuum components on a warm studio surface");
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
    const { container } = renderIsland(function ImageFixture() { return (
      <p>
        <MdxImage src="unrecognised-source.jpg" alt="Abstract corporate workspace" />
      </p>
    ); }, {});

    expect(container.querySelector("img")!.getAttribute("src")).toBe("/images/dummy/corporate.webp");
    expect(container.textContent).toBe("");

    const componentMap = readFileSync(resolve(process.cwd(), "apps/demo/pages/_mdx-components.ts"), "utf8");
    expect(componentMap).toMatch(/img:\s*MdxImage/);
  });
});
