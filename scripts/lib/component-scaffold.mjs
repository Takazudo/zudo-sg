// scripts/lib/component-scaffold.mjs
//
// Pure helpers for scripts/new-component.mjs — the `pnpm new:component`
// scaffolder. Kept dependency-free and filesystem-free (string in, string/
// throw out) so they're unit-testable without spawning a child process or
// touching packages/ui/src for real (see scripts/__tests__/component-scaffold.test.ts).
//
// The CLI wrapper (scripts/new-component.mjs) does all the fs/process I/O:
// reading packages/ui/src/index.ts, writing the generated files, and running
// scripts/gen-sg-registry.mjs.

import { UI_PACKAGE_NAME } from "./scaffold-config.mjs";

/**
 * Mirrors `StoryCategory` in packages/ui/src/stories/types.ts. This file is a
 * dependency-free .mjs script (no TS import), so the array body is codegen —
 * see scripts/gen-story-categories.mjs, which regex-parses STORY_CATEGORIES
 * out of types.ts and rewrites the marker block below. Run
 * `pnpm gen:story-categories` after changing the category set in types.ts.
 */
export const VALID_CATEGORIES = [
  // GENERATED:STORY_CATEGORIES_BEGIN — do not hand-edit; run pnpm gen:story-categories.
  // Source of truth: packages/ui/src/stories/types.ts (STORY_CATEGORIES).
  "Actions",
  "Typography",
  "Layout",
  "Data Display",
  "Forms",
  "Navigation",
  // GENERATED:STORY_CATEGORIES_END
];

const KEBAB_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Throws with a helpful message unless `name` is kebab-case (e.g. "demo-widget"). */
export function assertValidName(name) {
  if (!name || !KEBAB_NAME_RE.test(name)) {
    throw new Error(
      `"${name}" is not a valid component name — expected kebab-case like "demo-widget" ` +
        `(lowercase letters/digits, hyphen-separated, no leading digit or hyphen).`,
    );
  }
}

/** Throws unless `category` is a member of VALID_CATEGORIES. */
export function assertValidCategory(category) {
  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error(
      `"${category}" is not a valid --category — expected one of: ${VALID_CATEGORIES.join(", ")}.`,
    );
  }
}

/** Throws if `name` already names a directory under packages/ui/src/. */
export function assertUnusedName(name, existingNames) {
  if (existingNames.includes(name)) {
    throw new Error(
      `packages/ui/src/${name}/ already exists — pick a name that isn't in use.`,
    );
  }
}

