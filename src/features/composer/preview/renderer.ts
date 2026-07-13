// The Composer preview RENDERER: a `CompositionDocument` (pure JSON, received
// over the bridge) → real, production Preact components.
//
// Written with `h()` rather than JSX on purpose: the vitest config collects
// `src/**/__tests__/**/*.test.ts` and its esbuild pass runs under the root
// `tsconfig.json` (`jsx: "preserve"`), so a `.tsx` module under `src/` cannot be
// imported from a unit test. Keeping the renderer JSX-free makes the DOM
// identity, slot-projection, and edit/preview behaviour directly testable
// without touching the shared vitest config (owned by the parallel #247).
//
// ── Trust boundary ───────────────────────────────────────────────────────────
// The document that arrives over the bridge is DATA. The component FUNCTIONS
// come from the trusted registry (#244), which this module imports itself
// inside the iframe. A `componentId` is only ever used as a Map key — never as
// a module specifier, never evaluated.
//
// ── DOM identity (hard acceptance criterion) ─────────────────────────────────
// Toggling hover or selection must NEVER remount a component's DOM node. Two
// mechanisms guarantee that:
//
//   1. HOVER IS PURE CSS. There is no hover state in Preact at all — the chrome
//      is revealed by `.zc-node:hover > .zc-chrome`. A hover cannot trigger a
//      re-render, so it cannot trigger a diff.
//   2. EVERY CHILD OF `.zc-node` IS KEYED. The selection/label chrome is keyed
//      `zc-chrome` and the component body is wrapped in a Fragment keyed
//      `zc-body`. Preact's UNKEYED children diff matches by position and falls
//      back to type, and can cross-match a chrome `<span>` against a
//      component's own `<span>` — destroying and recreating the component's DOM
//      node (a verified failure mode in the #242 prototype). Keyed children
//      match by key, so adding/removing the chrome (Edit ⇄ Preview) touches only
//      the chrome.
//
// Selection itself is a bare attribute swap (`data-zc-selected`) styled with
// `outline`, which is out-of-flow: it neither remounts nor reflows the node.

import { Component, Fragment, h } from "preact";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentChildren, JSX } from "preact";
import type {
  ComponentManifest,
  CompositionDocument,
  CompositionNode,
  InsertionTarget,
  JsonObject,
  NodeDiagnostic,
} from "@/composer";
import { VIRTUAL_ROOT_SLOT_ID, classifyNode, createManifest } from "@/composer";
import type { ComposerEntry } from "@/styleguide/data/composer-registry";
import { toManifestEntry } from "@/styleguide/data/composer-registry";
import { RESERVED_PROP_KEYS, serializeRect, type PreviewSession, type SerializedRect } from "./protocol";
import { slotFlow, type SlotFlow } from "./slot-flow";

// ── Menu focus tokens (issue #256) ──────────────────────────────────────────
//
// The attribute a menu trigger control carries so a later `restore-focus`
// message (see `preview-app.ts`) can find and refocus the EXACT control that
// requested the menu, even though the document may have re-rendered in the
// meantime. Deterministic (not random) — a re-render that recreates the same
// logical affordance recreates the same token, so a plain close (Escape /
// outside-click / scroll / resize dismiss, no document mutation) always finds
// a live match. A mutation that removes the affordance (e.g. Delete) simply
// leaves no match — `focusByToken` is a silent no-op then, never a throw.
const FOCUS_TOKEN_ATTR = "data-zc-focus-token";

export function nodeMenuFocusToken(nodeId: string): string {
  return `node-menu:${nodeId}`;
}

export function insertMenuFocusToken(target: InsertionTarget): string {
  return `insert-menu:${target.parentId ?? ""}:${target.slotId}:${target.index}`;
}

/** Focus the control a `restore-focus` message's token points at, if it still exists. */
export function focusByToken(token: string): void {
  document.querySelector<HTMLElement>(`[${FOCUS_TOKEN_ATTR}="${escapeAttrValue(token)}"]`)?.focus();
}

