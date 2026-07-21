import { describe, expect, it } from "vitest";

import {
  idleProseSession,
  proseSessionDraft,
  proseSessionIsDirty,
  proseSessionTransition,
  type ProseSessionEffect,
  type ProseSessionInput,
  type ProseSessionState,
} from "../prose-session-machine";

// The explicit-commit prose session (#374). These tests are the executable
// half of the module header's contract: every state × input transition, the
// racy double-stimulus sequences, and two graph-wide properties proved by
// exhaustive exploration of the reachable state space.

const NODE = "n1";
const FIELD = "markdown";
const SEED = "# seed";
const TYPED = "# seed, edited";
const TYPED_AGAIN = "# seed, edited twice";
const REV = 7;

const START: ProseSessionInput = {
  type: "start",
  nodeId: NODE,
  fieldKey: FIELD,
  value: SEED,
  startRevision: REV,
};

function apply(state: ProseSessionState, ...inputs: ProseSessionInput[]): ProseSessionState {
  return inputs.reduce((acc, input) => proseSessionTransition(acc, input).state, state);
}

const editingClean = (): ProseSessionState => apply(idleProseSession, START);
const editingDirty = (): ProseSessionState =>
  apply(editingClean(), { type: "input", value: TYPED });
const promptEscape = (): ProseSessionState => apply(editingDirty(), { type: "escape" });
const promptLeave = (): ProseSessionState => apply(editingDirty(), { type: "outside-intent" });
const promptEscapeStashed = (): ProseSessionState =>
  apply(promptEscape(), { type: "mode-switch", mode: "preview" });
const promptLeaveStashed = (): ProseSessionState =>
  apply(editingDirty(), { type: "mode-switch", mode: "preview" });

const commitOf = (effects: readonly ProseSessionEffect[]) =>
  effects.find((e) => e.type === "commit");

describe("idle", () => {
  it("opens a session on start, capturing the value and the session-start revision", () => {
    const { state, effects } = proseSessionTransition(idleProseSession, START);

    expect(state).toEqual({
      kind: "editing",
      draft: {
        nodeId: NODE,
        fieldKey: FIELD,
        initialValue: SEED,
        value: SEED,
        startRevision: REV,
      },
    });
    expect(effects).toEqual([]);
    expect(proseSessionIsDirty(state)).toBe(false);
  });

  it.each<ProseSessionInput>([
    { type: "input", value: TYPED },
    { type: "escape" },
    { type: "save-click" },
    { type: "outside-intent" },
    {
      type: "external-value-change",
      nodeId: NODE,
      fieldKey: FIELD,
      value: TYPED,
    },
    { type: "node-removed", nodeId: NODE },
    { type: "mode-switch", mode: "preview" },
    { type: "dialog-choice", dialog: "escape", choice: "discard" },
    { type: "dialog-choice", dialog: "leave", choice: "save" },
  ])("ignores $type when no session is open", (input) => {
    expect(proseSessionTransition(idleProseSession, input)).toEqual({
      state: idleProseSession,
      effects: [],
    });
  });

  it("ignores a commit-ack-shaped race: stimuli arriving after a save landed do nothing", () => {
    // A commit is fire-and-forget over the bridge, so the session ends the
    // instant `commit` is emitted — there is no in-flight state to interrupt.
    const { state, effects } = proseSessionTransition(editingDirty(), {
      type: "save-click",
    });
    expect(state).toEqual(idleProseSession);
    expect(commitOf(effects)).toBeDefined();

    expect(proseSessionTransition(state, { type: "escape" }).effects).toEqual([]);
    expect(proseSessionTransition(state, { type: "outside-intent" }).effects).toEqual([]);
  });
});

