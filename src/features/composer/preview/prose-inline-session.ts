// ── Explicit-save prose editing: the DOM integration (issue #375, epic #368) ─
//
// Binds the PURE state machine in `prose-session-machine.ts` (#374) to real
// iframe DOM: entry gesture, the raw-markdown editable surface, the stimuli
// (typing, ESC, click-away, host-chrome focus loss, mode switch, incoming
// renders), and the iframe-side Save button + confirmation dialogs.
//
// ── This is a PARALLEL path, not a modification ─────────────────────────────
//
// The auto-commit session in `renderer.ts` (#257 / #288) — Enter commits, blur
// commits, Edit→Preview commits — is untouched and still drives every field
// whose contract says `inlineEdit.mode: "plain"` (the default). A field only
// reaches THIS module by declaring `inlineEdit.mode: "markdown-source"` (#372).
// Nothing here is shared with `commitInline` / `cancelInline`; the only common
// code is the DOM-reading helpers in `inline-edit-dom.ts`, which are pure.
//
// ── The editing surface is OURS, not the component's ────────────────────────
//
// The plain session makes the COMPONENT's own rendered text region editable
// (via `adapters.inlineEditor.resolveElement`). This session deliberately does
// not: it renders its own `.zc-prose-source` element in place of the node's
// body while a session is open. Two reasons, both load-bearing:
//
//   1. The contract is RAW MARKDOWN SOURCE as plain text, not WYSIWYG — the
//      plain-text walker (`readEditableValue`) is not a markdown serializer,
//      so reading back an edited *rendered* tree could not reconstruct the
//      source. What is edited must therefore be the source itself.
//   2. `ProseMd` paints through `dangerouslySetInnerHTML` and reaches it via
//      an ASYNC render (the wasm markdown runtime resolves after mount). An
//      imperatively-inserted text node inside that element is wiped the moment
//      the component's pending → ready transition lands — a race no amount of
//      careful keying on our side can win, because the component owns it.
//
// Every other established DOM-identity technique still applies exactly: the
// editable carries NO vdom child (its text is inserted imperatively, so a
// re-render can never reset the caret), the node's body is keyed DIFFERENTLY
// while a session is open (so exit remounts the real component cleanly and
// can never leave a duplicate text node behind), and a `dblclick` inside the
// editable stops propagating so word-select cannot restart the session.
//
// ── Why there is no "set mode" message ──────────────────────────────────────
//
// `restore-editing` (keeping a draft that a mode switch stashed) requires the
// canvas back in Edit mode, but the bridge has no preview→parent mode message
// and this epic adds NO protocol traffic. So the mode change is LOCAL: while a
// restored session is live the renderer draws Edit-mode chrome regardless of
// the host's mode (`editModeOverride`). It is cleared the moment the session
// ends, or as soon as the host sends any Edit-mode snapshot of its own.

import { Fragment, h } from "preact";
import type { ComponentChildren, RefObject } from "preact";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { CompositionDocument } from "@/composer";
import type { ComposerEntry } from "@/styleguide/data/composer-registry";
import {
  INLINE_EDITING_ATTR,
  effectiveFieldValue,
  escapeAttrValue,
  findNodeById,
  inlineEditableForEntry,
  placeCaretAtEnd,
  readEditableValue,
} from "./inline-edit-dom";
import type { PreviewMode } from "./protocol";
import {
  idleProseSession,
  proseSessionDraft,
  proseSessionIsDirty,
  proseSessionTransition,
  type ProseDialogKind,
  type ProseSessionInput,
  type ProseSessionState,
} from "./prose-session-machine";

/** Marks the raw-markdown editable this session owns. */
export const PROSE_EDITING_ATTR = "data-zc-prose-editing";
/** Marks the Save button / dialog subtree — never an "outside" click. */
export const PROSE_CHROME_ATTR = "data-zc-prose-chrome";

const DIALOG_TITLE_ID = "zc-prose-dialog-title";
const DIALOG_TEXT_ID = "zc-prose-dialog-text";

