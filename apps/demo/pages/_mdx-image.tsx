import type { JSX } from "preact";

import { resolveDummyImage } from "../lib/dummy-image";

export type MdxImageProps = {
  /** Preserved from the MDX source; content owns the descriptive alt text. */
  alt?: string;
  /** Source string from MDX, resolved to one of the local catalog assets. */
  src?: string;
  class?: string;
  [key: string]: unknown;
};

/**
 * Phrasing-content-safe MDX image renderer. An `img` is valid inside the
 * paragraph markup emitted for Markdown images, unlike a block wrapper.
 */
export function MdxImage({ alt, src, class: className, ...rest }: MdxImageProps) {
  const image = resolveDummyImage(src);

  return (
    <img
      {...rest}
      src={image.src}
      alt={alt ?? ""}
      width={image.width}
      height={image.height}
      loading="lazy"
      decoding="async"
      class={["my-vsp-md block h-auto w-full rounded-md border border-border bg-surface", className]
        .filter(Boolean)
        .join(" ")}
      style={{ aspectRatio: "16 / 10", objectFit: "cover" } satisfies JSX.CSSProperties}
    />
  );
}