function escapeAttrValue(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/(["\\])/g, "\\$1");
}

// ── Inline text editing (issue #257) ────────────────────────────────────────
//
// A flag alone can't target the right text node: real components render
// decorations (`CtaButton` an arrow, `SectionHeading` an eyebrow/heading/intro).
// So the trusted, non-serializable `adapters.inlineEditor` (kept only in the
// runtime registry — #244/#246) resolves the editable element inside a rendered
// component. MVP: at most ONE inline-editable field per component.
//
// The three verified prototype rules the session code below follows exactly:
//   - the editing element carries NO vdom text child (its content is set
//     imperatively via ref) so an unrelated re-render can never reset the caret;
//   - its body is KEYED differently in edit vs read mode, so exiting the session
//     remounts it and cannot leave a duplicate (imperatively-inserted) text node;
//   - `dblclick` inside an active session STOPS propagation (word-select must not
//     bubble to the canvas and restart the session, reverting the typing).

/** The editable text region of a node, resolved from its runtime definition. */
interface InlineEditable {
  field: string;
  multiline: boolean;
  resolveElement: (root: HTMLElement) => HTMLElement | null;
}

/** An active on-canvas editing session — LOCAL renderer state, never persisted. */
interface InlineSessionState {
  nodeId: string;
  fieldKey: string;
  multiline: boolean;
  /** The value the field held when the session opened. Set imperatively. */
  initialValue: string;
  /**
   * The document revision on screen when the session was ENTERED (issue #288).
   * Carried on the session and stamped on the eventual commit INSTEAD OF the
   * revision on screen at commit time — a mid-edit render that bumps the
   * revision must make a later commit fail the host's staleness gate, not
   * re-stamp itself as fresh just because it happened to be sent after that
   * render landed.
   */
  startRevision: number;
}

const INLINE_EDITING_ATTR = "data-zc-inline-editing";

/** The `{ field, multiline, resolveElement }` for a node, or null if it has none. */
function inlineEditableForEntry(entry: ComposerEntry | undefined): InlineEditable | null {
  const adapter = entry?.definition.adapters?.inlineEditor;
  if (!adapter) return null;
  const field = entry?.definition.fields?.find((f) => f.prop === adapter.field);
  if (!field || field.kind !== "text" || !field.inlineEdit) return null;
  return {
    field: adapter.field,
    multiline: field.inlineEdit.multiline ?? false,
    resolveElement: adapter.resolveElement,
  };
}

/** Depth-first lookup of a node by id within a composition's slot tree. */
function findNodeById(nodes: readonly CompositionNode[], id: string): CompositionNode | null {
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
function readEditableValue(el: HTMLElement, multiline: boolean): string {
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
function placeCaretAtEnd(el: HTMLElement): void {
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

/**
 * One manifest per registry array, built once. `toManifestEntry` runs a zod
 * validation per entry, and the whole cohort would otherwise be re-validated on
 * every mount — which #254's ephemeral chooser preview pays repeatedly.
 */
const manifestCache = new WeakMap<readonly ComposerEntry[], ComponentManifest>();

function manifestFor(entries: readonly ComposerEntry[]): ComponentManifest {
  const cached = manifestCache.get(entries);
  if (cached) return cached;
  // #245's diagnostics run against the NORMALIZED manifest projection, not the
  // raw definitions: `defineComposer` is an identity cast, so a leaf that
  // declares no slots/fields/defaults leaves those properties `undefined` on the
  // definition, while `toManifestEntry` fills them in. Feeding the raw
  // definitions to `classifyNode` would throw on every leaf component.
  const manifest = createManifest(entries.map(toManifestEntry));
  manifestCache.set(entries, manifest);
  return manifest;
}

/**
 * Drop any prop the protocol reserves before it can reach a real component.
 *
 * The bridge already REFUSES a document carrying one of these
 * (`compositionNodeSchema`), so this is defence in depth for the paths that do
 * not cross the bridge — a host that renders a locally-built document, a future
 * caller, a test. `dangerouslySetInnerHTML` is the one that matters: several
 * cohort components spread their rest props onto a DOM element.
 */
function safeProps(props: JsonObject): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(props)) {
    if (RESERVED_PROP_KEYS.has(name)) continue;
    out[name] = value;
  }
  return out;
}

export interface CompositionCanvasProps {
  document: CompositionDocument;
  /** The TRUSTED runtime registry — retains real component functions. */
  entries: readonly ComposerEntry[];
  session: PreviewSession;
  /**
   * The document revision on screen (issue #288). An inline-edit session
   * captures this at the moment it is ENTERED and carries it forward as its
   * `startRevision`, stamping it on the eventual commit instead of whatever
   * revision happens to be on screen when the user finishes typing — see
   * `onCommitInlineEdit`. Optional (default `0`) so mounts/tests that never
   * inline-edit need not supply it.
   */
  revision?: number;
  /** A node (or the empty canvas, `null`) was activated in Edit mode. */
  onSelect: (nodeId: string | null) => void;
  /** An insert point was activated. Carries #245's insert-at-index target. */
  onRequestAdd: (target: InsertionTarget) => void;
  /** The SELECTED node's chrome "⋯" was activated (issue #256). */
  onRequestNodeMenu: (nodeId: string, rect: SerializedRect, focusToken: string) => void;
  /** An insert point's "⋯" was activated (issue #256). */
  onRequestInsertMenu: (target: InsertionTarget, rect: SerializedRect, focusToken: string) => void;
  /**
   * An inline-editing session committed a value (issue #257). `documentRevision`
   * is the SESSION-START revision (issue #288) — the `revision` prop's value
   * when the session was entered, not the revision on screen at commit time —
   * so a commit authored during a session a mid-edit render has since
   * superseded correctly fails the host's `documentRevision <
   * lastDocRevisionRef.current` staleness gate instead of silently re-stamping
   * itself as fresh. The host still validates it; the renderer only reports the
   * raw `{ nodeId, fieldKey, value, documentRevision }`. Optional so existing
   * mounts/tests that never inline-edit need not supply it.
   */
  onCommitInlineEdit?: (nodeId: string, fieldKey: string, value: string, documentRevision: number) => void;
  /**
   * A cross-slot drag & drop completed on the canvas (issue #258). `copy` is
   * true when Alt was held at drop. The renderer reports the raw
   * `{ sourceNodeId, target, copy }`; the host stamps the revision, revalidates
   * ATOMICALLY (slot/cardinality/cycle/root/opaque-policy), and applies through
   * the controller — the highlight the renderer draws is advisory only. Optional
   * so mounts/tests that never drag need not supply it (and no grip renders
   * without it).
   */
  onDropNode?: (sourceNodeId: string, target: InsertionTarget, copy: boolean) => void;
  /** A node's component threw and was isolated behind its error boundary. */
  onNodeError?: (nodeId: string, message: string) => void;
}

/**
 * Renders a whole Composition. Every node gets a stable wrapper carrying its id;
 * in Edit mode it also gets out-of-flow chrome and an insert point at EVERY
 * addable index of EVERY declared slot.
 */
export function CompositionCanvas(props: CompositionCanvasProps): JSX.Element {
  const {
    document,
    entries,
    session,
    revision = 0,
    onSelect,
    onRequestAdd,
    onRequestNodeMenu,
    onRequestInsertMenu,
    onCommitInlineEdit,
    onDropNode,
    onNodeError,
  } = props;
  const edit = session.mode === "edit";

  const entryById = useMemo(
    () => new Map(entries.map((entry) => [entry.componentId, entry])),
    [entries],
  );
  const manifest = manifestFor(entries);

  // ── Inline editing session (issue #257) ───────────────────────────────────
  // LOCAL renderer state; never travels over the bridge and never mutates the
  // document until a commit routes through the host's `updateProps`.
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const editableRef = useRef<HTMLElement | null>(null);
  const finishingRef = useRef(false);
  const commitCbRef = useRef(onCommitInlineEdit);
  commitCbRef.current = onCommitInlineEdit;

  const [inlineSession, setInlineSessionState] = useState<InlineSessionState | null>(null);
  // Mirror in a ref so the imperative event listeners (attached to a real
  // component DOM node, outside Preact) always see the live session.
  const sessionRef = useRef<InlineSessionState | null>(null);
  const setSession = useCallback((next: InlineSessionState | null) => {
    sessionRef.current = next;
    setInlineSessionState(next);
  }, []);

  const commitInline = useCallback(() => {
    const active = sessionRef.current;
    if (!active || finishingRef.current) return;
    finishingRef.current = true;
    const el = editableRef.current;
    const value = el ? readEditableValue(el, active.multiline) : active.initialValue;
    // A NO-OP commit (value unchanged from session start) must not reach the
    // host: it mutates nothing, yet still advances the document revision. That
    // is not merely wasteful — a spurious commit-of-the-seed (a blur fired the
    // instant the session opened, before any typing, which then re-enters a
    // fresh session) would bump `lastDocRevisionRef` and make the user's real
    // follow-up commit fail the host's SESSION-START staleness gate (issue
    // #288), silently dropping the edit. Skipping unchanged values keeps the
    // session-start revision contract sound across a re-entered session.
    if (value !== active.initialValue) {
      // Stamped with the SESSION-START revision (issue #288) — see `InlineSessionState`.
      commitCbRef.current?.(active.nodeId, active.fieldKey, value, active.startRevision);
    }
    setSession(null);
  }, [setSession]);

  const cancelInline = useCallback(() => {
    if (!sessionRef.current || finishingRef.current) return;
    finishingRef.current = true;
    setSession(null);
  }, [setSession]);

  const enterInlineSession = useCallback(
    (nodeId: string): boolean => {
      if (sessionRef.current) return false;
      const targetNode = findNodeById(document.root, nodeId);
      if (!targetNode) return false;
      const entry = entryById.get(targetNode.componentId);
      const editable = inlineEditableForEntry(entry);
      if (!editable || !entry) return false;
      const effective: Record<string, unknown> = {
        ...(entry.definition.defaults ?? {}),
        ...targetNode.props,
      };
      const raw = effective[editable.field];
      const initialValue = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
      setSession({
        nodeId,
        fieldKey: editable.field,
        multiline: editable.multiline,
        initialValue,
        startRevision: revision,
      });
      return true;
    },
    [document, entryById, revision, setSession],
  );

  // Set up (and tear down) the imperative contentEditable when a session opens.
  // A layout effect runs after the keyed-body remount has committed the fresh
  // (empty-field) component DOM but before paint, so the caret is placed with
  // no flicker. Content is set imperatively here — never via a vdom child.
  useLayoutEffect(() => {
    const active = sessionRef.current;
    if (!active) return;
    finishingRef.current = false;

    const wrapper = canvasRef.current?.querySelector<HTMLElement>(
      `[data-zc-node-id="${escapeAttrValue(active.nodeId)}"]`,
    );
    const componentRoot = wrapper
      ? (Array.from(wrapper.children).find((c) => !c.classList.contains("zc-chrome")) as
          | HTMLElement
          | undefined)
      : undefined;
    const resolve = inlineEditableForEntry(
      entryById.get(findNodeById(document.root, active.nodeId)?.componentId ?? ""),
    )?.resolveElement;
    const el = componentRoot && resolve ? resolve(componentRoot) : null;
    if (!el) {
      // The adapter could not resolve a text region — abandon rather than trap
      // the user in a broken editor.
      setSession(null);
      return;
    }
    editableRef.current = el;

    const ownerDoc = el.ownerDocument;
    el.setAttribute(INLINE_EDITING_ATTR, "");
    el.setAttribute("contenteditable", active.multiline ? "true" : "plaintext-only");
    // Protect decoration islands (e.g. CtaButton's aria-hidden arrow) so a caret
    // can't wander into them and so `readEditableValue` can exclude them.
    el.querySelectorAll<HTMLElement>('[aria-hidden="true"]').forEach((d) =>
      d.setAttribute("contenteditable", "false"),
    );
    // Content set IMPERATIVELY, and BEFORE any decoration so the label sits ahead
    // of a trailing arrow. The component rendered this field with no vdom child,
    // so Preact never manages (or resets) this text node.
    el.insertBefore(ownerDoc.createTextNode(active.initialValue), el.firstChild);
    el.focus();
    placeCaretAtEnd(el);

    let composing = false;
    const onCompositionStart = (): void => {
      composing = true;
    };
    const onCompositionEnd = (): void => {
      composing = false;
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelInline();
        return;
      }
      if (event.key === "Enter" && !active.multiline) {
        // IME-SAFE: a composition's confirming Enter (isComposing / keyCode 229)
        // commits the CANDIDATE, never the field — so Japanese input is never
        // truncated. Only a non-composing Enter commits the single-line field.
        if (composing || event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        commitInline();
      }
    };
    const onBlur = (): void => {
      commitInline();
    };
    // Word-select inside an active session must NOT bubble to the canvas, or it
    // would restart the session and revert the typing (verified failure mode).
    const onDblClick = (event: MouseEvent): void => {
      event.stopPropagation();
    };

    el.addEventListener("compositionstart", onCompositionStart);
    el.addEventListener("compositionend", onCompositionEnd);
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("blur", onBlur);
    el.addEventListener("dblclick", onDblClick);

    return () => {
      el.removeEventListener("compositionstart", onCompositionStart);
      el.removeEventListener("compositionend", onCompositionEnd);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("dblclick", onDblClick);
      el.removeAttribute("contenteditable");
      el.removeAttribute(INLINE_EDITING_ATTR);
      if (editableRef.current === el) editableRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the session identity
  }, [inlineSession?.nodeId, inlineSession?.fieldKey]);

  // Switching to Preview mid-edit COMMITS the draft (defined, tested behavior).
  // The keyed body is not remounted by a mere mode change, so the live editable
  // is still attached here and `commitInline` reads its current text.
  const prevModeRef = useRef(session.mode);
  useLayoutEffect(() => {
    const previous = prevModeRef.current;
    prevModeRef.current = session.mode;
    if (previous !== "preview" && session.mode === "preview" && sessionRef.current) {
      commitInline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only on a mode transition
  }, [session.mode]);

  // Cancel the session outright when the GROUND MOVES under it (issue #288):
  // an incoming render mid-edit that changes the value of the field actually
  // being edited means a concurrent change landed while the user was typing —
  // the session is abandoned rather than let the user keep typing into a
  // field whose eventual commit is either doomed to fail the host's revision
  // gate or, worse, could coincidentally match. Cancelling remounts the keyed
  // body (see `renderNode`), so the editor never sits there showing text that
  // no longer reflects the document. A render that leaves this field alone
  // (an edit elsewhere in the document) does NOT cancel — the session and the
  // stale-but-correctly-gated commit path (see `commitInline`) both survive
  // that case unchanged. Keyed on `document` identity alone: `mode`-only
  // session updates keep the SAME document reference (`applyInbound`,
  // `snapshot-store.ts`), so this effect only ever fires for an actual render.
  const prevDocumentForGroundCheckRef = useRef(document);
  useLayoutEffect(() => {
    const previousDocument = prevDocumentForGroundCheckRef.current;
    prevDocumentForGroundCheckRef.current = document;
    const active = sessionRef.current;
    if (!active || previousDocument === document) return;
    const targetNode = findNodeById(document.root, active.nodeId);
    const entry = targetNode ? entryById.get(targetNode.componentId) : undefined;
    const effective: Record<string, unknown> = {
      ...(entry?.definition.defaults ?? {}),
      ...(targetNode?.props ?? {}),
    };
    const raw = effective[active.fieldKey];
    const currentValue = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
    if (!targetNode || currentValue !== active.initialValue) cancelInline();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a document IDENTITY change gates this check
  }, [document]);

  // ── Drag & drop (issue #258) ──────────────────────────────────────────────
  // LOCAL renderer state; only the resulting `{ sourceNodeId, target, copy }`
  // ever crosses the bridge (the host revalidates + applies). The three verified
  // Chromium footguns the code below fixes EXACTLY (see the prototype README):
  //   - `dragstart` calls `setData` SYNCHRONOUSLY and DEFERS every state mutation
  //     (a synchronous setState in dragstart cancels the native drag in Chromium);
  //   - while dragging, insert-point CHILDREN are `pointer-events: none` (CSS,
  //     keyed off `data-zc-dragging`) — a child-crossing `dragleave` has a null
  //     `relatedTarget` in Chromium DnD and would otherwise wipe the highlight;
  //   - `dragend` clears the drag state UNCONDITIONALLY (a drop OR a cancel).
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const dragSourceRef = useRef<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const dropKeyRef = useRef<string | null>(null);
  const setDrop = useCallback((key: string | null) => {
    dropKeyRef.current = key;
    setDropKey(key);
  }, []);

  const beginDrag = useCallback((sourceNodeId: string) => {
    dragSourceRef.current = sourceNodeId;
    setDragSourceId(sourceNodeId);
  }, []);
  const endDrag = useCallback(() => {
    dragSourceRef.current = null;
    dropKeyRef.current = null;
    setDragSourceId(null);
    setDropKey(null);
  }, []);

  // The dragged node's own subtree ids — every insert point inside them is an
  // INVALID target (dropping there would orphan the subtree; the host's cycle
  // guard would reject it anyway, so the highlight simply excludes them).
  const draggedIds = useMemo(() => {
    if (!dragSourceId) return null;
    const source = findNodeById(document.root, dragSourceId);
    if (!source) return null;
    const ids = new Set<string>();
    const walk = (n: CompositionNode): void => {
      ids.add(n.id);
      for (const children of Object.values(n.slots)) for (const child of children ?? []) walk(child);
    };
    walk(source);
    return ids;
  }, [dragSourceId, document]);

  const dragActive = dragSourceId !== null;

  /** A drop target is valid unless it sits inside the dragged subtree. */
  const isValidDropTarget = useCallback(
    (target: InsertionTarget): boolean =>
      dragActive && !(target.parentId !== null && (draggedIds?.has(target.parentId) ?? false)),
    [dragActive, draggedIds],
  );

  /**
   * In Edit mode the canvas swallows every click in the CAPTURE phase before it
   * can reach a rendered `<a>`/`<button>`, so authoring a link never navigates
   * away and authoring a button never fires its handler. Editor affordances
   * (insert points, chrome buttons, the opaque payload disclosure) opt out with
   * `data-zc-affordance` and behave normally.
   */
  const swallow = (event: Event): boolean => {
    const target = event.target as Element | null;
    if (target?.closest("[data-zc-affordance]")) return false;
    // An active inline-editing region owns its own keys/clicks (Enter commits,
    // a multiline Enter inserts a newline, Space/caret keys type normally). The
    // capture-phase swallow must NOT stop those before they reach the editable.
    if (sessionRef.current && target?.closest(`[${INLINE_EDITING_ATTR}]`)) return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  const onClickCapture = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    // A click INSIDE the active editable is caret placement — never swallow it.
    if (sessionRef.current && target?.closest(`[${INLINE_EDITING_ATTR}]`)) return;
    if (!swallow(event)) return;
    const host = target?.closest("[data-zc-node-id]");
    const nodeId = host?.getAttribute("data-zc-node-id") ?? null;
    // Click AGAIN on the already-selected node opens its inline editor (if it has
    // one); the first click on an unselected node just selects it.
    if (nodeId && !sessionRef.current && nodeId === session.selectedId && enterInlineSession(nodeId)) {
      return;
    }
    onSelect(nodeId);
  };

  /** Double-click enters an inline session directly (the other entry path). */
  const onDblClick = (event: MouseEvent): void => {
    // An active session's own dblclick is stopped before it reaches here (see
    // the session's `onDblClick`); guard anyway so word-select never restarts it.
    if (sessionRef.current) return;
    const target = event.target as Element | null;
    if (target?.closest("[data-zc-affordance]")) return;
    const host = target?.closest("[data-zc-node-id]");
    const nodeId = host?.getAttribute("data-zc-node-id") ?? null;
    if (nodeId && enterInlineSession(nodeId)) event.preventDefault();
  };

  /** Keyboard activation is the other way a link/button fires. Swallow it too. */
  const onKeyDownCapture = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    swallow(event);
  };

  /**
   * PREVIEW mode: rendered controls activate normally — the event is NOT stopped,
   * so a component's own handlers run, buttons work, disclosures toggle.
   *
   * The one thing that must not happen is the preview NAVIGATING ITSELF away.
   * This document is the live runtime the parent drives; if an authored `<a href>`
   * unloads it, the parent has no way to bring it back, and "return to Edit with
   * state intact" (the fixed walkthrough) silently stops being true. So a link
   * that would replace this document has its default suppressed — and only that.
   */
  const onPreviewClickCapture = (event: MouseEvent): void => {
    const anchor = (event.target as Element | null)?.closest("a[href]");
    if (!anchor) return;
    const href = anchor.getAttribute("href") ?? "";
    if (href === "" || href.startsWith("#")) return; // in-page: harmless
    event.preventDefault();
  };

  /**
   * One insert point: the existing direct "+" add button (unchanged — same
   * class/attributes/behavior existing callers and tests depend on) PLUS a
   * companion "⋯" that opens the richer insert MENU (issue #256's "Add
   * component…" AND "Paste here", both always present). Two SIBLING
   * `<button>`s inside a non-interactive wrapper — never nested buttons.
   */
  function insertPoint(
    target: InsertionTarget,
    label: string,
    flow: SlotFlow,
    empty: boolean,
  ): JSX.Element {
    const position = empty ? `empty ${label}` : `${label}, position ${target.index + 1}`;
    const focusToken = insertMenuFocusToken(target);
    // Drop-target wiring (issue #258). The GROUP is the drop zone; its children
    // go inert during a drag (CSS, keyed off the canvas's `data-zc-dragging`),
    // so a child-crossing `dragleave` (null `relatedTarget`) can't wipe the
    // highlight. `dragover.preventDefault()` is what tells the browser this is a
    // valid drop point at all — omit it on invalid targets and the browser
    // refuses the drop there.
    const dropKeyStr = `${target.parentId ?? ""}:${target.slotId}:${target.index}`;
    const valid = isValidDropTarget(target);
    const dropHandlers = dragActive
      ? {
          onDragEnter: (event: DragEvent) => {
            if (!isValidDropTarget(target)) return;
            event.preventDefault();
            setDrop(dropKeyStr);
          },
          onDragOver: (event: DragEvent) => {
            if (!isValidDropTarget(target)) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
            if (dropKeyRef.current !== dropKeyStr) setDrop(dropKeyStr);
          },
          onDragLeave: () => {
            if (dropKeyRef.current === dropKeyStr) setDrop(null);
          },
          onDrop: (event: DragEvent) => {
            const sourceNodeId =
              event.dataTransfer?.getData("text/plain") || dragSourceRef.current;
            if (!sourceNodeId || !isValidDropTarget(target)) return;
            event.preventDefault();
            // `dragend` still fires after this and clears the drag state
            // unconditionally — so the emit stays here, the cleanup stays there.
            onDropNode?.(sourceNodeId, target, event.altKey);
          },
        }
      : null;
    return h(
      "div",
      {
        key: dropKeyStr,
        class: `zc-insert-group zc-insert-group--${flow}`,
        "data-zc-drop-valid": dragActive && valid ? "" : undefined,
        "data-zc-drop-active": dropKey === dropKeyStr ? "" : undefined,
        ...dropHandlers,
      },
      h(
        "button",
        {
          type: "button",
          class: `zc-insert zc-insert--${flow}${empty ? " zc-insert--empty" : ""}`,
          "data-zc-affordance": "",
          // Presentational/debug hook only — the click closes over the real target
          // object. Empty parent segment == the virtual root (a real node id is
          // never empty), so it cannot collide with a node literally named "root".
          "data-zc-insert": `${target.parentId ?? ""}:${target.slotId}:${target.index}`,
          "aria-label": `Add a component to ${position}`,
          onClick: () => onRequestAdd(target),
        },
        h("span", { class: "zc-insert-plus", "aria-hidden": "true" }, "+"),
      ),
      h(
        "button",
        {
          type: "button",
          class: "zc-insert-menu",
          "data-zc-affordance": "",
          "data-zc-focus-token": focusToken,
          "aria-label": `Insert options for ${position}`,
          onClick: (event: MouseEvent) => {
            event.stopPropagation();
            const rect = serializeRect((event.currentTarget as HTMLElement).getBoundingClientRect());
            onRequestInsertMenu(target, rect, focusToken);
          },
        },
        h("span", { "aria-hidden": "true" }, "⋯"),
      ),
    );
  }

  /**
   * One slot's rendered children. In Edit mode an insert point is emitted at
   * EVERY addable index — before the first child, between each pair, and after
   * the last (the round-2 insert-at-index contract; never append-only).
   *
   * A `single` slot that already holds its one child has no addable index, so it
   * gets no insert point.
   */
  function renderSlotChildren(
    children: readonly CompositionNode[],
    parentId: string | null,
    slotId: string,
    label: string,
    flow: SlotFlow,
    single: boolean,
  ): ComponentChildren[] {
    if (!edit) return children.map((child) => renderNode(child));

    const out: ComponentChildren[] = [];
    const addable = !single || children.length === 0;
    for (let index = 0; index <= children.length; index += 1) {
      if (addable) {
        out.push(insertPoint({ parentId, slotId, index }, label, flow, children.length === 0));
      }
      const child = children[index];
      if (child) out.push(renderNode(child));
    }
    return out;
  }

  /** The real component, with slot ids projected onto its real Preact props. */
  function renderComponent(node: CompositionNode, entry: ComposerEntry): ComponentChildren {
    const definition = entry.definition;
    // Defaults first, then the document's own props — the document always wins.
    // (`defaults`/`slots` are optional on a raw definition; see `manifestFor`.)
    const componentProps: Record<string, unknown> = {
      ...(definition.defaults ?? {}),
      ...safeProps(node.props),
    };
    // While inline-editing THIS node's field, render it with NO vdom text child:
    // the live text is owned imperatively (see the session layout effect), so a
    // re-render can never reset the caret. Exiting re-keys the body (below),
    // remounting it with the real value and leaving no duplicate text node.
    if (inlineSession?.nodeId === node.id) componentProps[inlineSession.fieldKey] = "";
    const flow = slotFlow(node);

    for (const slot of definition.slots ?? []) {
      const children = node.slots[slot.id] ?? [];
      const single = slot.cardinality === "single";
      const rendered = renderSlotChildren(children, node.id, slot.id, slot.label, flow, single);
      // A `single` slot takes the child ITSELF (not a 1-element array) so a
      // component that expects one VNode in a named prop gets exactly that —
      // and `undefined` when empty, never a truthy `[]` that would defeat a
      // component's own `left ?? fallback`.
      componentProps[slot.prop] = single ? rendered[0] : rendered;
    }

    return definition.adapters?.render
      ? definition.adapters.render(componentProps)
      : h(definition.component, componentProps);
  }

  /**
   * An unknown / unsupported-version / structurally-invalid node. It stays
   * SELECTABLE and its payload is shown verbatim, never dropped — the document
   * keeps it and #245's recovery contract keeps it round-trippable.
   */
  function renderOpaque(node: CompositionNode, diagnostic: NodeDiagnostic): ComponentChildren {
    return h(
      "div",
      { class: "zc-opaque" },
      h(
        "p",
        { class: "zc-opaque-title" },
        "Unavailable component: ",
        h("code", null, node.componentId),
      ),
      h(
        "ul",
        { class: "zc-opaque-reasons" },
        diagnostic.reasons.map((reason, index) =>
          h("li", { key: `zc-reason-${index}` }, reason.message),
        ),
      ),
      h(
        "details",
        { class: "zc-opaque-payload" },
        h("summary", { "data-zc-affordance": "" }, "Preserved payload"),
        h("pre", null, JSON.stringify(node, null, 2)),
      ),
    );
  }

  function renderNode(node: CompositionNode): JSX.Element {
    const entry = entryById.get(node.componentId);
    const diagnostic = classifyNode(node, manifest);
    const opaque = diagnostic.opaque || !entry;
    const label = entry?.title ?? node.componentId;
    const selected = session.selectedId === node.id;

    const body: ComponentChildren =
      opaque || !entry ? renderOpaque(node, diagnostic) : renderComponent(node, entry);

    // The SELECTED node's chrome gains a "⋯" trigger (issue #256) — every
    // other node's chrome stays exactly the bare label it always was (see
    // "the chrome is a keyed sibling" test: an unselected node's `.zc-chrome`
    // has no other class and no child elements). The label itself moves into
    // its own `aria-hidden` span only in the selected branch, so the trigger
    // button — the only focusable thing here — is never inside an
    // `aria-hidden` ancestor.
    // The drag grip (issue #258): shown ONLY on the SELECTED, non-opaque node
    // (opaque nodes are not draggable — same-slot reorder via the tree stays
    // their only movement), and only when a drop sink is wired. `dragstart`
    // sets the transfer data SYNCHRONOUSLY and DEFERS the drag-state mutation.
    const grip =
      selected && onDropNode && !opaque
        ? h(
            "button",
            {
              key: "zc-chrome-grip",
              type: "button",
              class: "zc-chrome-grip",
              "data-zc-affordance": "",
              draggable: true,
              "aria-label": `Drag ${label} to move it`,
              onDragStart: (event: DragEvent) => {
                event.dataTransfer?.setData("text/plain", node.id);
                if (event.dataTransfer) event.dataTransfer.effectAllowed = "copyMove";
                const id = node.id;
                // Defer ALL state mutation to a macrotask — a synchronous
                // setState here cancels the native drag in Chromium (verified).
                setTimeout(() => beginDrag(id), 0);
              },
              onDragEnd: () => endDrag(),
            },
            h("span", { "aria-hidden": "true" }, "⠿"),
          )
        : null;

    const chromeContent: ComponentChildren = selected
      ? [
          grip,
          h("span", { key: "zc-chrome-label", "aria-hidden": "true" }, label),
          h(
            "button",
            {
              key: "zc-chrome-menu",
              type: "button",
              class: "zc-chrome-menu",
              "data-zc-affordance": "",
              "data-zc-focus-token": nodeMenuFocusToken(node.id),
              "aria-label": `Open menu for ${label}`,
              onClick: (event: MouseEvent) => {
                event.stopPropagation();
                const rect = serializeRect((event.currentTarget as HTMLElement).getBoundingClientRect());
                onRequestNodeMenu(node.id, rect, nodeMenuFocusToken(node.id));
              },
            },
            h("span", { "aria-hidden": "true" }, "⋯"),
          ),
        ]
      : label;

    return h(
      "div",
      {
        key: `zc-node-${node.id}`,
        class: "zc-node",
        "data-zc-node-id": node.id,
        "data-zc-selected": selected ? "" : undefined,
        "data-zc-opaque": opaque ? "" : undefined,
      },
      // Both children are KEYED — see the DOM-identity note in the module header.
      edit
        ? h(
            "span",
            { key: "zc-chrome", class: "zc-chrome", "aria-hidden": selected ? undefined : "true" },
            chromeContent,
          )
        : null,
      h(
        Fragment,
        // Keyed DIFFERENTLY in edit vs read mode: entering/exiting a session
        // remounts the body, so the imperatively-managed editing DOM is fully
        // discarded on exit and can never leave a duplicate text node.
        { key: inlineSession?.nodeId === node.id ? "zc-body-editing" : "zc-body" },
        h(
          NodeErrorBoundary,
          {
            nodeId: node.id,
            componentId: node.componentId,
            // The DOCUMENT object, not the revision: a session-only message
            // (selection, theme, mode) keeps the same document reference, so
            // clicking around does not churn every latched error boundary.
            resetToken: document,
            onError: onNodeError,
          },
          body,
        ),
      ),
    );
  }

  return h(
    "div",
    {
      ref: canvasRef,
      class: "zc-canvas",
      "data-composer-canvas": "",
      "data-mode": session.mode,
      // The CSS hook for the drag lifecycle (issue #258): while set, insert-point
      // children are `pointer-events: none` so a child-crossing `dragleave`
      // (null `relatedTarget` in Chromium) can't wipe the drop highlight.
      "data-zc-dragging": dragActive ? "" : undefined,
      onClickCapture: edit ? onClickCapture : onPreviewClickCapture,
      onKeyDownCapture: edit ? onKeyDownCapture : undefined,
      // Bubbling (not capture) so an active session's own `dblclick`
      // stopPropagation can keep word-select from restarting the session.
      onDblClick: edit ? onDblClick : undefined,
    },
    renderSlotChildren(
      document.root,
      null,
      VIRTUAL_ROOT_SLOT_ID,
      "the document",
      "vertical",
      false,
    ),
  );
}

// ── Per-node error boundary ─────────────────────────────────────────────────

interface NodeErrorBoundaryProps {
  nodeId: string;
  componentId: string;
  /** Changing this clears a latched error — see `getDerivedStateFromProps`. */
  resetToken: unknown;
  onError?: (nodeId: string, message: string) => void;
  children?: ComponentChildren;
}

interface NodeErrorBoundaryState {
  error: string | null;
  token: unknown;
}

/**
 * Isolates a throwing component to its own node. A Composition can legitimately
 * hold props a component rejects (an older document, a hand-edited value, a prop
 * whose domain narrowed) — the whole canvas must not go blank because one node
 * threw. The failure is reported to the host, rendered in place as a RECOVERABLE
 * message, and retryable both by hand ("Retry") and automatically when the next
 * revision arrives.
 */
class NodeErrorBoundary extends Component<NodeErrorBoundaryProps, NodeErrorBoundaryState> {
  state: NodeErrorBoundaryState = { error: null, token: undefined };

  /**
   * Clears a latched error whenever a NEW DOCUMENT arrives, without remounting
   * the subtree — so fixing the offending prop in the inspector retries the
   * component, while an ordinary re-render (hover, selection, theme) leaves both
   * the error state AND the component's DOM node untouched.
   */
  static getDerivedStateFromProps(
    props: NodeErrorBoundaryProps,
    state: NodeErrorBoundaryState,
  ): Partial<NodeErrorBoundaryState> | null {
    if (props.resetToken !== state.token) return { error: null, token: props.resetToken };
    return null;
  }

  componentDidCatch(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.setState({ error: message });
    this.props.onError?.(this.props.nodeId, message);
  }

  render(): ComponentChildren {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return h(
      "div",
      { class: "zc-node-error", role: "status" },
      h(
        "p",
        { class: "zc-node-error-title" },
        "This component failed to render: ",
        h("code", null, this.props.componentId),
      ),
      h("p", { class: "zc-node-error-detail" }, error),
      h(
        "button",
        {
          type: "button",
          class: "zc-node-error-retry",
          "data-zc-affordance": "",
          onClick: () => this.setState({ error: null, token: this.props.resetToken }),
        },
        "Retry",
      ),
    );
  }
}