describe("editing", () => {
  it("records typing and derives dirtiness against the session-start value", () => {
    const typed = apply(editingClean(), { type: "input", value: TYPED });
    expect(proseSessionIsDirty(typed)).toBe(true);
    expect(proseSessionDraft(typed)?.value).toBe(TYPED);

    const backToSeed = apply(typed, { type: "input", value: SEED });
    expect(proseSessionIsDirty(backToSeed)).toBe(false);
    expect(proseSessionDraft(backToSeed)?.initialValue).toBe(SEED);
  });

  it("ignores a second start while a session is open", () => {
    const state = editingDirty();
    const { state: next, effects } = proseSessionTransition(state, {
      type: "start",
      nodeId: "n2",
      fieldKey: FIELD,
      value: "other",
      startRevision: 99,
    });
    expect(next).toBe(state);
    expect(effects).toEqual([]);
  });

  describe("while NOT dirty every leave stimulus exits silently", () => {
    it.each<[string, ProseSessionInput]>([
      ["escape", { type: "escape" }],
      ["outside-intent", { type: "outside-intent" }],
      ["mode-switch to preview", { type: "mode-switch", mode: "preview" }],
    ])("%s", (_label, input) => {
      const { state, effects } = proseSessionTransition(editingClean(), input);
      expect(state).toEqual(idleProseSession);
      expect(effects).toEqual([{ type: "discard" }]);
    });
  });

  it("prompts with the ESCAPE dialog when escape arrives dirty", () => {
    const { state, effects } = proseSessionTransition(editingDirty(), {
      type: "escape",
    });
    expect(state).toEqual({
      kind: "prompting-escape",
      draft: proseSessionDraft(editingDirty()),
      stashed: false,
    });
    expect(effects).toEqual([{ type: "show-dialog", dialog: "escape" }]);
  });

  it("prompts with the LEAVE dialog when outside-intent arrives dirty, consuming the action", () => {
    const { state, effects } = proseSessionTransition(editingDirty(), {
      type: "outside-intent",
    });
    expect(state.kind).toBe("prompting-leave");
    // No effect replays the outside action — it is consumed by the prompt.
    expect(effects).toEqual([{ type: "show-dialog", dialog: "leave" }]);
  });

  it("stashes the draft and prompts to leave when the mode switches away dirty (never commits)", () => {
    const draft = proseSessionDraft(editingDirty());
    const { state, effects } = proseSessionTransition(editingDirty(), {
      type: "mode-switch",
      mode: "preview",
    });
    expect(state).toEqual({ kind: "prompting-leave", draft, stashed: true });
    expect(effects).toEqual([
      { type: "stash-draft", draft },
      { type: "show-dialog", dialog: "leave" },
    ]);
    expect(commitOf(effects)).toBeUndefined();
  });

  it("ignores a mode switch back into edit", () => {
    const state = editingDirty();
    expect(proseSessionTransition(state, { type: "mode-switch", mode: "edit" })).toEqual({
      state,
      effects: [],
    });
  });

  it("commits on save-click, stamped with the SESSION-START revision", () => {
    const { state, effects } = proseSessionTransition(editingDirty(), {
      type: "save-click",
    });
    expect(state).toEqual(idleProseSession);
    expect(effects).toEqual([
      {
        type: "commit",
        draft: {
          nodeId: NODE,
          fieldKey: FIELD,
          initialValue: SEED,
          value: TYPED,
          startRevision: REV,
        },
      },
    ]);
  });

  it("suppresses a no-op commit: save-click on an unchanged value just ends the session", () => {
    // A no-op commit would still advance the document revision host-side and
    // poison a later real commit's staleness gate (#288).
    const { state, effects } = proseSessionTransition(editingClean(), {
      type: "save-click",
    });
    expect(state).toEqual(idleProseSession);
    expect(effects).toEqual([{ type: "discard" }]);
  });

  it("suppresses the commit when typing round-trips back to the session-start value", () => {
    const roundTripped = apply(editingDirty(), { type: "input", value: SEED });
    expect(proseSessionTransition(roundTripped, { type: "save-click" }).effects).toEqual([
      { type: "discard" },
    ]);
  });

  describe("ground-moved check (accepted limitation 1)", () => {
    it("discards silently when the edited field changed underneath", () => {
      const { state, effects } = proseSessionTransition(editingDirty(), {
        type: "external-value-change",
        nodeId: NODE,
        fieldKey: FIELD,
        value: "changed elsewhere",
      });
      expect(state).toEqual(idleProseSession);
      expect(effects).toEqual([{ type: "discard" }]);
    });

    it.each<[string, ProseSessionInput]>([
      [
        "a render that left the field's value alone",
        {
          type: "external-value-change",
          nodeId: NODE,
          fieldKey: FIELD,
          value: SEED,
        },
      ],
      [
        "a change to another field of the same node",
        {
          type: "external-value-change",
          nodeId: NODE,
          fieldKey: "heading",
          value: "x",
        },
      ],
      [
        "a change to another node",
        {
          type: "external-value-change",
          nodeId: "n2",
          fieldKey: FIELD,
          value: "x",
        },
      ],
    ])("survives %s", (_label, input) => {
      const state = editingDirty();
      expect(proseSessionTransition(state, input)).toEqual({
        state,
        effects: [],
      });
    });
  });

  describe("node removal (accepted limitation 2)", () => {
    it("discards silently when the edited node is gone", () => {
      const { state, effects } = proseSessionTransition(editingDirty(), {
        type: "node-removed",
        nodeId: NODE,
      });
      expect(state).toEqual(idleProseSession);
      expect(effects).toEqual([{ type: "discard" }]);
    });

    it("ignores removal of an unrelated node", () => {
      const state = editingDirty();
      expect(proseSessionTransition(state, { type: "node-removed", nodeId: "n2" })).toEqual({
        state,
        effects: [],
      });
    });
  });

  it("ignores a dialog choice when no dialog is open", () => {
    const state = editingDirty();
    expect(
      proseSessionTransition(state, {
        type: "dialog-choice",
        dialog: "leave",
        choice: "save",
      }),
    ).toEqual({ state, effects: [] });
    expect(
      proseSessionTransition(state, {
        type: "dialog-choice",
        dialog: "escape",
        choice: "discard",
      }),
    ).toEqual({ state, effects: [] });
  });
});