/** Kebab-case ("demo-widget") → PascalCase ("DemoWidget"). */
export function toPascalCase(kebabName) {
  return kebabName
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

/**
 * `packages/ui/src/<name>/<name>.tsx` — typed-props skeleton following the
 * house pattern: a variant union, a `Record` class map, `class?` passthrough,
 * a JSDoc header on the exported component, and the shared focus-visible
 * outline classes (see button.tsx / link.tsx). Two placeholder variants keep
 * the skeleton typecheck- and lint:tokens-clean out of the box; the TODOs mark
 * what an author fills in.
 */
export function componentTemplate({ pascalName, kebabName }) {
  const lines = [
    `import type { ComponentChildren } from "preact";`,
    `import { cx } from "../lib/cx";`,
    ``,
    `export type ${pascalName}Variant = "primary" | "secondary";`,
    ``,
    `export type ${pascalName}Props = {`,
    `  variant?: ${pascalName}Variant;`,
    `  class?: string;`,
    `  children?: ComponentChildren;`,
    `};`,
    ``,
    `const base =`,
    `  "inline-flex items-center gap-hsp-xs rounded-md outline-none transition-colors " +`,
    `  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";`,
    ``,
    `// TODO: replace with this component's real per-variant classes — these are`,
    `// placeholders so the scaffold typechecks and passes lint:tokens as-is.`,
    `const variants: Record<${pascalName}Variant, string> = {`,
    `  primary: "bg-brand text-on-brand",`,
    `  secondary: "bg-surface text-ink border border-line",`,
    `};`,
    ``,
    `/**`,
    ` * TODO: describe ${pascalName} — what it renders and when to use it.`,
    ` */`,
    `export function ${pascalName}({ variant = "primary", class: cls, children }: ${pascalName}Props) {`,
    `  return <div class={cx(base, variants[variant], cls)}>{children}</div>;`,
    `}`,
  ];
  return lines.join("\n") + "\n";
}

/**
 * `packages/ui/src/<name>/<name>.stories.tsx` — StoryMeta + a Playground
 * variant in the typed `Story<Props>` shape (see STORIES.md §3/§4).
 */
export function storiesTemplate({ pascalName, kebabName, category }) {
  const lines = [
    `import type { StoryMeta, Story } from "../stories/types";`,
    `import { ${pascalName}, type ${pascalName}Props } from "./${kebabName}";`,
    ``,
    `const meta: StoryMeta = {`,
    `  title: "${pascalName}", // TODO: human-friendly display name, if different`,
    `  category: "${category}",`,
    `  description: "TODO: one-sentence description of ${pascalName}.",`,
    `  usage: \`import { ${pascalName} } from "${UI_PACKAGE_NAME}";`,
    ``,
    `<${pascalName}>Content</${pascalName}>\`,`,
    `};`,
    ``,
    `export default meta;`,
    ``,
    `export const Playground: Story<${pascalName}Props> = {`,
    `  name: "Playground",`,
    `  source: \`<${pascalName} variant="primary">Content</${pascalName}>\`,`,
    `  controls: [`,
    `    {`,
    `      type: "select",`,
    `      prop: "variant",`,
    `      label: "Variant",`,
    `      options: ["primary", "secondary"],`,
    `      defaultValue: "primary",`,
    `    },`,
    `    {`,
    `      type: "text",`,
    `      prop: "children",`,
    `      label: "Content",`,
    `      defaultValue: "Content",`,
    `    },`,
    `  ],`,
    `  render: (args = {}) => (`,
    `    <${pascalName} variant={args.variant}>{args.children}</${pascalName}>`,
    `  ),`,
    `};`,
  ];
  return lines.join("\n") + "\n";
}

/**
 * `packages/ui/src/<name>/__tests__/<name>.test.tsx` — a starter suite
 * following the existing `__tests__` pattern (render + class-map assertions).
 */
export function testTemplate({ pascalName, kebabName }) {
  const lines = [
    `import { render, screen } from "@testing-library/preact";`,
    `import { describe, expect, it } from "vitest";`,
    `import { ${pascalName} } from "../${kebabName}";`,
    ``,
    `describe("${pascalName}", () => {`,
    `  it("renders its children", () => {`,
    `    render(<${pascalName}>Content</${pascalName}>);`,
    `    expect(screen.getByText("Content")).toBeInTheDocument();`,
    `  });`,
    ``,
    `  it("defaults to the primary variant", () => {`,
    `    render(<${pascalName}>Content</${pascalName}>);`,
    `    const el = screen.getByText("Content");`,
    `    expect(el.className).toContain("bg-brand");`,
    `  });`,
    ``,
    `  it("applies the secondary variant classes", () => {`,
    `    render(<${pascalName} variant="secondary">Content</${pascalName}>);`,
    `    const el = screen.getByText("Content");`,
    `    expect(el.className).toContain("border-line");`,
    `  });`,
    `});`,
  ];
  return lines.join("\n") + "\n";
}

// A "// ── <label> ──…" section header, same shape used throughout
// packages/ui/src/index.ts.
const HEADER_RE = /^\/\/ ── .+ ──+$/;

function findCategorySection(lines, category) {
  const headerIndexes = [];
  lines.forEach((line, i) => {
    if (HEADER_RE.test(line)) headerIndexes.push(i);
  });
  const needle = category.toLowerCase();
  const startIdx = headerIndexes.find((i) => lines[i].toLowerCase().includes(needle));
  if (startIdx === undefined) {
    throw new Error(
      `insertBarrelExport: no "// ── … ──" section header matching category "${category}" ` +
        `found in index.ts. Every StoryCategory needs a barrel section — add one by hand once.`,
    );
  }
  const nextHeaderIdx = headerIndexes.find((i) => i > startIdx);
  const endIdx = nextHeaderIdx === undefined ? lines.length : nextHeaderIdx;
  return { startIdx, endIdx };
}

// A section body is one or more export blocks (1-2 contiguous `export …`
// lines) separated by a single blank line — see index.ts. Blank lines are
// otherwise ignored (they only delimit blocks).
function parseBlocks(bodyLines) {
  const blocks = [];
  let current = [];
  for (const line of bodyLines) {
    if (line.trim() === "") {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function blockSortKey(block) {
  const match = block[0].match(/^export \{\s*([A-Za-z0-9_]+)/);
  return match ? match[1] : block[0];
}

/**
 * Appends the new component's barrel export into `indexSource` (the text of
 * packages/ui/src/index.ts), inserted alphabetically by component name among
 * the other exports already in that `category`'s "// ── <Category> ──"
 * section. Returns the updated source; throws if no section matches.
 */
export function insertBarrelExport(indexSource, { pascalName, kebabName, category }) {
  const lines = indexSource.split("\n");
  const { startIdx, endIdx } = findCategorySection(lines, category);

  const blocks = parseBlocks(lines.slice(startIdx + 1, endIdx));

  const newBlock = [
    `export { ${pascalName} } from "./${kebabName}/${kebabName}";`,
    `export type { ${pascalName}Props, ${pascalName}Variant } from "./${kebabName}/${kebabName}";`,
  ];

  let insertAt = blocks.findIndex((block) => blockSortKey(block) > pascalName);
  if (insertAt === -1) insertAt = blocks.length;
  blocks.splice(insertAt, 0, newBlock);

  // Blocks join on a single blank line, with a trailing blank line before
  // the next header — matching the header-then-block-with-no-leading-blank
  // shape every existing section already uses.
  const newBodyLines = blocks.map((b) => b.join("\n")).join("\n\n").split("\n");
  newBodyLines.push("");

  return [...lines.slice(0, startIdx + 1), ...newBodyLines, ...lines.slice(endIdx)].join("\n");
}
