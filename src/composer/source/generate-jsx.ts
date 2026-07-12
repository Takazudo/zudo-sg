// Deterministic Preact JSX generator.
//
// Turns a Composition document + serializable manifest into a single, stable
// Preact JSX module. Determinism guarantees:
//
//  - imports are collected across the whole tree and emitted in a stable
//    (module, export-name) order, with collision-safe local aliases — including
//    identical export names imported from DIFFERENT modules;
//  - scalar props are escaped as JSON. A "simple" string becomes a JSX string
//    attribute (`prop="x"`); a string with newlines/quotes/backslashes/braces/
//    angle-brackets/ampersands becomes a JS-EXPRESSION attribute
//    (`prop={"line1\nline2"}`) because JSX string attributes do not process
//    backslash escapes;
//  - a component's DEFAULT `children` slot renders as element children, while a
//    scalar `children` text field renders as a text-bound child expression;
//  - NAMED slots render as expression props (`left={<A/>}`), Fragment-wrapped
//    (`right={<>…</>}`) when a slot holds more than one child;
//  - `undefined`/`NaN` never appear.
//
// The virtual `document.root` is emitted as a Fragment (`<>…</>`) — never a
// wrapper element and never an import.
//
// Export is REFUSED when any node is opaque/invalid: dropping preserved data
// into a misleading export is worse than returning actionable diagnostics.

import type { CompositionDocument, CompositionNode, JsonObject } from "../model/types";
import type { ComponentManifest, ComponentManifestEntry } from "../model/types";
import type { DocumentDiagnostics } from "../model/validate";
import { diagnoseDocument } from "../model/validate";
import { orderedSlotIds } from "../model/index-model";

// ── Public API ───────────────────────────────────────────────────────────────

export interface ImportPlan {
  componentId: string;
  module: string;
  exportKind: "named" | "default";
  exportName: string;
  /** Collision-safe local identifier used as the JSX tag. */
  localName: string;
}

/** Context handed to an optional per-component source adapter. */
export interface JsxSourceAdapterContext {
  node: CompositionNode;
  /** The collision-safe local tag assigned to this component. */
  tag: string;
  props: JsonObject;
  /** Pre-rendered children source (structural children or text child), or "". */
  childrenSource: string;
}

/** Optional per-component override that returns the full element source string. */
export type JsxSourceAdapter = (ctx: JsxSourceAdapterContext) => string;

export interface GenerateJsxOptions {
  /** Exported component identifier. Defaults to `Composition`. */
  componentName?: string;
  /** Optional per-componentId source overrides. */
  sourceAdapters?: Record<string, JsxSourceAdapter>;
}

export interface JsxGenerationResult {
  /** True when a clean module was generated; false when export was refused. */
  ok: boolean;
  /** True when generation was refused because opaque/invalid nodes remain. */
  blocked: boolean;
  /** The generated module source (empty string when blocked). */
  code: string;
  diagnostics: DocumentDiagnostics;
  /** Resolved imports, in emitted order. */
  imports: ImportPlan[];
  /** Node ids in emission order — equals canonical traversal order. */
  emittedNodeOrder: string[];
}

// ── Escaping ─────────────────────────────────────────────────────────────────

