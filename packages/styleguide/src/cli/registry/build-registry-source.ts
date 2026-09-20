// Renders the GENERATED:SG_REGISTRY marker block for the host's registry
// output file and (per components root) its optional secondary
// `stories/__tests__/story-modules.ts` contract-test fixture. Pure string
// building — ported from the host's former `scripts/gen-sg-registry.mjs`.

import type { DiscoveredStory } from "./discover-stories.js";

export const BEGIN_MARKER = "GENERATED:SG_REGISTRY_BEGIN";
export const END_MARKER = "GENERATED:SG_REGISTRY_END";

/** A discovered story tagged with the components root it came from. */
export interface RegistryEntry extends DiscoveredStory {
  /** `${importBase}/${relDirStem}.stories.tsx` — the package-scoped import specifier. */
  importSpecifier: string;
  /** `${keyPrefix}/${relDirStem}.stories.tsx` — the `storyModules` map key. */
  mapKey: string;
}

/**
 * Build the generated block for the registry output file: the
 * `StoryModule` import, one `import * as <name>` per story, and the
 * `storyModules` + `storyExportOrder` maps.
 */
export function buildRegistryBlock(entries: RegistryEntry[]): string {
  const lines: string[] = [];
  lines.push(`// ${BEGIN_MARKER} — do not hand-edit; run \`zudo-sg gen-registry\`.`);
  lines.push(`import type { StoryModule } from "@takazudo/zudo-sg/stories";`);
  lines.push(``);
  for (const e of entries) {
    lines.push(`import * as ${e.importName} from "${e.importSpecifier}";`);
  }
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * Path → story module map. Keys are glob-relative (e.g.`);
  lines.push(` * \`./ui/src/button/button.stories.tsx\`). Each module is`);
  lines.push(` * \`{ default: meta, ...named Story exports }\`.`);
  lines.push(` */`);
  lines.push(`export const storyModules: Record<string, StoryModule> = {`);
  for (const e of entries) {
    lines.push(`  "${e.mapKey}": ${e.importName} as unknown as StoryModule,`);
  }
  lines.push(`};`);
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * Per-story named-export declaration order (SOURCE order), keyed by the`);
  lines.push(` * same path as \`storyModules\`. registry.ts sorts each story's variants`);
  lines.push(` * by this so tabs render in authored order (and the default tab is the`);
  lines.push(` * first-authored story) instead of the alphabetical key-enumeration order`);
  lines.push(` * of the \`import * as\` namespace. Captured at codegen time because the`);
  lines.push(` * runtime namespace cannot recover source order (#128 / #174). Superset:`);
  lines.push(` * lists every \`export const\`, so registry.ts uses it only to SORT the`);
  lines.push(` * \`isStory()\`-filtered variants, never to gate membership.`);
  lines.push(` */`);
  lines.push(`export const storyExportOrder: Record<string, string[]> = {`);
  for (const e of entries) {
    const arr = e.exportOrder.map((n) => JSON.stringify(n)).join(", ");
    lines.push(`  "${e.mapKey}": [${arr}],`);
  }
  lines.push(`};`);
  lines.push(`// ${END_MARKER}`);
  return lines.join("\n");
}

/**
 * Build the generated block for a components root's secondary
 * `story-modules.ts` fixture: one `import * as <name>` per story (relative,
 * extensionless) and the exported `STORY_MODULES` map.
 */
export function buildStoryModulesBlock(
  entries: DiscoveredStory[],
  relativeImportPrefix: string,
): string {
  const lines: string[] = [];
  lines.push(`// ${BEGIN_MARKER} — do not hand-edit; run \`zudo-sg gen-registry\`.`);
  for (const e of entries) {
    lines.push(`import * as ${e.importName} from "${relativeImportPrefix}/${e.relDirStem}.stories";`);
  }
  lines.push(``);
  lines.push(`export const STORY_MODULES: Record<string, StoryModule> = {`);
  for (const e of entries) {
    lines.push(`  "${e.relDirStem}.stories.tsx": ${e.importName} as unknown as StoryModule,`);
  }
  lines.push(`};`);
  lines.push(`// ${END_MARKER}`);
  return lines.join("\n");
}

/**
 * Replace the existing BEGIN…END block in `content` with `block`. Throws if
 * the markers are missing (each block must be seeded once by hand).
 */
export function replaceBlock(content: string, block: string, filePath: string): string {
  const beginIdx = content.indexOf(BEGIN_MARKER);
  const endIdx = content.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1) {
    throw new Error(
      `Could not find ${BEGIN_MARKER} … ${END_MARKER} markers in ${filePath}.\n` +
        `Seed the marker block once by hand, then re-run the generator.`,
    );
  }
  const lineStart = content.lastIndexOf("\n", beginIdx) + 1;
  const afterEnd = content.indexOf("\n", endIdx);
  const lineEnd = afterEnd === -1 ? content.length : afterEnd;
  return content.slice(0, lineStart) + block + content.slice(lineEnd);
}