/** Which editable is mounted. `epoch` re-runs the mount effect on a re-mount. */
interface ProseMount {
  nodeId: string;
  fieldKey: string;
  epoch: number;
}

export interface ProseInlineSessionOptions {
  /** The document on screen — an identity change is an incoming render. */
  document: CompositionDocument;
  /** Registry lookup, keyed by `componentId`. */
  entryById: ReadonlyMap<string, ComposerEntry>;
  /** The revision on screen; captured at session START and never refreshed (#288). */
  revision: number;
  /** The HOST's mode. A local Edit override may sit on top of it — see the header. */
  mode: PreviewMode;
  /** The canvas root, used to locate the mounted editable. */
  canvasRef: RefObject<HTMLElement | null>;
  /** The single commit path: the existing `commit-inline-edit` message. */
  onCommit?: (nodeId: string, fieldKey: string, value: string, documentRevision: number) => void;
}

export interface ProseInlineSession {
  /** The node whose editable is mounted — null when idle OR stashed. */
  mountedNodeId: string | null;
  /** A live ref (not state) so imperative canvas handlers see the current value. */
  activeRef: { readonly current: boolean };
  /** Draw the canvas in Edit mode even though the host says Preview — see the header. */
  editModeOverride: boolean;
  /** Open a session on `nodeId`; false when the node has no markdown-source field. */
  tryEnter: (nodeId: string) => boolean;
  /** The raw-source editable, rendered in place of the node's body. */
  renderEditor: () => ComponentChildren;
  /** The floating Save button and the confirmation dialog. */
  renderChrome: () => ComponentChildren;
}

/**
 * `contenteditable="plaintext-only"` is what keeps a RICH paste from smuggling
 * markup into a field whose value is markdown text — but Firefox only shipped
 * it in 136, and on an older engine the value is simply not in the attribute's
 * enum, so the element ends up NOT EDITABLE AT ALL. Probing the IDL setter
 * (which rejects an unsupported value) turns that dead editor into the plain
 * `"true"` editable the auto-commit session already uses for multiline fields.
 * Cached per document — the answer is a property of the engine.
 */
const plaintextOnlySupport = new WeakMap<Document, boolean>();

function editableAttrValue(ownerDoc: Document): "plaintext-only" | "true" {
  let supported = plaintextOnlySupport.get(ownerDoc);
  if (supported === undefined) {
    const probe = ownerDoc.createElement("div");
    try {
      probe.contentEditable = "plaintext-only";
      supported = probe.contentEditable === "plaintext-only";
    } catch {
      supported = false;
    }
    plaintextOnlySupport.set(ownerDoc, supported);
  }
  return supported ? "plaintext-only" : "true";
}

/** Whether a focus/click target sits inside this session's own chrome. */
function inProseChrome(target: EventTarget | null): boolean {
  const element = target as Element | null;
  return typeof element?.closest === "function" && element.closest(`[${PROSE_CHROME_ATTR}]`) !== null;
}

/** Whether a focus/click target sits inside the raw-source editable. */
function inProseEditable(target: EventTarget | null): boolean {
  const element = target as Element | null;
  return typeof element?.closest === "function" && element.closest(`[${PROSE_EDITING_ATTR}]`) !== null;
}