describe("prompting-escape", () => {
  it("discards the draft on the dialog's Discard choice", () => {
    const { state, effects } = proseSessionTransition(promptEscape(), {
      type: "dialog-choice",
      dialog: "escape",
      choice: "discard",
    });
    expect(state).toEqual(idleProseSession);
    expect(effects).toEqual([{ type: "close-dialog" }, { type: "discard" }]);
  });

  it("returns to editing with the draft intact on Keep editing", () => {
    const draft = proseSessionDraft(promptEscape());
    const { state, effects } = proseSessionTransition(promptEscape(), {
      type: "dialog-choice",
      dialog: "escape",
      choice: "keep-editing",
    });
    expect(state).toEqual({ kind: "editing", draft });
    expect(effects).toEqual([{ type: "close-dialog" }, { type: "refocus", restore: false }]);
  });

  it("treats a second escape (dialog-ESC) as Keep editing — the safe default", () => {
    const { state, effects } = proseSessionTransition(promptEscape(), {
      type: "escape",
    });
    expect(state.kind).toBe("editing");
    expect(proseSessionDraft(state)?.value).toBe(TYPED);
    expect(effects).toEqual([{ type: "close-dialog" }, { type: "refocus", restore: false }]);
  });

  it("ignores a stale choice aimed at the leave dialog", () => {
    const state = promptEscape();
    expect(
      proseSessionTransition(state, {
        type: "dialog-choice",
        dialog: "leave",
        choice: "save",
      }),
    ).toEqual({ state, effects: [] });
  });

  it("ignores outside-intent while the dialog owns the decision", () => {
    const state = promptEscape();
    expect(proseSessionTransition(state, { type: "outside-intent" })).toEqual({
      state,
      effects: [],
    });
  });

  it("still honours an explicit save-click through the single commit path", () => {
    const { state, effects } = proseSessionTransition(promptEscape(), {
      type: "save-click",
    });
    expect(state).toEqual(idleProseSession);
    expect(effects).toEqual([
      { type: "close-dialog" },
      { type: "commit", draft: proseSessionDraft(promptEscape()) },
    ]);
  });

  it("keeps recording keystrokes that land while the dialog is open", () => {
    const state = apply(promptEscape(), { type: "input", value: TYPED_AGAIN });
    expect(state.kind).toBe("prompting-escape");
    expect(proseSessionDraft(state)?.value).toBe(TYPED_AGAIN);
    const { effects } = proseSessionTransition(state, { type: "save-click" });
    expect(commitOf(effects)?.draft.value).toBe(TYPED_AGAIN);
  });

  it("stashes the draft when the editable is torn down under the open dialog", () => {
    const draft = proseSessionDraft(promptEscape());
    const { state, effects } = proseSessionTransition(promptEscape(), {
      type: "mode-switch",
      mode: "preview",
    });
    expect(state).toEqual({ kind: "prompting-escape", draft, stashed: true });
    expect(effects).toEqual([{ type: "stash-draft", draft }]);
  });

  it("asks for a RESTORING refocus when Keep editing follows a stash", () => {
    const { state, effects } = proseSessionTransition(promptEscapeStashed(), {
      type: "dialog-choice",
      dialog: "escape",
      choice: "keep-editing",
    });
    expect(state).toEqual({
      kind: "editing",
      draft: proseSessionDraft(promptEscapeStashed()),
    });
    expect(effects).toEqual([{ type: "close-dialog" }, { type: "refocus", restore: true }]);
  });

  it("does not stash twice", () => {
    const state = promptEscapeStashed();
    expect(proseSessionTransition(state, { type: "mode-switch", mode: "preview" })).toEqual({
      state,
      effects: [],
    });
  });

  it("closes the dialog and discards when the ground moves mid-prompt", () => {
    const { state, effects } = proseSessionTransition(promptEscape(), {
      type: "external-value-change",
      nodeId: NODE,
      fieldKey: FIELD,
      value: "changed elsewhere",
    });
    expect(state).toEqual(idleProseSession);
    expect(effects).toEqual([{ type: "close-dialog" }, { type: "discard" }]);
  });

  it("closes the dialog and discards when the node is removed mid-prompt", () => {
    const { state, effects } = proseSessionTransition(promptEscape(), {
      type: "node-removed",
      nodeId: NODE,
    });
    expect(state).toEqual(idleProseSession);
    expect(effects).toEqual([{ type: "close-dialog" }, { type: "discard" }]);
  });
});

