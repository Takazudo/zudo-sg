// DOM/document helpers shared by the canvas's TWO inline-editing sessions.
//
// These were private to `renderer.ts` while it held the only session. Epic
// #368 adds a second, parallel one (`prose-inline-session.ts`, #375) whose
// contract is explicit-save rather than auto-commit — but which still has to
// answer the same three questions the same way:
//
//   - "what text did the user actually type?" (`readEditableValue`)
//   - "where does the caret go?"              (`placeCaretAtEnd`)
//   - "what is this field's on-screen value?" (`effectiveFieldValue`)
//
// A second, subtly different copy of any of those would break the #288
// ground-check invariant (which is only sound because entry and the
// ground-check derive the value IDENTICALLY), so they live here, once.
//
// Everything in this module is pure or DOM-only: no Preact, no bridge, no
// session state.

import type { CompositionNode } from "@/composer";
import type { ComposerEntry } from "@/styleguide/data/composer-registry";

/**
 * Marks the element a session has made `contenteditable`. The canvas's
 * capture-phase activation swallow keys off it (an active editing region owns
 * its own keys and clicks), so BOTH sessions set it.
 */
export const INLINE_EDITING_ATTR = "data-zc-inline-editing";

/** Which session a field's inline editing routes through (#372). */
export type InlineEditMode = "plain" | "markdown-source";

/** The editable text region of a node, resolved from its runtime definition. */
export interface InlineEditable {
  field: string;
  multiline: boolean;
  /**
   * `"plain"` (the default) is the auto-commit session in `renderer.ts`
   * (#257 / #288); `"markdown-source"` is the explicit-save prose session
   * (`prose-inline-session.ts`, epic #368). The two never share state.
   */
  mode: InlineEditMode;
  resolveElement: (root: HTMLElement) => HTMLElement | null;
}

/** CSS-escape a value for use inside an attribute selector. */
export function escapeAttrValue(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/(["\\])/g, "\\$1");
}

/** The `{ field, multiline, mode, resolveElement }` for a node, or null if it has none. */
export function inlineEditableForEntry(entry: ComposerEntry | undefined): InlineEditable | null {
  const adapter = entry?.definition.adapters?.inlineEditor;
  if (!adapter) return null;
  const field = entry?.definition.fields?.find((f) => f.prop === adapter.field);
  if (!field || field.kind !== "text" || !field.inlineEdit) return null;
  return {
    field: adapter.field,
    multiline: field.inlineEdit.multiline ?? false,
    mode: field.inlineEdit.mode ?? "plain",
    resolveElement: adapter.resolveElement,
  };
}

/** Depth-first lookup of a node by id within a composition's slot tree. */
export function findNodeById(nodes: readonly CompositionNode[], id: string): CompositionNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    for (const children of Object.values(node.slots)) {
      const found = findNodeById(children ?? [], id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * The on-screen value of an inline-editable field: the component's declared
 * defaults overlaid with the node's own props, coerced to a string. Shared by
 * session ENTRY and the #288 ground-check so both read the field IDENTICALLY —
 * the ground-check compares this against the session's captured `initialValue`,
 * so it is only sound if the two derive the value the same way.
 */
export function effectiveFieldValue(
  node: CompositionNode | null | undefined,
  entry: ComposerEntry | undefined,
  fieldKey: string,
): string {
  const raw = { ...(entry?.definition.defaults ?? {}), ...(node?.props ?? {}) }[fieldKey];
  return typeof raw === "string" ? raw : raw == null ? "" : String(raw);
}

/**
 * Inline-level element tags (issue #288). None of these start a new line on
 * their own — `<strong>Loud</strong> word` reads as one continuous line, not
 * two — so `readEditableValue` must not prepend a `\n` before one of these
 * just because it is an element child. Only a BLOCK-level child (e.g. a
 * browser's own paragraph-splitting `<div>`) implies a line break. Kept
 * intentionally small (the minimum the inline-editable cohort actually
 * produces) rather than an exhaustive HTML inline-element list.
 */
const INLINE_ELEMENT_TAGS: ReadonlySet<string> = new Set(["B", "STRONG", "EM", "I", "SPAN", "A", "CODE"]);

/**
 * Read the committed text out of an editing element.
 *
 * Decoration islands are skipped: a child marked `aria-hidden` /
 * `contenteditable="false"` (e.g. `CtaButton`'s trailing arrow) is chrome, not
 * content, so it never leaks into the committed value. For a multiline field,
 * `<br>` and BLOCK-level boundaries become newlines (an inline child, e.g. a
 * `<strong>` run — see `INLINE_ELEMENT_TAGS` — never does); a single-line
 * field can hold none (its Enter commits instead of inserting one), and any
 * pasted newline is collapsed to a space so the value stays single-line.
 */
export function readEditableValue(el: HTMLElement, multiline: boolean): string {
  let out = "";
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3 /* Text */) {
        out += (child as Text).data;
        continue;
      }
      if (child.nodeType !== 1 /* Element */) continue;
      const elChild = child as HTMLElement;
      if (
        elChild.getAttribute("aria-hidden") === "true" ||
        elChild.getAttribute("contenteditable") === "false"
      ) {
        continue; // decoration island — not editable content
      }
      if (elChild.tagName === "BR") {
        out += "\n";
        continue;
      }
      if (
        multiline &&
        !INLINE_ELEMENT_TAGS.has(elChild.tagName) &&
        out.length > 0 &&
        !out.endsWith("\n")
      ) {
        out += "\n";
      }
      walk(elChild);
    }
  };
  walk(el);
  return multiline ? out : out.replace(/[\r\n]+/g, " ");
}

/**
 * The last editable text node in document order, skipping decoration islands
 * (`aria-hidden` / `contenteditable="false"`, e.g. `CtaButton`'s trailing
 * arrow) with the same exclusion rule as `readEditableValue`. Returns null for
 * a field with no editable text (an empty field, or one holding only
 * decoration).
 */
function lastEditableTextNode(el: HTMLElement): Text | null {
  let found: Text | null = null;
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3 /* Text */) {
        found = child as Text;
        continue;
      }
      if (child.nodeType !== 1 /* Element */) continue;
      const elChild = child as HTMLElement;
      if (
        elChild.getAttribute("aria-hidden") === "true" ||
        elChild.getAttribute("contenteditable") === "false"
      ) {
        continue; // decoration island — never a caret target
      }
      walk(elChild);
    }
  };
  walk(el);
  return found;
}

/**
 * Best-effort caret-to-end. Collapses to the end of the last EDITABLE text node
 * rather than `el`'s raw contents end: when a field ends in a
 * `contenteditable="false"` decoration (e.g. `CtaButton`'s trailing arrow),
 * collapsing to the raw end lands the caret after the non-editable node and the
 * browser bounces it to offset 0, so typed text prepends instead of appends
 * (issue #257 follow-up). Selection APIs missing (or a detached el) never throw.
 */
export function placeCaretAtEnd(el: HTMLElement): void {
  try {
    const view = el.ownerDocument.defaultView;
    const selection = view?.getSelection?.();
    if (!selection) return;
    const range = el.ownerDocument.createRange();
    const textNode = lastEditableTextNode(el);
    if (textNode) {
      range.setStart(textNode, textNode.data.length);
    } else {
      // No editable text (empty field or decoration-only): caret before any
      // trailing decoration, at the start of the editable host.
      range.setStart(el, 0);
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {
    // Best effort only.
  }
}
