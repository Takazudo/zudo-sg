/** Direct semantic heading queries for tests. The shared zudo-react helper
 * intentionally supports a smaller role set, so heading tests inspect actual
 * heading elements instead of approximating their role.
 */
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

export function getHeading(root: ParentNode, name: string): HTMLElement {
  const matches = queryHeadings(root, name);
  if (matches.length === 0) throw new Error(`getHeading(${JSON.stringify(name)}) found no matching element`);
  if (matches.length > 1) throw new Error(`getHeading(${JSON.stringify(name)}) found ${matches.length} matching elements`);
  return matches[0]!;
}

export function queryHeading(root: ParentNode, name: string): HTMLElement | null {
  const matches = queryHeadings(root, name);
  if (matches.length > 1) throw new Error(`queryHeading(${JSON.stringify(name)}) found ${matches.length} matching elements`);
  return matches[0] ?? null;
}

function queryHeadings(root: ParentNode, name: string): HTMLElement[] {
  const normalizedName = normalize(name);
  return Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).filter(
    (heading) => normalize(heading.textContent ?? "") === normalizedName,
  );
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
