/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// Manifest-derivation regression test (issue #290): `createManifest(entries)`
// used to be independently re-derived at THREE call sites for the exact same
// `manifestEntries` array — once at the app layer (`useComposerIntegration`,
// feeding the controller), and once more inside EACH of `ComposerTree` and
// `ComposerChooser` via `buildManifestIndex`, a one-line `createManifest`
// pass-through (see `tree-helpers.ts`). Both UI components now receive the
// app layer's already-derived `ComponentManifest` as a `manifest` prop
// instead. This suite spies on `@/composer`'s `createManifest` to prove it
// runs exactly ONCE per `manifestEntries` identity — not once per render, and
// not once per consumer (controller + tree + chooser).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";
import { render } from "@testing-library/preact";
import { createSequentialIdFactory } from "@/composer";
import { readyMessage, selectMessage } from "@/features/composer/preview/protocol";
import { ComposerIntegration } from "../composer-integration";
import { makeTestBridge } from "../test-support/preview-harness";
import { fixtureCatalog, makeAbcDocument, resetFixtureIds } from "../../ui/tree/__tests__/fixtures";

// `vi.mock` factories are hoisted above every import/const in this file, so
// the spy itself must be created inside `vi.hoisted` to exist by the time the
// factory below runs.
const { createManifestSpy } = vi.hoisted(() => ({ createManifestSpy: vi.fn() }));

vi.mock("@/composer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/composer")>();
  return {
    ...actual,
    createManifest: (...args: Parameters<typeof actual.createManifest>) => {
      createManifestSpy(...args);
      return actual.createManifest(...args);
    },
  };
});

let rev = 5000;

beforeEach(() => {
  localStorage.clear();
  createManifestSpy.mockClear();
});

describe("ComposerIntegration — createManifest derives once at the app layer (#290)", () => {
  it("calls createManifest exactly once for the initial manifestEntries (not once per controller/tree/chooser consumer)", () => {
    resetFixtureIds();
    const bridge = makeTestBridge();
    render(
      <ComposerIntegration
        manifestEntries={fixtureCatalog}
        controllerOptions={{ sample: makeAbcDocument(), idFactory: createSequentialIdFactory("n") }}
        createBridge={bridge.createBridge}
        previewLocation={bridge.location}
      />,
    );
    act(() => bridge.deliver(readyMessage()));

    expect(createManifestSpy).toHaveBeenCalledTimes(1);
    expect(createManifestSpy).toHaveBeenCalledWith(fixtureCatalog);
  });

  it("does not re-derive on an unrelated rerender (a canvas selection change)", () => {
    resetFixtureIds();
    const bridge = makeTestBridge();
    const document = makeAbcDocument();
    render(
      <ComposerIntegration
        manifestEntries={fixtureCatalog}
        controllerOptions={{ sample: document, idFactory: createSequentialIdFactory("n") }}
        createBridge={bridge.createBridge}
        previewLocation={bridge.location}
      />,
    );
    act(() => bridge.deliver(readyMessage()));
    expect(createManifestSpy).toHaveBeenCalledTimes(1);

    // `document.root[0]` is "split" per `makeAbcDocument` (see fixtures) — a
    // canvas-originated selection is an unrelated state change that rerenders
    // the whole tree, chooser, and controller without touching `manifestEntries`.
    act(() => bridge.deliver(selectMessage(rev++, document.root[0]!.id)));

    expect(createManifestSpy).toHaveBeenCalledTimes(1);
  });

  it("re-derives exactly once more when manifestEntries changes identity", () => {
    resetFixtureIds();
    const bridge = makeTestBridge();
    const { rerender } = render(
      <ComposerIntegration
        manifestEntries={fixtureCatalog}
        controllerOptions={{ sample: makeAbcDocument(), idFactory: createSequentialIdFactory("n") }}
        createBridge={bridge.createBridge}
        previewLocation={bridge.location}
      />,
    );
    act(() => bridge.deliver(readyMessage()));
    expect(createManifestSpy).toHaveBeenCalledTimes(1);

    // A fresh array with the same entries — a new identity, the only thing
    // `useMemo`'s dependency array in `useComposerIntegration` tracks.
    const nextEntries = [...fixtureCatalog];
    rerender(
      <ComposerIntegration
        manifestEntries={nextEntries}
        controllerOptions={{ sample: makeAbcDocument(), idFactory: createSequentialIdFactory("n") }}
        createBridge={bridge.createBridge}
        previewLocation={bridge.location}
      />,
    );

    expect(createManifestSpy).toHaveBeenCalledTimes(2);
    expect(createManifestSpy).toHaveBeenLastCalledWith(nextEntries);
  });
});