describe("prompting-leave", () => {
  it("commits on the dialog's Save choice, via the same commit path as the button", () => {
    const fromDialog = proseSessionTransition(promptLeave(), {
      type: "dialog-choice",
      dialog: "leave",
      choice: "save",
    });
    const fromButton = proseSessionTransition(editingDirty(), {
      type: "save-click",
    });

    expect(fromDialog.state).toEqual(idleProseSession);
    expect(commitOf(fromDialog.effects)).toEqual(commitOf(fromButton.effects));
    expect(fromDialog.effects).toEqual([
      { type: "close-dialog" },
      { type: "commit", draft: proseSessionDraft(promptLeave()) },
    ]);
  });

  it("discards on the dialog's Discard choice", () => {
    const { state, effects } = proseSessionTransition(promptLeave(), {
      type: "dialog-choice",
      dialog: "leave",
      choice: "discard",
    });
    expect(state).toEqual(idleProseSession);
    expect(effects).toEqual([{ type: "close-dialog" }, { type: "discard" }]);
  });

  it("returns to editing and refocuses on Keep editing", () => {
    const { state, effects } = proseSessionTransition(promptLeave(), {
      type: "dialog-choice",
      dialog: "leave",
      choice: "keep-editing",
    });
    expect(state).toEqual({
      kind: "editing",
      draft: proseSessionDraft(promptLeave()),
    });
    expect(effects).toEqual([{ type: "close-dialog" }, { type: "refocus", restore: false }]);
  });

  it("treats escape as Keep editing rather than escalating to a second dialog", () => {
    const { state, effects } = proseSessionTransition(promptLeave(), {
      type: "escape",
    });
    expect(state).toEqual({
      kind: "editing",
      draft: proseSessionDraft(promptLeave()),
    });
    expect(effects).toEqual([{ type: "close-dialog" }, { type: "refocus", restore: false }]);
  });

  it("ignores a repeated outside-intent instead of stacking prompts", () => {
    const state = promptLeave();
    expect(proseSessionTransition(state, { type: "outside-intent" })).toEqual({
      state,
      effects: [],
    });
  });

  it("ignores a stale choice aimed at the escape dialog", () => {
    const state = promptLeave();
    expect(
      proseSessionTransition(state, {
        type: "dialog-choice",
        dialog: "escape",
        choice: "discard",
      }),
    ).toEqual({ state, effects: [] });
  });

  describe("stashed (mode switched away mid-edit)", () => {
    it("commits the STASHED draft with its original session-start revision", () => {
      const { state, effects } = proseSessionTransition(promptLeaveStashed(), {
        type: "dialog-choice",
        dialog: "leave",
        choice: "save",
      });
      expect(state).toEqual(idleProseSession);
      expect(commitOf(effects)).toEqual({
        type: "commit",
        draft: {
          nodeId: NODE,
          fieldKey: FIELD,
          initialValue: SEED,
          value: TYPED,
          startRevision: REV,
        },
      });
    });

    it("asks for a restoring refocus on Keep editing", () => {
      const { state, effects } = proseSessionTransition(promptLeaveStashed(), {
        type: "dialog-choice",
        dialog: "leave",
        choice: "keep-editing",
      });
      expect(state.kind).toBe("editing");
      expect(effects).toEqual([{ type: "close-dialog" }, { type: "refocus", restore: true }]);
    });

    it("discards the stash on Discard", () => {
      const { state, effects } = proseSessionTransition(promptLeaveStashed(), {
        type: "dialog-choice",
        dialog: "leave",
        choice: "discard",
      });
      expect(state).toEqual(idleProseSession);
      expect(effects).toEqual([{ type: "close-dialog" }, { type: "discard" }]);
    });
  });
});

