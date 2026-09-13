// Pure helpers for `zudo-sg new-component` — the `pnpm new:component`
// scaffolder. Kept dependency-free and filesystem-free (string in, string/
// throw out) so they're unit-testable without touching a real components
// root. Ported from the host's former `scripts/lib/component-scaffold.mjs`;
// the values that used to be hardcoded module constants (`VALID_CATEGORIES`,
// `UI_PACKAGE_NAME`) are now explicit parameters sourced from the host's
// `zudo-sg.config.mjs` (`categoryOrder`, `uiPackageName`) by the CLI
// orchestration (new-component.ts).

const KEBAB_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Throws with a helpful message unless `name` is kebab-case (e.g. "demo-widget"). */
export function assertValidName(name: string | undefined): void {
  if (!name || !KEBAB_NAME_RE.test(name)) {
    throw new Error(
      `"${name}" is not a valid component name — expected kebab-case like "demo-widget" ` +
        `(lowercase letters/digits, hyphen-separated, no leading digit or hyphen).`,
    );
  }
}

/**
 * Categories are open (any non-empty string) — see `StoryMeta.category` in
 * `@takazudo/zudo-sg/stories`. This only throws for a malformed value; a
 * category outside `validCategories` (the host's `categoryOrder`) is
 * accepted, with a warning printed so the author notices they're
 * introducing a new one (it sorts in alphabetically after the declared
 * categories).
 */
export function assertValidCategory(category: string | undefined, validCategories: string[]): void {
  if (!category || typeof category !== "string" || category.trim() === "") {
    throw new Error(`"${category}" is not a valid --category — expected a non-empty string.`);
  }
  if (!validCategories.includes(category)) {
    console.warn(
      `new-component: "${category}" is a new category — not one of the host's declared ` +
        `categories (${validCategories.join(", ")}). It will appear in the sidebar after ` +
        `those, alphabetically among any other new categories.`,
    );
  }
}

/**
 * `StoryMeta.category` display name → directory slug for the
 * category-nested layout, e.g. "Data Display" → "data-display".
 */
export function categorySlug(category: string): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}

/** Throws if `name` already names a directory under the components root. */
export function assertUnusedName(name: string, existingNames: string[], componentsRootLabel: string): void {
  if (existingNames.includes(name)) {
    throw new Error(`${componentsRootLabel}/${name}/ already exists — pick a name that isn't in use.`);
  }
}