// A string is "simple" (safe as a JSX string attribute) only if it contains no
// backslash, double-quote, angle bracket, brace, ampersand, or whitespace-line
// control. Everything else must go through a JS-expression attribute.
const SIMPLE_STRING = /^[^\\"<>{}&\n\r\t]*$/;

function renderScalarAttr(name: string, value: unknown): string | null {
  if (value === undefined) return null; // never emit undefined
  if (value === null) return `${name}={null}`;
  switch (typeof value) {
    case "string":
      return SIMPLE_STRING.test(value)
        ? `${name}="${value}"`
        : `${name}={${JSON.stringify(value)}}`;
    case "number":
      return Number.isFinite(value) ? `${name}={${value}}` : null; // never emit NaN/Infinity
    case "boolean":
      return `${name}={${value}}`;
    case "object":
      // arrays + plain objects → JSON expression.
      return `${name}={${JSON.stringify(value)}}`;
    default:
      return null;
  }
}

// ── Line helpers ─────────────────────────────────────────────────────────────

function indentLines(lines: string[], spaces: number): string[] {
  const pad = " ".repeat(spaces);
  return lines.map((line) => (line.length ? pad + line : line));
}

// ── Import planning ──────────────────────────────────────────────────────────

function planImports(
  componentIds: string[],
  manifest: ComponentManifest,
  reserved: Set<string>,
): Map<string, ImportPlan> {
  const sorted = [...componentIds].sort((a, b) => {
    const sa = manifest.get(a)!.source;
    const sb = manifest.get(b)!.source;
    return sa.module.localeCompare(sb.module) || sa.exportName.localeCompare(sb.exportName) || a.localeCompare(b);
  });

  const used = new Set(reserved);
  const plan = new Map<string, ImportPlan>();
  for (const componentId of sorted) {
    const src = manifest.get(componentId)!.source;
    let local = src.localName ?? src.exportName;
    if (used.has(local)) {
      let i = 2;
      while (used.has(`${local}_${i}`)) i += 1;
      local = `${local}_${i}`;
    }
    used.add(local);
    plan.set(componentId, {
      componentId,
      module: src.module,
      exportKind: src.exportKind,
      exportName: src.exportName,
      localName: local,
    });
  }
  return plan;
}

function buildImportLines(plans: ImportPlan[]): string[] {
  const byModule = new Map<string, { def?: ImportPlan; named: ImportPlan[] }>();
  for (const plan of plans) {
    const group = byModule.get(plan.module) ?? { named: [] };
    if (plan.exportKind === "default") group.def = plan;
    else group.named.push(plan);
    byModule.set(plan.module, group);
  }

  const lines: string[] = [];
  for (const module of [...byModule.keys()].sort()) {
    const group = byModule.get(module)!;
    const parts: string[] = [];
    if (group.def) parts.push(group.def.localName);
    if (group.named.length) {
      const specs = [...group.named]
        .sort((a, b) => a.exportName.localeCompare(b.exportName))
        .map((n) => (n.exportName === n.localName ? n.exportName : `${n.exportName} as ${n.localName}`));
      parts.push(`{ ${specs.join(", ")} }`);
    }
    lines.push(`import ${parts.join(", ")} from "${module}";`);
  }
  return lines;
}

// ── Element rendering ────────────────────────────────────────────────────────

function toIdentifier(name: string, fallback: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9]/g, " ").trim();
  if (!cleaned) return fallback;
  const pascal = cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return /^[A-Za-z_]/.test(pascal) ? pascal : fallback;
}

/**
 * Generate a deterministic Preact JSX module. See the file header for the full
 * determinism/escaping contract.
 */
