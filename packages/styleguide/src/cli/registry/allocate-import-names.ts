import type { RegistryEntry } from "./build-registry-source.js";

// Module bindings also reject strict-mode names and TypeScript keywords.
const RESERVED = new Set([
  "arguments", "as", "async", "await", "break", "case", "catch", "class", "const",
  "continue", "debugger", "declare", "default", "delete", "do", "else", "enum",
  "eval", "export", "extends", "false", "finally", "for", "from", "function",
  "get", "if", "implements", "import", "in", "instanceof", "interface", "let",
  "module", "new", "null", "of", "package", "private", "protected", "public",
  "require", "return", "set", "static", "super", "switch", "this", "throw",
  "true", "try", "type", "typeof", "undefined", "var", "void", "while", "with",
  "yield", "storyModules", "storyExportOrder", "StoryModule", "STORY_MODULES",
]);

function validBinding(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name) && !RESERVED.has(name);
}

function identityBinding(mapKey: string): string {
  const parts = mapKey.replace(/\.stories\.tsx$/, "").split(/[^A-Za-z0-9_$]+/).filter(Boolean);
  const name = parts.map((part, index) =>
    index === 0 ? part : part[0]!.toUpperCase() + part.slice(1),
  ).join("");
  return /^[A-Za-z_$]/.test(name) ? name : `_${name || "story"}`;
}

/** Allocate names across the complete emitted import scope, independent of root/input order. */
export function allocateImportNames(entries: RegistryEntry[]): RegistryEntry[] {
  const sorted = [...entries].sort((a, b) => a.mapKey < b.mapKey ? -1 : a.mapKey > b.mapKey ? 1 : 0);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.mapKey === sorted[i - 1]!.mapKey) {
      throw new Error(`gen-registry: duplicate story map key ${JSON.stringify(sorted[i]!.mapKey)}`);
    }
  }

  const counts = new Map<string, number>();
  for (const entry of sorted) counts.set(entry.importName, (counts.get(entry.importName) ?? 0) + 1);

  // Reserve stable legacy bindings before assigning fallbacks, so a fallback
  // cannot take a noncolliding story's existing name.
  const used = new Set<string>();
  for (const entry of sorted) {
    if (counts.get(entry.importName) === 1 && validBinding(entry.importName)) {
      used.add(entry.importName);
    }
  }

  return sorted.map((entry) => {
    if (counts.get(entry.importName) === 1 && validBinding(entry.importName)) return entry;
    const base = identityBinding(entry.mapKey);
    let name = base;
    for (let suffix = 2; !validBinding(name) || used.has(name); suffix++) {
      name = `${base}_${suffix}`;
    }
    used.add(name);
    return { ...entry, importName: name };
  });
}
