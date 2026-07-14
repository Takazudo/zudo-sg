/**
 * Local catalog used by the demo's MDX image override.
 *
 * MDX keeps its source-image strings so the content remains readable, while
 * this resolver keeps the demo self-contained and maps those strings to the
 * seven original local assets. New or unrecognised strings deliberately use
 * the corporate image instead of requesting a remote asset at runtime.
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

const SOURCE_CATEGORY_PREFIXES = [
  ["placeholder-vacuum-", "vacuum"],
  ["placeholder-process-", "process"],
  ["placeholder-laser-", "laser"],
  ["placeholder-meeting-", "meeting"],
  ["placeholder-beauty-", "beauty"],
] as const satisfies readonly (readonly [string, DummyImageCategory])[];

const SOURCE_CATEGORY_MAP = {
  "placeholder-co2-graph.jpg": "sustainability",
  "placeholder-governance.jpg": "sustainability",
  "placeholder-social.jpg": "sustainability",
  "placeholder-sustainability.jpg": "sustainability",
} as const satisfies Readonly<Record<string, DummyImageCategory>>;

function getSourceFilename(source: string | undefined): string {
  if (!source) return "";

  const withoutQuery = source.split(/[?#]/, 1)[0] ?? "";
  return withoutQuery.split("/").at(-1) ?? "";
}

/** Resolve a content image source to its deterministic, local demo asset. */
export function resolveDummyImage(source: string | undefined): DummyImageAsset {
  const filename = getSourceFilename(source);
  const mappedCategory = SOURCE_CATEGORY_MAP[filename as keyof typeof SOURCE_CATEGORY_MAP];

  if (mappedCategory) return DUMMY_IMAGE_MANIFEST[mappedCategory];

  const prefixCategory = SOURCE_CATEGORY_PREFIXES.find(([prefix]) => filename.startsWith(prefix))?.[1];
  return DUMMY_IMAGE_MANIFEST[prefixCategory ?? "corporate"];
}