describe("double-stimulus sequences", () => {
  it("escape → outside-intent keeps the ESCAPE dialog (no second prompt)", () => {
    const state = apply(editingDirty(), { type: "escape" }, { type: "outside-intent" });
    expect(state.kind).toBe("prompting-escape");
  });

  it("outside-intent → escape returns to editing without losing the draft", () => {
    const state = apply(editingDirty(), { type: "outside-intent" }, { type: "escape" });
    expect(state).toEqual({
      kind: "editing",
      draft: proseSessionDraft(editingDirty()),
    });
  });

  it("outside-intent → keep-editing → escape re-prompts with the escape dialog", () => {
    const state = apply(
      editingDirty(),
      { type: "outside-intent" },
      { type: "dialog-choice", dialog: "leave", choice: "keep-editing" },
      { type: "escape" },
    );
    expect(state).toEqual({
      kind: "prompting-escape",
      draft: proseSessionDraft(editingDirty()),
      stashed: false,
    });
  });

  it("rapid repeated save-clicks commit exactly once", () => {
    const first = proseSessionTransition(editingDirty(), {
      type: "save-click",
    });
    const second = proseSessionTransition(first.state, { type: "save-click" });
    expect(commitOf(first.effects)).toBeDefined();
    expect(second.effects).toEqual([]);
  });

  it("rapid repeated escapes settle on editing, never on a discard", () => {
    const dirty = editingDirty();
    const once = proseSessionTransition(dirty, { type: "escape" });
    const twice = proseSessionTransition(once.state, { type: "escape" });
    const thrice = proseSessionTransition(twice.state, { type: "escape" });
    expect(twice.state.kind).toBe("editing");
    expect(thrice.state.kind).toBe("prompting-escape");
    expect([...once.effects, ...twice.effects, ...thrice.effects]).not.toContainEqual({
      type: "discard",
    });
  });

  it("dirty → clean → leave stimulus stops prompting again", () => {
    const cleanAgain = apply(
      editingDirty(),
      { type: "escape" },
      { type: "dialog-choice", dialog: "escape", choice: "keep-editing" },
      { type: "input", value: SEED },
    );
    const { state, effects } = proseSessionTransition(cleanAgain, {
      type: "outside-intent",
    });
    expect(state).toEqual(idleProseSession);
    expect(effects).toEqual([{ type: "discard" }]);
  });

  it("mode-switch mid-prompt then Save still routes through one commit", () => {
    const stashedMidPrompt = apply(
      editingDirty(),
      { type: "outside-intent" },
      { type: "mode-switch", mode: "preview" },
    );
    expect(stashedMidPrompt).toEqual({
      kind: "prompting-leave",
      draft: proseSessionDraft(editingDirty()),
      stashed: true,
    });
    const { effects } = proseSessionTransition(stashedMidPrompt, {
      type: "dialog-choice",
      dialog: "leave",
      choice: "save",
    });
    expect(commitOf(effects)?.draft.startRevision).toBe(REV);
  });

  it("mode-switch under a prompt whose draft went clean exits silently instead of stashing", () => {
    const cleanUnderPrompt = apply(promptEscape(), {
      type: "input",
      value: SEED,
    });
    const { state, effects } = proseSessionTransition(cleanUnderPrompt, {
      type: "mode-switch",
      mode: "preview",
    });
    expect(state).toEqual(idleProseSession);
    expect(effects).toEqual([{ type: "close-dialog" }, { type: "discard" }]);
  });

  it("external change while prompting wins over a later dialog choice (session is gone)", () => {
    const dead = apply(promptLeave(), {
      type: "external-value-change",
      nodeId: NODE,
      fieldKey: FIELD,
      value: "changed elsewhere",
    });
    expect(dead).toEqual(idleProseSession);
    expect(
      proseSessionTransition(dead, {
        type: "dialog-choice",
        dialog: "leave",
        choice: "save",
      }).effects,
    ).toEqual([]);
  });
});

