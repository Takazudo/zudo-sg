import path from "node:path";

/**
 * Components of an absolute path, from the first real segment through the leaf.
 * `path.parse().root` keeps a Windows drive or UNC prefix. A prefix built only
 * from `path.sep` becomes `\C:` and the walk then stops.
 */
export function absoluteComponents(candidate: string, pathImpl: typeof path = path): string[] {
  const { root } = pathImpl.parse(candidate);
  if (root === "") return [];
  const cursors: string[] = [];
  let cursor = root;
  for (const part of candidate.slice(root.length).split(pathImpl.sep)) {
    if (part === "") continue;
    cursor = pathImpl.join(cursor, part);
    cursors.push(cursor);
  }
  return cursors;
}
