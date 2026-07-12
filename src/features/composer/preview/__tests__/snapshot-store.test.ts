import { describe, expect, it } from "vitest";
import { SAMPLE_DOCUMENT, createSampleDocument } from "@/composer";
import { modeMessage, renderMessage, type PreviewSession } from "../protocol";
import { INITIAL_PREVIEW_STATE, applyInbound } from "../snapshot-store";

const EDIT: PreviewSession = { mode: "edit", theme: "light", selectedId: null };
const PREVIEW: PreviewSession = { mode: "preview", theme: "dark", selectedId: "split-1" };

describe("applyInbound — the revision guard", () => {
  it("a freshly booted document accepts the first message whatever its revision", () => {
    // This is what makes the post-reload replay work: the parent replays its
    // newest snapshot at its EXISTING (high) revision, and the fresh document
    // starts at -1.
    const next = applyInbound(INITIAL_PREVIEW_STATE, renderMessage(97, SAMPLE_DOCUMENT, EDIT));
    expect(next?.revision).toBe(97);
    expect(next?.document).toBe(SAMPLE_DOCUMENT);
  });

  it("applies a NEWER revision", () => {
    const first = applyInbound(INITIAL_PREVIEW_STATE, renderMessage(1, SAMPLE_DOCUMENT, EDIT));
    expect(first).not.toBeNull();
    const newer = createSampleDocument();
    newer.name = "newer";
    const second = applyInbound(first!, renderMessage(2, newer, EDIT));
    expect(second?.document?.name).toBe("newer");
  });

  it("IGNORES a stale revision entirely — an older snapshot never wins", () => {
    const newest = createSampleDocument();
    newest.name = "newest";
    const state = applyInbound(INITIAL_PREVIEW_STATE, renderMessage(5, newest, EDIT))!;

    const older = createSampleDocument();
    older.name = "older";
    expect(applyInbound(state, renderMessage(4, older, PREVIEW))).toBeNull();
    expect(applyInbound(state, renderMessage(0, older, PREVIEW))).toBeNull();
    // Not even the session half of a stale message leaks through.
    expect(state.document?.name).toBe("newest");
    expect(state.session.mode).toBe("edit");
  });

  it("IGNORES a message that repeats the current revision", () => {
    const state = applyInbound(INITIAL_PREVIEW_STATE, renderMessage(3, SAMPLE_DOCUMENT, EDIT))!;
    expect(applyInbound(state, renderMessage(3, SAMPLE_DOCUMENT, PREVIEW))).toBeNull();
  });

  it("a mode message updates the session and KEEPS the document on screen", () => {
    const state = applyInbound(INITIAL_PREVIEW_STATE, renderMessage(1, SAMPLE_DOCUMENT, EDIT))!;
    const next = applyInbound(state, modeMessage(2, PREVIEW))!;
    expect(next.session).toEqual(PREVIEW);
    expect(next.document).toBe(SAMPLE_DOCUMENT);
    expect(next.revision).toBe(2);
  });

  it("a mode message arriving BEFORE any document records the session only", () => {
    const next = applyInbound(INITIAL_PREVIEW_STATE, modeMessage(0, PREVIEW))!;
    expect(next.document).toBeNull();
    expect(next.session).toEqual(PREVIEW);
  });

  it("a stale mode message is ignored", () => {
    const state = applyInbound(INITIAL_PREVIEW_STATE, renderMessage(9, SAMPLE_DOCUMENT, EDIT))!;
    expect(applyInbound(state, modeMessage(8, PREVIEW))).toBeNull();
  });

  it("never mutates the state it is given", () => {
    const state = applyInbound(INITIAL_PREVIEW_STATE, renderMessage(1, SAMPLE_DOCUMENT, EDIT))!;
    const snapshot = JSON.parse(JSON.stringify(state));
    applyInbound(state, modeMessage(2, PREVIEW));
    expect(JSON.parse(JSON.stringify(state))).toEqual(snapshot);
  });
});