/** Kebab-case ("demo-widget") → PascalCase ("DemoWidget"). */
export function toPascalCase(kebabName: string): string {
  return kebabName
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

export interface ComponentTemplateArgs {
  pascalName: string;
  kebabName: string;
  nested?: boolean;
}

/**
 * `<componentsRoot>/<name>/<name>.tsx` — typed-props skeleton following the
 * house pattern. `nested` accounts for the extra directory level the
 * category-nested layout inserts (one more `../` to reach `lib/cx`).
 */
export function componentTemplate({ pascalName, nested = false }: ComponentTemplateArgs): string {
  const lines = [
    `import type { ComponentChildren } from "preact";`,
    `import { cx } from "${nested ? "../../lib/cx" : "../lib/cx"}";`,
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
    `  primary: "bg-accent text-on-accent",`,
    `  secondary: "bg-surface text-fg border border-border",`,
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

export interface StoriesTemplateArgs {
  pascalName: string;
  kebabName: string;
  category: string;
  uiPackageName: string;
  nested?: boolean;
}

/**
 * `<componentsRoot>/<name>/<name>.stories.tsx` — StoryMeta + a Playground
 * variant in the typed `Story<Props>` shape.
 */
export function storiesTemplate({
  pascalName,
  kebabName,
  category,
  uiPackageName,
  nested = false,
}: StoriesTemplateArgs): string {
  const lines = [
    `import type { StoryMeta, Story } from "${nested ? "../../stories/types" : "../stories/types"}";`,
    `import { ${pascalName}, type ${pascalName}Props } from "./${kebabName}";`,
    ``,
    `const meta: StoryMeta = {`,
    `  title: "${pascalName}", // TODO: human-friendly display name, if different`,
    `  category: "${category}",`,
    `  description: "TODO: one-sentence description of ${pascalName}.",`,
    `  usage: \`import { ${pascalName} } from "${uiPackageName}";`,
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

export interface TestTemplateArgs {
  pascalName: string;
  kebabName: string;
}

/** `<componentsRoot>/<name>/__tests__/<name>.test.tsx` — a starter suite. */
export function testTemplate({ pascalName, kebabName }: TestTemplateArgs): string {
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
    `    expect(el.className).toContain("bg-accent");`,
    `  });`,
    ``,
    `  it("applies the secondary variant classes", () => {`,
    `    render(<${pascalName} variant="secondary">Content</${pascalName}>);`,
    `    const el = screen.getByText("Content");`,
    `    expect(el.className).toContain("border-border");`,
    `  });`,
    `});`,
  ];
  return lines.join("\n") + "\n";
}

// A "// ── <label> ──…" section header, same shape used throughout a
// components barrel index.
const HEADER_RE = /^\/\/ ── .+ ──+$/;

function getHeaderIndexes(lines: string[]): number[] {
  const headerIndexes: number[] = [];
  lines.forEach((line, i) => {
    if (HEADER_RE.test(line)) headerIndexes.push(i);
  });
  return headerIndexes;
}

function findCategorySection(lines: string[], category: string): { startIdx: number; endIdx: number } {
  const headerIndexes = getHeaderIndexes(lines);
  const needle = category.toLowerCase();
  const startIdx = headerIndexes.find((i) => (lines[i] as string).toLowerCase().includes(needle));
  if (startIdx === undefined) {
    throw new Error(
      `insertBarrelExport: no "// ── … ──" section header matching category "${category}" ` +
        `found in the barrel index. Every category needs a barrel section — add one by hand once.`,
    );
  }
  const nextHeaderIdx = headerIndexes.find((i) => i > startIdx);
  const endIdx = nextHeaderIdx === undefined ? lines.length : nextHeaderIdx;
  return { startIdx, endIdx };
}

// Strips the "// ── " / " ──…" decoration off a section header line, e.g.
// "// ── Data display ─────" → "Data display".
function headerLabel(line: string): string {
  return line.replace(/^\/\/ ── /, "").replace(/ ──+\s*$/, "");
}

// Matches a single-line VALUE export block, e.g.
// `export { Foo } from "./foo/foo";` or
// `export { default as Foo, Bar } from "./foo/foo";`. Deliberately excludes
// `export type { … }` (the `type` keyword breaks the `export\s*\{` match) —
// preventing the value export from colliding also prevents its co-located
// `*Props`/`*Variant` type exports from colliding.
const VALUE_EXPORT_RE = /^export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?\s*$/;

// The BOUND names an `export { … }` brace introduces: `A, default as B` → ["A", "B"].
function parseBoundNames(braceContents: string): string[] {
  return braceContents
    .split(",")
    .map((spec) => spec.trim())
    .filter(Boolean)
    .map((spec) => (spec.includes(" as ") ? (spec.split(" as ").pop() as string).trim() : spec));
}

interface ExistingExport {
  path: string;
  sectionLabel: string;
}

function findExistingPascalExport(lines: string[], pascalName: string): ExistingExport | undefined {
  const headerIndexes = getHeaderIndexes(lines);
  for (let i = 0; i < lines.length; i++) {
    const match = (lines[i] as string).match(VALUE_EXPORT_RE);
    if (!match) continue;
    const names = parseBoundNames(match[1] as string);
    if (!names.includes(pascalName)) continue;
    const headerIdx = [...headerIndexes].reverse().find((h) => h < i);
    return {
      path: match[2] as string,
      sectionLabel: headerIdx !== undefined ? headerLabel(lines[headerIdx] as string) : "(unknown section)",
    };
  }
  return undefined;
}

// A section body is one or more export blocks (1-2 contiguous `export …`
// lines) separated by a single blank line. Blank lines are otherwise
// ignored (they only delimit blocks).
function parseBlocks(bodyLines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
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

function blockSortKey(block: string[]): string {
  // Sort by the block's first BOUND name, not the first raw token: a
  // `export { default as ContactFormEnhancer } from …` block must sort as
  // "ContactFormEnhancer", never "default".
  const match = (block[0] as string).match(VALUE_EXPORT_RE);
  if (!match) return block[0] as string;
  return parseBoundNames(match[1] as string)[0] ?? (block[0] as string);
}

export interface InsertBarrelExportArgs {
  pascalName: string;
  kebabName: string;
  category: string;
  nested?: boolean;
}

/**
 * Appends the new component's barrel export into `indexSource`, inserted
 * alphabetically by component name among the other exports already in that
 * `category`'s "// ── <Category> ──" section. Returns the updated source.
 *
 * Throws if no section matches `category`, or if `pascalName` is already
 * exported anywhere else in the barrel.
 */
export function insertBarrelExport(
  indexSource: string,
  { pascalName, kebabName, category, nested = false }: InsertBarrelExportArgs,
): string {
  const lines = indexSource.split("\n");

  const collision = findExistingPascalExport(lines, pascalName);
  if (collision) {
    throw new Error(
      `insertBarrelExport: "${pascalName}" is already exported from "${collision.path}" in the ` +
        `"${collision.sectionLabel}" section of the barrel index. The barrel can't hold two exports named ` +
        `"${pascalName}" — pass --skip-barrel and add this one to the barrel by hand under an alias ` +
        `(e.g. \`export { ${pascalName} as ${pascalName}FromWhichever } from "...";\`).`,
    );
  }

  const { startIdx, endIdx } = findCategorySection(lines, category);

  const blocks = parseBlocks(lines.slice(startIdx + 1, endIdx));

  const importPath = nested
    ? `./${categorySlug(category)}/${kebabName}/${kebabName}`
    : `./${kebabName}/${kebabName}`;

  const newBlock = [
    `export { ${pascalName} } from "${importPath}";`,
    `export type { ${pascalName}Props, ${pascalName}Variant } from "${importPath}";`,
  ];

  let insertAt = blocks.findIndex((block) => blockSortKey(block) > pascalName);
  if (insertAt === -1) insertAt = blocks.length;
  blocks.splice(insertAt, 0, newBlock);

  // Blocks join on a single blank line, with a trailing blank line before
  // the next header.
  const newBodyLines = blocks.map((b) => b.join("\n")).join("\n\n").split("\n");
  newBodyLines.push("");

  return [...lines.slice(0, startIdx + 1), ...newBodyLines, ...lines.slice(endIdx)].join("\n");
}
