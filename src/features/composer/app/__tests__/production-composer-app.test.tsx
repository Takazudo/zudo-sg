/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory as FDBFactory } from "fake-indexeddb";
import {
  COMPOSITION_PROVIDERS,
  CompositionPersistenceError,
  createSampleDocument,
  createIndexedDbCompositionProvider,
  summarizeComposition,
  type CompositionInitializationOutcome,
  type CompositionProvider,
  type CompositionRecord,
} from "@/composer";
import {
  ProductionComposerApp,
  createProductionComposerProviders,
  type ComposerBrowserNavigation,
} from "../production-composer-app";

const TIMESTAMP = "2026-07-14T00:00:00.000Z";
const PREVIEW = {
  previewLocation: { src: "about:blank", targetOrigin: "https://composer.test" },
} as const;

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  return {
    promise: new Promise<T>((done) => {
      resolve = done;
    }),
    resolve: (value) => resolve(value),
  };
}

function record(id: string, name: string): CompositionRecord {
  const document = createSampleDocument();
  document.id = id;
  document.name = name;
  return { id, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, document };
}

function ready(records: Map<string, CompositionRecord>): CompositionInitializationOutcome {
  return { status: "ready", summaries: [...records.values()].map(summarizeComposition) };
}

function memoryProvider(
  providerId: "indexeddb" | "files",
  initial: readonly CompositionRecord[],
  overrides: {
    initialize?: () => Promise<CompositionInitializationOutcome>;
    put?: (value: CompositionRecord) => Promise<void>;
  } = {},
): CompositionProvider & { records: Map<string, CompositionRecord> } {
  const records = new Map(initial.map((value) => [value.id, structuredClone(value)]));
  const descriptor = COMPOSITION_PROVIDERS[providerId];
  const initialize = overrides.initialize ?? (async () => ready(records));
  return {
    records,
    descriptor,
    initialization: { initialize, retry: initialize, startFresh: initialize },
    store: {
      provider: descriptor,
      list: vi.fn(async () => [...records.values()].map(summarizeComposition)),
      get: vi.fn(async (id) => {
        const value = records.get(id);
        return value
          ? { status: "loaded" as const, record: structuredClone(value) }
          : { status: "not-found" as const, id };
      }),
      put: vi.fn(async (value) => {
        if (overrides.put) await overrides.put(value);
        records.set(value.id, structuredClone(value));
      }),
      delete: vi.fn(async (id) => records.delete(id)),
      clear: vi.fn(async () => records.clear()),
    },
  };
}

class FakeNavigation implements ComposerBrowserNavigation {
  private location: { pathname: string; hash: string };
  private readonly listeners = new Set<() => void>();
  readonly pushes: string[] = [];
  readonly replacements: string[] = [];

  constructor(url = "/composer/#/") {
    this.location = this.parse(url);
  }

  read() {
    return this.location;
  }

  push(url: string): void {
    this.pushes.push(url);
    this.location = this.parse(url);
  }