export function useProseInlineSession(options: ProseInlineSessionOptions): ProseInlineSession {
  const { canvasRef } = options;

  // Every option that an imperative listener (attached outside Preact) reads is
  // mirrored into a ref, so a listener installed for one mount never closes
  // over a stale document/registry/revision.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setStateValue] = useState<ProseSessionState>(idleProseSession);
  const stateRef = useRef<ProseSessionState>(idleProseSession);
  const activeRef = useRef(false);

  const [mount, setMountValue] = useState<ProseMount | null>(null);
  const mountRef = useRef<ProseMount | null>(null);
  const epochRef = useRef(0);
  /** Text to insert imperatively at the next mount (a fresh value, or a restored draft). */
  const seedRef = useRef("");

  const [dialog, setDialog] = useState<ProseDialogKind | null>(null);
  const [editModeOverride, setEditModeOverride] = useState(false);

  const editableRef = useRef<HTMLElement | null>(null);
  /** Set by `refocus`; consumed after the render that (re)mounted the editable. */
  const pendingFocusRef = useRef(false);
  /** A click-away that opened a dialog is CONSUMED, never replayed (#374's header). */
  const swallowClickRef = useRef(false);

  const setMount = useCallback((next: ProseMount | null) => {
    mountRef.current = next;
    setMountValue(next);
  }, []);

  const mountEditor = useCallback(
    (nodeId: string, fieldKey: string, seed: string) => {
      seedRef.current = seed;
      epochRef.current += 1;
      setMount({ nodeId, fieldKey, epoch: epochRef.current });
    },
    [setMount],
  );

  const dispatch = useCallback(
    (input: ProseSessionInput) => {
      const { state: next, effects } = proseSessionTransition(stateRef.current, input);
      stateRef.current = next;
      activeRef.current = next.kind !== "idle";
      setStateValue(next);

      for (const effect of effects) {
        switch (effect.type) {
          case "commit":
            // The ONE commit path. Stamped with the SESSION-START revision the
            // draft has carried since `start` — never the revision on screen
            // now (issue #288's invariant).
            optionsRef.current.onCommit?.(
              effect.draft.nodeId,
              effect.draft.fieldKey,
              effect.draft.value,
              effect.draft.startRevision,
            );
            setMount(null);
            setEditModeOverride(false);
            break;
          case "discard":
            setMount(null);
            setEditModeOverride(false);
            break;
          case "stash-draft":
            // The editable is about to be destroyed; the draft lives on in the
            // machine's state until the dialog is answered.
            setMount(null);
            break;
          case "restore-editing":
            setEditModeOverride(true);
            mountEditor(effect.draft.nodeId, effect.draft.fieldKey, effect.draft.value);
            break;
          case "refocus":
            pendingFocusRef.current = true;
            break;
          case "show-dialog":
            setDialog(effect.dialog);
            break;
          case "close-dialog":
            setDialog(null);
            break;
        }
      }
    },
    [mountEditor, setMount],
  );

  /**
   * Push the editable's CURRENT text into the machine before any stimulus that
   * can end the session. `input` events already track typing, but an in-flight
   * IME composition (or a paste a browser reports late) can leave the machine
   * one keystroke behind — and the difference decides both dirtiness and what
   * a commit would carry. Cheap, and it removes the whole race class.
   */
  const syncValueFromDom = useCallback(() => {
    const el = editableRef.current;
    if (!el || stateRef.current.kind === "idle") return;
    dispatch({ type: "input", value: readEditableValue(el, true) });
  }, [dispatch]);

  const tryEnter = useCallback(
    (nodeId: string): boolean => {
      if (stateRef.current.kind !== "idle") return false;
      const { document, entryById, revision } = optionsRef.current;
      const targetNode = findNodeById(document.root, nodeId);
      if (!targetNode) return false;
      const entry = entryById.get(targetNode.componentId);
      const editable = inlineEditableForEntry(entry);
      if (!editable || editable.mode !== "markdown-source") return false;
      const initialValue = effectiveFieldValue(targetNode, entry, editable.field);
      mountEditor(nodeId, editable.field, initialValue);
      dispatch({
        type: "start",
        nodeId,
        fieldKey: editable.field,
        value: initialValue,
        startRevision: revision,
      });
      return true;
    },
    [dispatch, mountEditor],
  );

  // ── Mount / tear down the raw-source editable ─────────────────────────────
  //
  // A LAYOUT effect: it runs after the differently-keyed body has committed the
  // fresh element but before paint, so the seeded text and the caret are in
  // place with no flicker. `epoch` is in the key so a RE-mount (keeping a
  // stashed draft) re-runs it even though node/field are unchanged.
  useLayoutEffect(() => {
    const active = mountRef.current;
    if (!active) return;

    const el = canvasRef.current?.querySelector<HTMLElement>(
      `[data-zc-owner="local"][data-zc-node-id="${escapeAttrValue(active.nodeId)}"] [${PROSE_EDITING_ATTR}]`,
    );
    if (!el) {
      // The node left the canvas between the state update and this effect.
      // Abandon rather than strand the user in a session with no editor; the
      // draft is unsaveable anyway (its target is gone).
      dispatch({ type: "node-removed", nodeId: active.nodeId });
      return;
    }
    editableRef.current = el;

    const ownerDoc = el.ownerDocument;
    el.setAttribute(INLINE_EDITING_ATTR, "");
    // This is a SOURCE editor — see `editableAttrValue` for why the value is
    // probed rather than hardcoded.
    el.setAttribute("contenteditable", editableAttrValue(ownerDoc));
    // Imperative, never a vdom child — see the module header.
    el.appendChild(ownerDoc.createTextNode(seedRef.current));
    el.focus();
    placeCaretAtEnd(el);

    let composing = false;
    const onCompositionStart = (): void => {
      composing = true;
    };
    const onCompositionEnd = (): void => {
      composing = false;
      // The confirmed candidate is now real text; record it immediately so a
      // following ESC/click-away sees the right dirtiness.
      syncValueFromDom();
    };
    const onInput = (): void => {
      dispatch({ type: "input", value: readEditableValue(el, true) });
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      // Enter is deliberately UNHANDLED: it inserts a newline in the source and
      // never commits. There is no implicit commit anywhere in this session.
      if (event.key !== "Escape") return;
      // IME-SAFE: an ESC that dismisses an in-flight composition belongs to the
      // IME, not to the session — cancelling the edit there would throw away a
      // draft the user was still composing into.
      if (composing || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      event.stopPropagation();
      syncValueFromDom();
      dispatch({ type: "escape" });
    };
    const onFocusOut = (event: FocusEvent): void => {
      // Only a live editing session can lose focus meaningfully: a teardown
      // (commit/discard/stash) also fires focusout, and while a dialog is open
      // the pending decision already owns the session.
      if (stateRef.current.kind !== "editing") return;
      const next = event.relatedTarget;
      if (next && (el.contains(next as Node) || inProseChrome(next))) return;
      // Focus left the editable with no in-iframe successor. That is the ONLY
      // observable signal for a click on HOST chrome (toolbar / inspector /
      // tree): the iframe cannot see the host document's mousedown, and this
      // epic adds no protocol message for it.
      syncValueFromDom();
      dispatch({ type: "outside-intent" });
    };
    // Word-select inside an active session must NOT bubble to the canvas, or it
    // would restart the session and revert the typing (verified failure mode).
    const onDblClick = (event: MouseEvent): void => {
      event.stopPropagation();
    };

    el.addEventListener("compositionstart", onCompositionStart);
    el.addEventListener("compositionend", onCompositionEnd);
    el.addEventListener("input", onInput);
    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("focusout", onFocusOut);
    el.addEventListener("dblclick", onDblClick);

    // Outside clicks are caught at MOUSEDOWN in the CAPTURE phase, on the whole
    // preview document: the canvas's own click-swallow runs on `click`, which
    // is already too late — focus has moved by then and `focusout` would have
    // raised the same stimulus a second time.
    const onDocMouseDownCapture = (event: MouseEvent): void => {
      if (stateRef.current.kind !== "editing") return;
      if (inProseEditable(event.target) || inProseChrome(event.target)) return;
      syncValueFromDom();
      if (proseSessionIsDirty(stateRef.current)) {
        // Keep focus (and the caret) exactly where they are behind the dialog,
        // and CONSUME the gesture — the machine never replays it.
        event.preventDefault();
        event.stopPropagation();
        swallowClickRef.current = true;
      }
      dispatch({ type: "outside-intent" });
    };
    const onDocClickCapture = (event: MouseEvent): void => {
      if (!swallowClickRef.current) return;
      // Our own chrome is never the swallowed gesture: a click on the dialog is
      // the ANSWER to the prompt that gesture raised. (It also cannot be the
      // pair of the intercepted mousedown — that landed outside the chrome.)
      if (inProseChrome(event.target)) return;
      swallowClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };
    ownerDoc.addEventListener("mousedown", onDocMouseDownCapture, true);
    ownerDoc.addEventListener("click", onDocClickCapture, true);

    return () => {
      el.removeEventListener("compositionstart", onCompositionStart);
      el.removeEventListener("compositionend", onCompositionEnd);
      el.removeEventListener("input", onInput);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("focusout", onFocusOut);
      el.removeEventListener("dblclick", onDblClick);
      ownerDoc.removeEventListener("mousedown", onDocMouseDownCapture, true);
      ownerDoc.removeEventListener("click", onDocClickCapture, true);
      el.removeAttribute("contenteditable");
      el.removeAttribute(INLINE_EDITING_ATTR);
      swallowClickRef.current = false;
      if (editableRef.current === el) editableRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the mount identity
  }, [mount?.nodeId, mount?.fieldKey, mount?.epoch]);

  // `refocus`, deferred to after the render that (re)mounted the editable — a
  // "keep editing" from a STASHED draft has no element to focus until then.
  // Declared AFTER the mount effect so it always sees the fresh element.
  useLayoutEffect(() => {
    if (!pendingFocusRef.current) return;
    const el = editableRef.current;
    if (!el) return;
    pendingFocusRef.current = false;
    el.focus();
    placeCaretAtEnd(el);
  });

  // ── Host mode changes ─────────────────────────────────────────────────────
  const prevModeRef = useRef(options.mode);
  useLayoutEffect(() => {
    const previous = prevModeRef.current;
    prevModeRef.current = options.mode;
    if (previous === options.mode) return;
    // The host reasserting Edit mode makes any local override redundant.
    if (options.mode === "edit") setEditModeOverride(false);
    if (stateRef.current.kind === "idle") return;
    // The keyed body is not remounted by a mere mode change, so the editable is
    // still live here and its text can be captured before the stash.
    syncValueFromDom();
    dispatch({ type: "mode-switch", mode: options.mode });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only on a mode transition
  }, [options.mode]);

  // ── Incoming renders (#288's ground-check, prose edition) ─────────────────
  // Keyed on document IDENTITY: a session-only message (mode, theme, selection)
  // keeps the same document reference, so this only fires for a real render.
  const prevDocumentRef = useRef(options.document);
  useLayoutEffect(() => {
    const previous = prevDocumentRef.current;
    prevDocumentRef.current = options.document;
    const draft = proseSessionDraft(stateRef.current);
    if (!draft || previous === options.document) return;
    const targetNode = findNodeById(options.document.root, draft.nodeId);
    if (!targetNode) {
      dispatch({ type: "node-removed", nodeId: draft.nodeId });
      return;
    }
    dispatch({
      type: "external-value-change",
      nodeId: draft.nodeId,
      fieldKey: draft.fieldKey,
      value: effectiveFieldValue(
        targetNode,
        optionsRef.current.entryById.get(targetNode.componentId),
        draft.fieldKey,
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a document IDENTITY change gates this check
  }, [options.document]);

  // Put initial focus on the SAFE action whenever a dialog opens.
  const dialogRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!dialog) return;
    dialogRef.current
      ?.querySelector<HTMLElement>("[data-zc-dialog-default]")
      ?.focus();
  }, [dialog]);

  // ── Rendering ─────────────────────────────────────────────────────────────

  const renderEditor = useCallback(
    (): ComponentChildren =>
      h("div", {
        key: "zc-prose-source",
        class: "zc-prose-source",
        [PROSE_EDITING_ATTR]: "",
        [INLINE_EDITING_ATTR]: "",
        // No vdom children, ever: the text node is inserted imperatively so a
        // re-render can never reset the caret (module header).
        spellcheck: false,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Markdown source",
      }),
    [],
  );

  const dialogAction = (
    label: string,
    tone: "neutral" | "danger" | "primary",
    onActivate: () => void,
    extra: Record<string, unknown> = {},
  ): ComponentChildren =>
    h(
      "button",
      {
        key: `zc-prose-dialog-${label}`,
        type: "button",
        class: `zc-prose-dialog-action zc-prose-dialog-action--${tone}`,
        "data-zc-affordance": "",
        "data-zc-dialog-action": "",
        onClick: onActivate,
        ...extra,
      },
      label,
    );

  const onDialogKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      // Dismissing either dialog means "keep editing" — the safe default.
      dispatch({ type: "escape" });
      return;
    }
    if (event.key !== "Tab") return;
    // Focus containment: the dialog is modal, so Tab must not walk out into the
    // canvas behind it.
    const actions = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>("[data-zc-dialog-action]") ?? []),
    ];
    if (actions.length === 0) return;
    const first = actions[0]!;
    const last = actions[actions.length - 1]!;
    const activeElement = dialogRef.current?.ownerDocument.activeElement;
    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const renderDialog = (kind: ProseDialogKind): ComponentChildren => {
    const escape = kind === "escape";
    return h(
      "div",
      {
        key: "zc-prose-dialog-backdrop",
        class: "zc-prose-dialog-backdrop",
        [PROSE_CHROME_ATTR]: "",
        "data-zc-affordance": "",
      },
      h(
        "div",
        {
          class: "zc-prose-dialog",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": DIALOG_TITLE_ID,
          "aria-describedby": DIALOG_TEXT_ID,
          ref: (el: HTMLElement | null) => {
            dialogRef.current = el;
          },
          onKeyDown: onDialogKeyDown,
        },
        h("p", { id: DIALOG_TITLE_ID, class: "zc-prose-dialog-title" }, "Unsaved markdown changes"),
        h(
          "p",
          { id: DIALOG_TEXT_ID, class: "zc-prose-dialog-text" },
          escape
            ? "Discard the changes you made to this block?"
            : "You are leaving this block. Save the changes you made?",
        ),
        h(
          "div",
          { class: "zc-prose-dialog-actions" },
          dialogAction("Discard changes", "danger", () =>
            dispatch({ type: "dialog-choice", dialog: kind, choice: "discard" }),
          ),
          dialogAction(
            "Keep editing",
            "neutral",
            () => dispatch({ type: "dialog-choice", dialog: kind, choice: "keep-editing" }),
            // The SAFE action takes initial focus (see the dialog focus effect).
            { "data-zc-dialog-default": "" },
          ),
          escape
            ? null
            : dialogAction("Save changes", "primary", () =>
                dispatch({ type: "dialog-choice", dialog: "leave", choice: "save" }),
              ),
        ),
      ),
    );
  };

  const renderChrome = (): ComponentChildren => {
    if (state.kind === "idle") return null;
    const dirty = proseSessionIsDirty(state);
    // While a dialog is open it owns the decision — the backdrop covers the bar
    // anyway, and a second Save affordance would be a second accent element.
    const savebar =
      dialog !== null
        ? null
        : h(
            "div",
            {
              key: "zc-prose-savebar",
              class: "zc-prose-savebar",
              [PROSE_CHROME_ATTR]: "",
              "data-zc-affordance": "",
            },
            dirty
              ? h("span", { class: "zc-prose-savebar-status", role: "status" }, "Unsaved changes")
              : null,
            h(
              "button",
              {
                type: "button",
                class: "zc-prose-save",
                "data-zc-affordance": "",
                "data-zc-dirty": dirty ? "" : undefined,
                // Keeping the mousedown default suppressed is what stops the
                // button from stealing focus: a focusout here would be read as
                // a click-away and raise the leave dialog instead of saving.
                onMouseDown: (event: MouseEvent) => event.preventDefault(),
                onClick: () => {
                  syncValueFromDom();
                  dispatch({ type: "save-click" });
                },
              },
              dirty ? "Save" : "Done",
            ),
          );
    return h(Fragment, null, savebar, dialog === null ? null : renderDialog(dialog));
  };

  return {
    mountedNodeId: mount?.nodeId ?? null,
    activeRef,
    editModeOverride,
    tryEnter,
    renderEditor,
    renderChrome,
  };
}