// ── Graph-wide properties ──────────────────────────────────────────────────
// Explore every reachable state under a fixed stimulus alphabet and assert the
// module's invariants on EVERY edge, so a future transition cannot quietly
// introduce an implicit commit or a silently dropped draft.

const ALPHABET: readonly ProseSessionInput[] = [
  START,
  {
    type: "start",
    nodeId: "n2",
    fieldKey: "other",
    value: "x",
    startRevision: 99,
  },
  { type: "input", value: SEED },
  { type: "input", value: TYPED },
  { type: "input", value: TYPED_AGAIN },
  { type: "escape" },
  { type: "save-click" },
  { type: "outside-intent" },
  {
    type: "external-value-change",
    nodeId: NODE,
    fieldKey: FIELD,
    value: "moved",
  },
  { type: "external-value-change", nodeId: NODE, fieldKey: FIELD, value: SEED },
  {
    type: "external-value-change",
    nodeId: NODE,
    fieldKey: "heading",
    value: "moved",
  },
  {
    type: "external-value-change",
    nodeId: "n2",
    fieldKey: FIELD,
    value: "moved",
  },
  { type: "node-removed", nodeId: NODE },
  { type: "node-removed", nodeId: "n2" },
  { type: "mode-switch", mode: "preview" },
  { type: "mode-switch", mode: "edit" },
  { type: "dialog-choice", dialog: "escape", choice: "discard" },
  { type: "dialog-choice", dialog: "escape", choice: "keep-editing" },
  { type: "dialog-choice", dialog: "leave", choice: "save" },
  { type: "dialog-choice", dialog: "leave", choice: "discard" },
  { type: "dialog-choice", dialog: "leave", choice: "keep-editing" },
];

interface Edge {
  readonly from: ProseSessionState;
  readonly input: ProseSessionInput;
  readonly to: ProseSessionState;
  readonly effects: readonly ProseSessionEffect[];
}

function exploreReachableGraph(): {
  edges: Edge[];
  states: ProseSessionState[];
} {
  const seen = new Map<string, ProseSessionState>();
  const queue: ProseSessionState[] = [idleProseSession];
  const edges: Edge[] = [];
  seen.set(JSON.stringify(idleProseSession), idleProseSession);

  while (queue.length > 0) {
    const from = queue.shift() as ProseSessionState;
    for (const input of ALPHABET) {
      const { state: to, effects } = proseSessionTransition(from, input);
      edges.push({ from, input, to, effects });
      const key = JSON.stringify(to);
      if (!seen.has(key)) {
        seen.set(key, to);
        queue.push(to);
      }
    }
  }
  return { edges, states: [...seen.values()] };
}

const { edges, states } = exploreReachableGraph();

const isDirtyState = (state: ProseSessionState): boolean => proseSessionIsDirty(state);
const has = (effects: readonly ProseSessionEffect[], type: ProseSessionEffect["type"]): boolean =>
  effects.some((e) => e.type === type);