  replace(url: string): void {
    this.replacements.push(url);
    this.location = this.parse(url);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  visit(url: string): void {
    this.location = this.parse(url);
    for (const listener of this.listeners) listener();
  }

  private parse(url: string) {
    const parsed = new URL(url, "https://example.test");
    return { pathname: parsed.pathname, hash: parsed.hash };
  }
}

afterEach(() => {
  localStorage.clear();
});

describe("ProductionComposerApp", () => {
  it("registers only IndexedDB when the dev file capability is absent", () => {
    expect(createProductionComposerProviders().map(({ descriptor }) => descriptor.id)).toEqual([
      "indexeddb",
    ]);
  });

  it("normalizes the document URL and keeps same record ids isolated by provider", async () => {
    const indexeddb = memoryProvider("indexeddb", [record("same", "Browser copy")]);
    const files = memoryProvider("files", [record("same", "File copy")]);
    const navigation = new FakeNavigation("/composer");
    const view = render(
      <ProductionComposerApp providers={[indexeddb, files]} navigation={navigation} preview={PREVIEW} />,
    );

    expect(await screen.findByRole("heading", { name: "Compositions" })).toBeInTheDocument();
    expect(navigation.replacements).toContain("/composer/#/");
    expect(screen.getByRole("option", { name: "Local files" })).toBeInTheDocument();

    view.unmount();
    navigation.visit("/composer/#/composition/files/same");
    render(<ProductionComposerApp providers={[indexeddb, files]} navigation={navigation} preview={PREVIEW} />);

    expect(await screen.findByRole("button", { name: "Library" })).toBeInTheDocument();
    expect(screen.getAllByText("File copy").length).toBeGreaterThan(0);
    expect(indexeddb.store.get).not.toHaveBeenCalled();
    expect(files.store.get).toHaveBeenCalledWith("same");
  });

  it("creates an empty unbound schema-v2 record only after New-dialog confirmation", async () => {
    const indexeddb = memoryProvider("indexeddb", []);
    const navigation = new FakeNavigation();
    render(
      <ProductionComposerApp
        providers={[indexeddb]}
        navigation={navigation}
        idFactory={() => "ordinary"}
        now={() => TIMESTAMP}
        preview={PREVIEW}
      />,
    );
    await screen.findByRole("heading", { name: "Compositions" });

    fireEvent.click(screen.getAllByRole("button", { name: "New composition" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "New composition" });
    expect(indexeddb.records.has("ordinary")).toBe(false);
    fireEvent.input(within(dialog).getByRole("textbox", { name: "Name" }), { target: { value: " Ordinary page " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create composition" }));

    expect(await screen.findByRole("button", { name: "Library" })).toBeInTheDocument();
    expect(indexeddb.records.get("ordinary")?.document).toMatchObject({
      schemaVersion: 2,
      id: "ordinary",
      name: "Ordinary page",
      root: [],
    });
    expect(indexeddb.records.get("ordinary")?.document.binding).toBeUndefined();
    expect(navigation.pushes.at(-1)).toBe("/composer/#/composition/indexeddb/ordinary");
  });

  it("re-resolves a selected same-provider Global template, then persists only its source and outlet binding", async () => {
    const template = record("site-shell", "Site shell");
    template.document.publication = {
      kind: "global-template",
      outlet: {
        id: "main",
        label: "Main content",
        target: { parentId: "split-1", slotId: "right" },
      },
    };
    const indexeddb = memoryProvider("indexeddb", [template]);
    const navigation = new FakeNavigation();
    render(
      <ProductionComposerApp
        providers={[indexeddb]}
        navigation={navigation}
        idFactory={() => "bound-page"}
        now={() => TIMESTAMP}
        preview={PREVIEW}
      />,
    );
    await screen.findByRole("heading", { name: "Compositions" });
    fireEvent.click(screen.getAllByRole("button", { name: "New composition" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "New composition" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Site shell/ }));
    fireEvent.input(within(dialog).getByRole("textbox", { name: "Name" }), { target: { value: "Bound page" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create composition" }));

    expect(await screen.findByRole("button", { name: "Library" })).toBeInTheDocument();
    expect(indexeddb.records.get("bound-page")?.document).toMatchObject({
      schemaVersion: 2,
      id: "bound-page",
      name: "Bound page",
      root: [],
      binding: { sourceRecordId: "site-shell", outletId: "main" },
    });
  });

  it("keeps the New dialog open and does not save when the selected template is deleted before submit", async () => {
    const template = record("site-shell", "Site shell");
    template.document.publication = {
      kind: "global-template",
      outlet: {
        id: "main",
        label: "Main content",
        target: { parentId: "split-1", slotId: "right" },
      },
    };
    const indexeddb = memoryProvider("indexeddb", [template]);
    render(
      <ProductionComposerApp
        providers={[indexeddb]}
        navigation={new FakeNavigation()}
        idFactory={() => "never-saved"}
        now={() => TIMESTAMP}
        preview={PREVIEW}
      />,
    );
    await screen.findByRole("heading", { name: "Compositions" });
    fireEvent.click(screen.getAllByRole("button", { name: "New composition" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "New composition" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Site shell/ }));
    indexeddb.records.delete("site-shell");
    vi.mocked(indexeddb.store.put).mockClear();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create composition" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("selected Global template changed");
    expect(indexeddb.store.put).not.toHaveBeenCalled();
    expect(indexeddb.records.has("never-saved")).toBe(false);
  });

  it("persists a record-scoped edit before returning to the library", async () => {
    const indexeddb = memoryProvider("indexeddb", [record("alpha", "Alpha")]);
    const navigation = new FakeNavigation("/composer/#/composition/indexeddb/alpha");
    render(<ProductionComposerApp providers={[indexeddb]} navigation={navigation} preview={PREVIEW} />);

    await screen.findByRole("button", { name: "Library" });
    fireEvent.click(screen.getByRole("button", { name: "Reset sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Library" }));

    expect(await screen.findByRole("heading", { name: "Compositions" })).toBeInTheDocument();
    await waitFor(() => expect(indexeddb.store.put).toHaveBeenCalled());
    expect(navigation.pushes.at(-1)).toBe("/composer/#/");
    expect(indexeddb.records.get("alpha")?.id).toBe("alpha");
    expect(indexeddb.records.get("alpha")?.document.id).toBe("alpha");
  });

  it("persists index-to-detail edits across a fresh mount with the real IndexedDB provider", async () => {
    const provider = createIndexedDbCompositionProvider({
      idbFactory: new FDBFactory(),
      legacyStorage: { getItem: () => null, removeItem: () => undefined },
      idFactory: () => "real-composition",
      now: () => TIMESTAMP,
    });
    const navigation = new FakeNavigation();
    const first = render(
      <ProductionComposerApp
        providers={[provider]}
        navigation={navigation}
        now={() => TIMESTAMP}
        preview={PREVIEW}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Open Product overview" }));
    await screen.findByRole("button", { name: "Library" });
    const tree = first.container.querySelector("#sg-composer-tree") as HTMLElement;
    const inspector = first.container.querySelector("#sg-composer-inspector") as HTMLElement;
    fireEvent.click(within(tree).getByRole("button", { name: "Expand SplitLayout" }));
    fireEvent.click(within(tree).getByRole("button", { name: /^CtaButton/ }));
    fireEvent.input(within(inspector).getByLabelText("Label"), {
      target: { value: "Persisted in IndexedDB" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    await screen.findByRole("heading", { name: "Compositions" });
    first.unmount();

    navigation.visit("/composer/#/composition/indexeddb/real-composition");
    const refreshed = render(
      <ProductionComposerApp
        providers={[provider]}
        navigation={navigation}
        now={() => TIMESTAMP}
        preview={PREVIEW}
      />,
    );
    await screen.findByRole("button", { name: "Library" });
    const refreshedTree = refreshed.container.querySelector("#sg-composer-tree") as HTMLElement;
    const refreshedInspector = refreshed.container.querySelector(
      "#sg-composer-inspector",
    ) as HTMLElement;
    fireEvent.click(
      within(refreshedTree).getByRole("button", { name: "Expand SplitLayout" }),
    );
    fireEvent.click(within(refreshedTree).getByRole("button", { name: /^CtaButton/ }));
    expect(within(refreshedInspector).getByLabelText("Label")).toHaveValue(
      "Persisted in IndexedDB",
    );
  });

  it("lands a debounce-pending inspector value before the save queue is flushed", async () => {
    const indexeddb = memoryProvider("indexeddb", [record("alpha", "Alpha")]);
    const navigation = new FakeNavigation("/composer/#/composition/indexeddb/alpha");
    const view = render(
      <ProductionComposerApp
        providers={[indexeddb]}
        navigation={navigation}
        preview={PREVIEW}
      />,
    );

    await screen.findByRole("button", { name: "Library" });
    const tree = view.container.querySelector("#sg-composer-tree") as HTMLElement;
    const inspector = view.container.querySelector("#sg-composer-inspector") as HTMLElement;
    fireEvent.click(within(tree).getByRole("button", { name: "Expand SplitLayout" }));
    fireEvent.click(within(tree).getByRole("button", { name: /^CtaButton/ }));
    fireEvent.input(within(inspector).getByLabelText("Label"), {
      target: { value: "Last keystroke before leaving" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Library" }));

    await screen.findByRole("heading", { name: "Compositions" });
    const saved = indexeddb.records.get("alpha")!;
    const cta = saved.document.root[0].slots.right?.find(
      (node) => node.id === "cta-1",
    );
    expect(cta?.props.children).toBe("Last keystroke before leaving");
  });

  it("duplicates and opens only inside the selected provider", async () => {
    const indexeddb = memoryProvider("indexeddb", [record("same", "Browser copy")]);
    const files = memoryProvider("files", [record("same", "File copy")]);
    const navigation = new FakeNavigation();
    let nodeId = 0;
    render(
      <ProductionComposerApp
        providers={[indexeddb, files]}
        navigation={navigation}
        idFactory={() => "file-copy"}
        nodeIdFactory={() => `copied-node-${++nodeId}`}
        preview={PREVIEW}
      />,
    );
    await screen.findByRole("heading", { name: "Compositions" });
    fireEvent.change(screen.getByRole("combobox", { name: "Provider" }), {
      target: { value: "files" },
    });
    await screen.findByRole("button", { name: "Open File copy" });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate File copy" }));

    expect(await screen.findByRole("button", { name: "Library" })).toBeInTheDocument();
    expect(files.records.get("file-copy")?.document.name).toBe("File copy copy");
    expect(indexeddb.records.has("file-copy")).toBe(false);
    expect(navigation.pushes.at(-1)).toBe("/composer/#/composition/files/file-copy");
  });

  it("rolls a failed save transition back to the mounted record and offers retry", async () => {
    const writeError = new CompositionPersistenceError(
      "put",
      "write-failed",
      "Disk write failed.",
      true,
    );
    const indexeddb = memoryProvider("indexeddb", [record("alpha", "Alpha")], {
      put: async () => {
        throw writeError;
      },
    });
    const navigation = new FakeNavigation("/composer/#/composition/indexeddb/alpha");
    render(<ProductionComposerApp providers={[indexeddb]} navigation={navigation} preview={PREVIEW} />);

    await screen.findByRole("button", { name: "Library" });
    fireEvent.click(screen.getByRole("button", { name: "Reset sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm reset" }));
    await screen.findByText("Save failed");
    fireEvent.click(screen.getByRole("button", { name: "Library" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not save composition");
    expect(alert).toHaveTextContent("Disk write failed");
    expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument();
    expect(screen.getAllByText("Product overview").length).toBeGreaterThan(0);
    expect(indexeddb.records.get("alpha")?.document.name).toBe("Alpha");
    expect(navigation.read()).toEqual({
      pathname: "/composer/",
      hash: "#/composition/indexeddb/alpha",
    });
  });

  it("keeps the old detail mounted and retries the exact failed target transition", async () => {
    const indexeddb = memoryProvider("indexeddb", [
      record("alpha", "Alpha"),
      record("bravo", "Bravo"),
    ]);
    const navigation = new FakeNavigation("/composer/#/composition/indexeddb/alpha");
    render(
      <ProductionComposerApp
        providers={[indexeddb]}
        navigation={navigation}
        preview={PREVIEW}
      />,
    );
    await screen.findByRole("button", { name: "Library" });
    fireEvent.click(screen.getByRole("button", { name: "Reset sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm reset" }));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
    vi.mocked(indexeddb.store.get).mockRejectedValueOnce(new Error("Target read is offline."));

    navigation.visit("/composer/#/composition/indexeddb/bravo");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load the record \"bravo\"");
    expect(alert).toHaveTextContent("Target read is offline");
    expect(screen.getAllByText("Product overview").length).toBeGreaterThan(0);
    expect(navigation.read()).toEqual({
      pathname: "/composer/",
      hash: "#/composition/indexeddb/alpha",
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry navigation" }));

    await waitFor(() =>
      expect(navigation.read()).toEqual({
        pathname: "/composer/",
        hash: "#/composition/indexeddb/bravo",
      }),
    );
    expect(screen.getAllByText("Bravo").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Retry navigation" })).not.toBeInTheDocument();
  });

  it("duplicates the mounted composition into its active provider and opens its route", async () => {
    const indexeddb = memoryProvider("indexeddb", [record("same", "Browser copy")]);
    const files = memoryProvider("files", [record("same", "File copy")]);
    const navigation = new FakeNavigation("/composer/#/composition/files/same");
    let nodeId = 0;
    const view = render(
      <ProductionComposerApp
        providers={[indexeddb, files]}
        navigation={navigation}
        idFactory={() => "detail-copy"}
        nodeIdFactory={() => `detail-node-${++nodeId}`}
        preview={PREVIEW}
      />,
    );
    await screen.findByRole("button", { name: "Duplicate composition" });
    const tree = view.container.querySelector("#sg-composer-tree") as HTMLElement;
    const inspector = view.container.querySelector("#sg-composer-inspector") as HTMLElement;
    fireEvent.click(within(tree).getByRole("button", { name: "Expand SplitLayout" }));
    fireEvent.click(within(tree).getByRole("button", { name: /^CtaButton/ }));
    fireEvent.input(within(inspector).getByLabelText("Label"), {
      target: { value: "Duplicated latest draft" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Duplicate composition" }));

    await waitFor(() =>
      expect(navigation.read()).toEqual({
        pathname: "/composer/",
        hash: "#/composition/files/detail-copy",
      }),
    );
    expect(screen.getAllByText("File copy copy").length).toBeGreaterThan(0);
    expect(files.records.get("detail-copy")?.document.name).toBe("File copy copy");
    expect(files.records.get("detail-copy")?.document.root[0].id).not.toBe("split-1");
    expect(
      files.records.get("detail-copy")?.document.root[0].slots.right?.find(
        (node) => node.componentId === "ui.cta-button",
      )?.props.children,
    ).toBe("Duplicated latest draft");
    expect(indexeddb.records.has("detail-copy")).toBe(false);
    expect(files.store.get).toHaveBeenCalledWith("detail-copy");
  });

  it("reopens provider-qualified detail routes delivered by browser history", async () => {
    const indexeddb = memoryProvider("indexeddb", [record("alpha", "Alpha")]);
    const files = memoryProvider("files", [record("alpha", "File Alpha")]);
    const navigation = new FakeNavigation();
    render(<ProductionComposerApp providers={[indexeddb, files]} navigation={navigation} preview={PREVIEW} />);
    await screen.findByRole("heading", { name: "Compositions" });

    navigation.visit("/composer/#/composition/files/alpha");

    expect(await screen.findByRole("button", { name: "Library" })).toBeInTheDocument();
    expect(screen.getAllByText("File Alpha").length).toBeGreaterThan(0);
  });

  it("renders future-schema recovery on a direct detail load and returns safely after Start fresh", async () => {
    const records = new Map<string, CompositionRecord>();
    let quarantined = true;
    const recovered = record("fresh", "Fresh sample");
    const indexeddb = memoryProvider("indexeddb", [], {
      initialize: async () =>
        quarantined
          ? {
              status: "recovery-required",
              recovery: {
                kind: "quarantined",
                reason: "future-schema",
                foundSchemaVersion: 99,
                sourcePreserved: true,
                message: "Future source is quarantined unchanged.",
              },
            }
          : ready(records),
    });
    indexeddb.initialization.startFresh = vi.fn(async () => {
      quarantined = false;
      records.set(recovered.id, recovered);
      indexeddb.records.set(recovered.id, recovered);
      return ready(indexeddb.records);
    });
    const navigation = new FakeNavigation("/composer/#/composition/indexeddb/legacy");
    render(<ProductionComposerApp providers={[indexeddb]} navigation={navigation} preview={PREVIEW} />);

    expect(await screen.findByRole("heading", { name: "Recovery required" })).toBeInTheDocument();
    expect(screen.getByText("Future source is quarantined unchanged.")).toBeInTheDocument();
    expect(screen.getByText("The original source has been preserved.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start fresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Start fresh" }));

    expect(await screen.findByRole("heading", { name: "Compositions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Fresh sample" })).toBeInTheDocument();
    expect(navigation.replacements.at(-1)).toBe("/composer/#/");
  });

  it("does not let slow direct-detail initialization override newer history", async () => {
    const initialization = deferred<CompositionInitializationOutcome>();
    const alpha = record("alpha", "Alpha");
    const indexeddb = memoryProvider("indexeddb", [alpha], {
      initialize: () => initialization.promise,
    });
    const navigation = new FakeNavigation("/composer/#/composition/indexeddb/alpha");
    render(
      <ProductionComposerApp
        providers={[indexeddb]}
        navigation={navigation}
        preview={PREVIEW}
      />,
    );

    navigation.visit("/composer/#/");
    expect(await screen.findByRole("heading", { name: "Loading compositions…" })).toBeInTheDocument();
    initialization.resolve(ready(indexeddb.records));

    expect(await screen.findByRole("heading", { name: "Compositions" })).toBeInTheDocument();
    await Promise.resolve();
    expect(navigation.read()).toEqual({ pathname: "/composer/", hash: "#/" });
    expect(indexeddb.store.get).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Library" })).not.toBeInTheDocument();
  });

  it("keeps a non-blocking migration notice visible while opening a supported direct detail", async () => {
    const migrated = record("safe-id", "Migrated composition");
    const indexeddb = memoryProvider("indexeddb", [migrated], {
      initialize: async () => ({
        status: "ready-with-recovery",
        summaries: [summarizeComposition(migrated)],
        recovery: {
          kind: "recovered",
          reason: "unsafe-id",
          record: migrated,
          sourcePreserved: true,
          message: "The unsafe legacy id was remapped to safe-id.",
        },
      }),
    });
    const navigation = new FakeNavigation("/composer/#/composition/indexeddb/safe-id");
    const retry = vi.spyOn(indexeddb.initialization, "retry");
    render(
      <ProductionComposerApp
        providers={[indexeddb]}
        navigation={navigation}
        preview={PREVIEW}
      />,
    );

    expect(await screen.findByRole("button", { name: "Library" })).toBeInTheDocument();
    expect(screen.getByLabelText("Composition recovery notice")).toHaveTextContent(
      "unsafe legacy id was remapped",
    );
    expect(screen.getByLabelText("Composition recovery notice")).toHaveTextContent(
      "original source has been preserved",
    );
    expect(screen.getAllByText("Migrated composition").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Retry recovery" }));
    await waitFor(() => expect(retry).toHaveBeenCalledOnce());
  });

  it("keeps the current detail mounted when recovery retry fails", async () => {
    const migrated = record("safe-id", "Migrated composition");
    const recoveryOutcome: CompositionInitializationOutcome = {
      status: "ready-with-recovery",
      summaries: [summarizeComposition(migrated)],
      recovery: {
        kind: "recovered",
        reason: "unsafe-id",
        record: migrated,
        sourcePreserved: true,
        message: "The unsafe legacy id was remapped to safe-id.",
      },
    };
    const indexeddb = memoryProvider("indexeddb", [migrated], {
      initialize: async () => recoveryOutcome,
    });
    indexeddb.initialization.retry = vi
      .fn()
      .mockResolvedValueOnce({
        status: "error",
        error: new CompositionPersistenceError(
          "initialize",
          "read-failed",
          "Recovery metadata is temporarily unavailable.",
          true,
        ),
      })
      .mockResolvedValueOnce(ready(indexeddb.records));
    const navigation = new FakeNavigation("/composer/#/composition/indexeddb/safe-id");
    render(
      <ProductionComposerApp
        providers={[indexeddb]}
        navigation={navigation}
        preview={PREVIEW}
      />,
    );
    await screen.findByRole("button", { name: "Library" });
    fireEvent.click(screen.getByRole("button", { name: "Reset sample" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm reset" }));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Retry recovery" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Recovery metadata is temporarily unavailable.",
    );
    expect(screen.getByRole("button", { name: "Retry recovery" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument();
    expect(screen.getAllByText("Product overview").length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Compositions" })).not.toBeInTheDocument();
    expect(navigation.read()).toEqual({
      pathname: "/composer/",
      hash: "#/composition/indexeddb/safe-id",
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry recovery" }));
    await waitFor(() =>
      expect(screen.queryByText("Recovery metadata is temporarily unavailable.")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument();
  });

  it("ignores a recovery retry that finishes after navigation", async () => {
    const migrated = record("safe-id", "Migrated composition");
    const retryOutcome = deferred<CompositionInitializationOutcome>();
    const indexeddb = memoryProvider("indexeddb", [migrated], {
      initialize: async () => ({
        status: "ready-with-recovery",
        summaries: [summarizeComposition(migrated)],
        recovery: {
          kind: "recovered",
          reason: "unsafe-id",
          record: migrated,
          sourcePreserved: true,
          message: "The unsafe legacy id was remapped to safe-id.",
        },
      }),
    });
    indexeddb.initialization.retry = vi.fn(() => retryOutcome.promise);
    const navigation = new FakeNavigation("/composer/#/composition/indexeddb/safe-id");
    render(
      <ProductionComposerApp
        providers={[indexeddb]}
        navigation={navigation}
        preview={PREVIEW}
      />,
    );

    await screen.findByRole("button", { name: "Library" });
    fireEvent.click(screen.getByRole("button", { name: "Retry recovery" }));
    await waitFor(() => expect(indexeddb.initialization.retry).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Library" }));
    expect(await screen.findByRole("heading", { name: "Compositions" })).toBeInTheDocument();

    retryOutcome.resolve({
      status: "error",
      error: new CompositionPersistenceError(
        "initialize",
        "read-failed",
        "Stale recovery failure.",
        true,
      ),
    });
    await Promise.resolve();

    expect(screen.queryByText("Stale recovery failure.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Composition recovery notice")).not.toBeInTheDocument();
  });
});