export function generateJsx(
  document: CompositionDocument,
  manifest: ComponentManifest,
  options: GenerateJsxOptions = {},
): JsxGenerationResult {
  const diagnostics = diagnoseDocument(document, manifest);
  const componentName = toIdentifier(options.componentName ?? document.name ?? "Composition", "Composition");
  const adapters = options.sourceAdapters ?? {};

  if (!diagnostics.canExport) {
    return { ok: false, blocked: true, code: "", diagnostics, imports: [], emittedNodeOrder: [] };
  }

  const usedComponentIds = new Set<string>();
  const emittedNodeOrder: string[] = [];

  // Two-pass: collect components + emission order while rendering into a tree of
  // lines, then resolve aliases and rewrite tags. To keep it single-pass and
  // deterministic we render with the FINAL tag by planning imports first.
  const collect = (children: CompositionNode[]): void => {
    for (const node of children) {
      usedComponentIds.add(node.componentId);
      const entry = manifest.get(node.componentId)!;
      for (const slotId of orderedSlotIds(node, entry)) collect(node.slots[slotId] ?? []);
    }
  };
  collect(document.root);

  const plan = planImports([...usedComponentIds], manifest, new Set([componentName]));
  const tagOf = (componentId: string): string => plan.get(componentId)!.localName;

  const renderNode = (node: CompositionNode): string[] => {
    emittedNodeOrder.push(node.id);
    const entry = manifest.get(node.componentId)!;
    const tag = tagOf(node.componentId);

    const slotProps = new Set(entry.slots.map((s) => s.prop));
    const hasDefaultChildrenSlot = entry.slots.some((s) => s.prop === "children");
    const childrenTextField = hasDefaultChildrenSlot
      ? undefined
      : entry.fields.find((f) => f.prop === "children" && f.kind === "text");
    const textChildProp = childrenTextField?.prop;

    // Scalar attributes: field-declared props first (in declaration order), then
    // any remaining props (sorted) — excluding slot-backed and text-child props.
    const emittedProps = new Set<string>();
    const scalarAttrs: string[] = [];
    const pushScalar = (prop: string): void => {
      if (emittedProps.has(prop)) return;
      if (prop === textChildProp || slotProps.has(prop)) return;
      if (!(prop in node.props)) return;
      const attr = renderScalarAttr(prop, node.props[prop]);
      if (attr !== null) scalarAttrs.push(attr);
      emittedProps.add(prop);
    };
    for (const field of entry.fields) pushScalar(field.prop);
    for (const prop of Object.keys(node.props).sort()) pushScalar(prop);

    // Slots in canonical order: named slots → expression props; default children
    // slot → structural children body.
    const namedAttrLines: string[][] = [];
    const structuralChildBlocks: string[][] = [];
    for (const slotId of orderedSlotIds(node, entry)) {
      const slot = entry.slots.find((s) => s.id === slotId);
      if (!slot) continue; // canExport guarantees no undeclared slots remain
      const children = node.slots[slotId] ?? [];
      if (slot.prop === "children") {
        for (const child of children) structuralChildBlocks.push(renderNode(child));
      } else {
        if (children.length === 0) continue; // omit empty named slots (no null props)
        namedAttrLines.push(renderNamedSlotAttr(slot.prop, children));
      }
    }

    const textChildValue =
      textChildProp !== undefined && node.props[textChildProp] != null
        ? String(node.props[textChildProp])
        : null;
    const textChildSource = textChildValue !== null ? `{${JSON.stringify(textChildValue)}}` : "";

    // Adapter override: build a children-source string and defer to the adapter.
    const adapter = adapters[node.componentId];
    if (adapter) {
      const childrenSource = structuralChildBlocks.length
        ? structuralChildBlocks.flatMap((b) => b).join("\n")
        : textChildSource;
      return adapter({ node, tag, props: node.props, childrenSource }).split("\n");
    }

    const attrBlocks: string[][] = [...scalarAttrs.map((a) => [a]), ...namedAttrLines];
    const attrsMultiline = attrBlocks.some((a) => a.length > 1);
    const hasStructural = structuralChildBlocks.length > 0;

    if (!attrsMultiline) {
      const attrStr = attrBlocks.length ? " " + attrBlocks.map((a) => a[0]).join(" ") : "";
      if (hasStructural) {
        return [
          `<${tag}${attrStr}>`,
          ...structuralChildBlocks.flatMap((b) => indentLines(b, 2)),
          `</${tag}>`,
        ];
      }
      if (textChildSource) return [`<${tag}${attrStr}>${textChildSource}</${tag}>`];
      return [`<${tag}${attrStr} />`];
    }

    const open = [`<${tag}`, ...attrBlocks.flatMap((a) => indentLines(a, 2))];
    if (hasStructural) {
      return [...open, `>`, ...structuralChildBlocks.flatMap((b) => indentLines(b, 2)), `</${tag}>`];
    }
    if (textChildSource) return [...open, `>${textChildSource}</${tag}>`];
    return [...open, `/>`];
  };

  const renderNamedSlotAttr = (prop: string, children: CompositionNode[]): string[] => {
    if (children.length === 1) {
      const childLines = renderNode(children[0]);
      if (childLines.length === 1) return [`${prop}={${childLines[0]}}`];
      return [`${prop}={`, ...indentLines(childLines, 2), `}`];
    }
    const inner = children.flatMap((c) => renderNode(c));
    return [`${prop}={`, `  <>`, ...indentLines(inner, 4), `  </>`, `}`];
  };

  const rootBlocks = document.root.map((node) => renderNode(node));
  const importLines = buildImportLines([...plan.values()]);

  const body =
    rootBlocks.length === 0
      ? ["    <></>"]
      : ["    <>", ...rootBlocks.flatMap((b) => indentLines(b, 6)), "    </>"];

  const lines = [
    ...(importLines.length ? [...importLines, ""] : []),
    `export function ${componentName}() {`,
    "  return (",
    ...body,
    "  );",
    "}",
    "",
  ];

  return {
    ok: true,
    blocked: false,
    code: lines.join("\n"),
    diagnostics,
    imports: [...plan.values()],
    emittedNodeOrder,
  };
}
