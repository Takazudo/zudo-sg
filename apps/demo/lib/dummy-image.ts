/**
 * Local catalog used by the demo's MDX image override.
 *
 * MDX references these public paths directly. The resolver preserves a
 * deterministic corporate fallback for an unrecognised source rather than
 * introducing a runtime remote-asset dependency.
 */
export const DUMMY_IMAGE_CATEGORIES = [
  "corporate",
  "vacuum",
  "process",
  "laser",
  "meeting",
  "beauty",
  "sustainability",
] as const;

export type DummyImageCategory = (typeof DUMMY_IMAGE_CATEGORIES)[number];

export type DummyImageAsset = {
  readonly src: `/images/dummy/${DummyImageCategory}.webp`;
  readonly width: 1600;
  readonly height: 1000;
};

export const DUMMY_IMAGE_MANIFEST = {
  corporate: { src: "/images/dummy/corporate.webp", width: 1600, height: 1000 },
  vacuum: { src: "/images/dummy/vacuum.webp", width: 1600, height: 1000 },
  process: { src: "/images/dummy/process.webp", width: 1600, height: 1000 },
  laser: { src: "/images/dummy/laser.webp", width: 1600, height: 1000 },
  meeting: { src: "/images/dummy/meeting.webp", width: 1600, height: 1000 },
  beauty: { src: "/images/dummy/beauty.webp", width: 1600, height: 1000 },
  sustainability: { src: "/images/dummy/sustainability.webp", width: 1600, height: 1000 },
} as const satisfies Record<DummyImageCategory, DummyImageAsset>;

const SOURCE_CATEGORY_MAP = {
  "/images/dummy/corporate.webp": "corporate",
  "/images/dummy/vacuum.webp": "vacuum",
  "/images/dummy/process.webp": "process",
  "/images/dummy/laser.webp": "laser",
  "/images/dummy/meeting.webp": "meeting",
  "/images/dummy/beauty.webp": "beauty",
  "/images/dummy/sustainability.webp": "sustainability",
} as const satisfies Readonly<Record<string, DummyImageCategory>>;

function getCanonicalSource(source: string | undefined): string {
  if (!source) return "";
  return source.split(/[?#]/, 1)[0] ?? "";
}

/** Resolve a content image source to its deterministic, local demo asset. */
export function resolveDummyImage(source: string | undefined): DummyImageAsset {
  const canonicalSource = getCanonicalSource(source);
  const category = SOURCE_CATEGORY_MAP[canonicalSource as keyof typeof SOURCE_CATEGORY_MAP] ?? "corporate";
  return DUMMY_IMAGE_MANIFEST[category];
}
