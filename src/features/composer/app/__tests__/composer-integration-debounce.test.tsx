/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// End-to-end proof of the debounced inspector commit path (issue #291),
// through the REAL wiring: inspector field → integration → controller →
// storage + preview bridge. A keystroke burst must produce ONE trailing
// persist + ONE trailing canvas render (the #259 hot path ran per keystroke
// before), while every deterministic flush path — blur, Edit→Preview mode
// switch, export/JSX generation, unmount — lands the pending commit with NO
// timer involved, so the final value can never be lost.
//
// Fake timers are restricted to setTimeout/clearTimeout (the debounce's own
// primitives) so Preact scheduling and the bridge stay on real plumbing, and
// are enabled only AFTER the initial render/ready handshake.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "preact/test-utils";
import { fireEvent, render, screen, within } from "@testing-library/preact";
import type { CompositionDocument } from "@/composer";
import { createSequentialIdFactory } from "@/composer";
import { readyMessage } from "@/features/composer/preview/protocol";
import {
  COMPOSER_DOCUMENT_STORAGE_KEY,
} from "@/features/composer/chrome/storage";
import { INSPECTOR_COMMIT_DEBOUNCE_MS } from "@/features/composer/chrome/use-composer-controller";
import { ComposerIntegration } from "../composer-integration";
import { makeTestBridge } from "../test-support/preview-harness";
import { FIXTURE_IDS, fixtureCatalog, fixtureDocument, fixtureNode, resetFixtureIds } from "../../ui/tree/__tests__/fixtures";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAny = (v: unknown) => v as any;

function boxDoc(): CompositionDocument {
  return fixtureDocument([fixtureNode(FIXTURE_IDS.box, { label: "Box" }, {}, "box1")], "Debounce Doc");
}

function persistedLabel(): unknown {
  const doc = JSON.parse(localStorage.getItem(COMPOSER_DOCUMENT_STORAGE_KEY)!);
  return doc.root[0].props.label;
}

function setup() {
  resetFixtureIds();
  const bridge = makeTestBridge();
  const utils = render(
    <ComposerIntegration
      manifestEntries={fixtureCatalog}
      controllerOptions={{ sample: boxDoc(), idFactory: createSequentialIdFactory("n") }}
      createBridge={bridge.createBridge}
      previewLocation={bridge.location}
    />,
  );
  act(() => bridge.deliver(readyMessage()));

  const region = (selector: string) => utils.container.querySelector(selector) as HTMLElement;
  const tree = () => region("#sg-composer-tree");
  const inspector = () => region("#sg-composer-inspector");
  const toolbar = () => screen.getByRole("toolbar", { name: "Composer toolbar" });
  const renders = () => bridge.posts.filter((p) => asAny(p.message).type === "render");
  const canvasLabel = () => asAny(renders().at(-1)!.message).document.root[0]?.props.label;

  // Select the box so the inspector shows its Label field (the tree select
  // button's accessible name is "<title> <subtitle>" — see tree-node.tsx).
  fireEvent.click(within(tree()).getByRole("button", { name: /^Box/ }));
  const label = () => within(inspector()).getByLabelText("Label") as HTMLInputElement;

  // Fake timers ON only after the handshake/selection is settled.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  function typeBurst(values: string[]) {
    for (const value of values) fireEvent.input(label(), { target: { value } });
  }

  return { ...utils, bridge, tree, inspector, toolbar, renders, canvasLabel, label, typeBurst };
}

beforeEach(() => localStorage.clear());

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ComposerIntegration — debounced inspector commits (#291)", () => {
  it("a keystroke burst produces ONE trailing persist + ONE trailing canvas render, with the final value", () => {
    const s = setup();
    const rendersBefore = s.renders().length;
    const setItem = vi.spyOn(localStorage, "setItem");

    s.typeBurst(["R", "Re", "Renamed"]);

    // Mid-burst: the draft is live but nothing expensive ran yet.
    expect(s.label().value).toBe("Renamed"); // zero input lag
    expect(s.renders().length).toBe(rendersBefore);
    expect(setItem.mock.calls.filter(([k]) => k === COMPOSER_DOCUMENT_STORAGE_KEY)).toHaveLength(0);

    act(() => vi.advanceTimersByTime(INSPECTOR_COMMIT_DEBOUNCE_MS));

    // Trailing edge: exactly one render + one persist, both with the final value.
    expect(s.renders().length).toBe(rendersBefore + 1);
    expect(s.canvasLabel()).toBe("Renamed");
    const writes = setItem.mock.calls.filter(([k]) => k === COMPOSER_DOCUMENT_STORAGE_KEY);
    expect(writes).toHaveLength(1);
    expect(persistedLabel()).toBe("Renamed");
  });

  it("blur flushes the pending commit without waiting for the timer", () => {
    const s = setup();
    s.typeBurst(["Blurred value"]);
    expect(persistedLabel()).toBe("Box");

    fireEvent.blur(s.label());

    expect(persistedLabel()).toBe("Blurred value");
    expect(s.canvasLabel()).toBe("Blurred value");
  });

  it("switching Edit→Preview flushes the pending commit without waiting for the timer", () => {
    const s = setup();
    s.typeBurst(["Mode switched"]);
    expect(persistedLabel()).toBe("Box");

    fireEvent.click(within(s.toolbar()).getByRole("button", { name: "Preview" }));

    expect(persistedLabel()).toBe("Mode switched");
    expect(s.canvasLabel()).toBe("Mode switched");
  });

  it("rapid type-then-export: the exported JSX contains the last keystroke", () => {
    const s = setup();
    s.typeBurst(["L", "La", "Last keystroke"]);

    fireEvent.click(within(s.toolbar()).getByRole("button", { name: "Export JSX" }));

    const code = screen.getByRole("dialog").querySelector("pre")!.textContent ?? "";
    expect(code).toContain("Last keystroke");
    expect(persistedLabel()).toBe("Last keystroke");
  });

  it("unmounting the composer flushes the pending commit to storage", () => {
    const s = setup();
    s.typeBurst(["Almost lost"]);
    expect(persistedLabel()).toBe("Box");

    s.unmount();

    expect(persistedLabel()).toBe("Almost lost");
  });
});