describe("reachable graph", () => {
  it("reaches every documented state shape, and no others", () => {
    const shapes = new Set(
      states.map((s) =>
        s.kind === "prompting-escape" || s.kind === "prompting-leave"
          ? `${s.kind}${s.stashed ? ":stashed" : ""}`
          : s.kind,
      ),
    );
    expect([...shapes].sort()).toEqual([
      "editing",
      "idle",
      "prompting-escape",
      "prompting-escape:stashed",
      "prompting-leave",
      "prompting-leave:stashed",
    ]);
  });

  it("PROPERTY: no path reaches commit except save-click or the leave dialog's Save", () => {
    for (const edge of edges) {
      if (!has(edge.effects, "commit")) continue;
      const explicit =
        edge.input.type === "save-click" ||
        (edge.input.type === "dialog-choice" &&
          edge.input.dialog === "leave" &&
          edge.input.choice === "save");
      expect({ input: edge.input, explicit }).toEqual({
        input: edge.input,
        explicit: true,
      });
    }
    // Guard against a vacuous pass.
    expect(edges.filter((e) => has(e.effects, "commit")).length).toBeGreaterThan(0);
  });

  it("PROPERTY: a dirty draft is only dropped by a dialog Discard or the two documented silent cases", () => {
    for (const edge of edges) {
      if (!isDirtyState(edge.from) || !has(edge.effects, "discard")) continue;
      const sanctioned =
        edge.input.type === "external-value-change" ||
        edge.input.type === "node-removed" ||
        (edge.input.type === "dialog-choice" && edge.input.choice === "discard");
      expect({ input: edge.input, sanctioned }).toEqual({
        input: edge.input,
        sanctioned: true,
      });
    }
  });

  it("PROPERTY: a dirty draft never vanishes without a terminal effect", () => {
    for (const edge of edges) {
      if (!isDirtyState(edge.from)) continue;
      const survives = proseSessionDraft(edge.to)?.value === proseSessionDraft(edge.from)?.value;
      const terminated = has(edge.effects, "commit") || has(edge.effects, "discard");
      // The one non-terminal value change is the user typing.
      expect(survives || terminated || edge.input.type === "input").toBe(true);
    }
  });

  it("PROPERTY: commit and discard are mutually exclusive, and mean exactly 'session over'", () => {
    for (const edge of edges) {
      expect(has(edge.effects, "commit") && has(edge.effects, "discard")).toBe(false);
      const terminated = has(edge.effects, "commit") || has(edge.effects, "discard");
      expect(terminated).toBe(edge.to.kind === "idle" && edge.from.kind !== "idle");
    }
  });

  it("PROPERTY: a commit always carries its own session's draft and never a no-op value", () => {
    // The revision is the SESSION's, captured at start — see the immutability
    // property below for the proof that it is never re-derived en route.
    for (const edge of edges) {
      const commit = commitOf(edge.effects);
      if (!commit) continue;
      expect(commit.draft).toEqual(proseSessionDraft(edge.from));
      expect(commit.draft.value).not.toBe(commit.draft.initialValue);
    }
  });

  it("PROPERTY: dialogs open and close in step with the prompting states", () => {
    for (const edge of edges) {
      const showed = edge.effects.find((e) => e.type === "show-dialog");
      if (showed) {
        expect(edge.to.kind).toBe(`prompting-${showed.dialog}`);
        expect(edge.from.kind).toBe("editing");
      }
      const wasPrompting = edge.from.kind.startsWith("prompting");
      const stillSamePrompt = edge.from.kind === edge.to.kind;
      expect(has(edge.effects, "close-dialog")).toBe(wasPrompting && !stillSamePrompt);
      expect(has(edge.effects, "show-dialog") && has(edge.effects, "close-dialog")).toBe(false);
    }
  });

  it("PROPERTY: refocus only returns to editing, and asks to restore exactly when stashed", () => {
    for (const edge of edges) {
      const refocus = edge.effects.find((e) => e.type === "refocus");
      if (!refocus) continue;
      expect(edge.to.kind).toBe("editing");
      const fromStashed =
        (edge.from.kind === "prompting-escape" || edge.from.kind === "prompting-leave") &&
        edge.from.stashed;
      expect(refocus.restore).toBe(fromStashed);
    }
  });

  it("PROPERTY: the draft's identity and session-start facts are immutable for a session's life", () => {
    for (const edge of edges) {
      const from = proseSessionDraft(edge.from);
      const to = proseSessionDraft(edge.to);
      if (!from || !to) continue;
      expect({
        nodeId: to.nodeId,
        fieldKey: to.fieldKey,
        initialValue: to.initialValue,
        startRevision: to.startRevision,
      }).toEqual({
        nodeId: from.nodeId,
        fieldKey: from.fieldKey,
        initialValue: from.initialValue,
        startRevision: from.startRevision,
      });
    }
  });

  it("PROPERTY: stash-draft is emitted exactly once per session, only as the editable is torn down", () => {
    for (const edge of edges) {
      if (!has(edge.effects, "stash-draft")) continue;
      expect(edge.input).toEqual({ type: "mode-switch", mode: "preview" });
      expect(isDirtyState(edge.from)).toBe(true);
      expect(edge.to.kind.startsWith("prompting")).toBe(true);
      expect((edge.to as { stashed: boolean }).stashed).toBe(true);
      expect((edge.from as { stashed?: boolean }).stashed ?? false).toBe(false);
    }
  });
});
