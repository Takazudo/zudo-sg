"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import {
  COMPOSITION_PROVIDERS,
  CompositionPersistenceError,
  createCompositionRecord,
  createCompositionSaveQueue,
  createFileProviderCompositionStore,
  createIndexedDbCompositionProvider,
  createSampleDocument,
  createUuidIdFactory,
  duplicateCompositionRecord,
  summarizeComposition,
  type CompositionInitializationOutcome,
  type CompositionLoadOutcome,
  type CompositionProvider,
  type CompositionProviderId,
  type CompositionRecord,
  type CompositionRecordRef,
  type CompositionRecoveryOutcome,
  type CompositionSaveQueue,
  type CompositionStore,
  type IdFactory,
} from "@/composer";
import { normalizedBase } from "@/utils/base";
import { CompositionLibrary } from "@/features/composer/library";
import type { CompositionLibraryIntents } from "@/features/composer/library";
import {
  composerDocumentPath,
  createComposerProviderPreference,
  createComposerTransitionCoordinator,
  ComposerTransitionError,
  formatComposerRoute,
  parseComposerRoute,
  type ComposerCommittedState,
  type ComposerDetailSession,
  type ComposerRoute,
  type ComposerRouteConfig,
  type ComposerRouteLocation,
  type ComposerTransitionHistory,
  type ComposerTransitionIntent,
} from "@/features/composer/routing";
import { ComposerIntegration } from "./composer-integration";
import type { ComposerIntegrationProps } from "./composer-integration";

export interface ComposerBrowserNavigation extends ComposerTransitionHistory {
  read(): ComposerRouteLocation;
  subscribe(listener: () => void): () => void;
}

export interface ProductionComposerAppProps {
  /** Provider injection is a production-integration test seam. */
  providers?: readonly CompositionProvider[];
  navigation?: ComposerBrowserNavigation;
  routeConfig?: Pick<ComposerRouteConfig, "basePath" | "trailingSlash">;
  idFactory?: IdFactory;
  nodeIdFactory?: IdFactory;
  now?: () => string;
  /** Existing preview bridge seams, forwarded for focused integration tests. */
  preview?: Pick<ComposerIntegrationProps, "createBridge" | "previewLocation" | "hostWindow">;
}

interface ProductionDetailSession extends ComposerDetailSession {
  readonly queue: CompositionSaveQueue;
  registerFlushPendingProps(flush: (() => void) | null): void;
}

const DEFAULT_ROUTE_CONFIG = {
  basePath: normalizedBase || "/",
  trailingSlash: "always" as const,
};

function browserNavigation(): ComposerBrowserNavigation {
  return {
    read: () => ({ pathname: window.location.pathname, hash: window.location.hash }),
    push: (url) => window.history.pushState(null, "", url),
    replace: (url) => window.history.replaceState(null, "", url),
    subscribe: (listener) => {
      let scheduled = false;
      const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
          scheduled = false;
          listener();
        });
      };
      window.addEventListener("hashchange", schedule);
      window.addEventListener("popstate", schedule);
      return () => {
        window.removeEventListener("hashchange", schedule);
        window.removeEventListener("popstate", schedule);
      };
    },
  };
}

function initializationError(reason: unknown): CompositionInitializationOutcome {
  return {
    status: "error",
    error:
      reason instanceof CompositionPersistenceError
        ? reason
        : new CompositionPersistenceError(
            "initialize",
            "unknown",
            reason instanceof Error ? reason.message : "Composition storage initialization failed.",
            true,
            { cause: reason },
          ),
  };
}

/** File storage has no migration state; successful listing is its initialization. */
function providerFromStore(store: CompositionStore): CompositionProvider {
  const initialize = async (): Promise<CompositionInitializationOutcome> => {
    try {
      return { status: "ready", summaries: await store.list() };
    } catch (reason) {
      return initializationError(reason);
    }
  };
  return {
    descriptor: store.provider,
    store,
    initialization: { initialize, retry: initialize, startFresh: initialize },
  };
}

/** Build-gated registry: production gets IndexedDB only; dev gains file storage. */
export function createProductionComposerProviders(): readonly CompositionProvider[] {
  const providers: CompositionProvider[] = [createIndexedDbCompositionProvider()];
  const fileStore = createFileProviderCompositionStore();
  if (fileStore) providers.push(providerFromStore(fileStore));
  return providers;
}

function failedLoadMessage(outcome: Exclude<CompositionLoadOutcome, { status: "loaded" }>): string {
  switch (outcome.status) {
    case "not-found":
      return `Composition "${outcome.id}" was not found.`;
    case "invalid":
      return `The composition is invalid: ${outcome.issue.message}`;
    case "future-schema":
      return `The composition uses unsupported schema version ${outcome.foundSchemaVersion}.`;
  }
}

function canonicalResolution(
  location: ComposerRouteLocation,
  config: ComposerRouteConfig,
): { resolution: ReturnType<typeof parseComposerRoute>; url: string; history: ComposerTransitionIntent["history"] } {
  const documentPath = composerDocumentPath(config);
  const pathWithoutSlash = documentPath.replace(/\/$/, "");
  if (
    (location.pathname === documentPath || location.pathname === pathWithoutSlash) &&
    (location.hash === "" || location.hash === "#/")
  ) {
    const route = { kind: "index" } as const;
    const url = formatComposerRoute(route, config);
    return {
      resolution: { status: "matched", route },
      url,
      history:
        location.pathname === documentPath && location.hash === "#/" ? "already-applied" : "replace",
    };
  }
  return {
    resolution: parseComposerRoute(location, config),
    url: `${location.pathname}${location.hash}`,
    history: "already-applied",
  };
}

function routeRef(route: ComposerRoute): CompositionRecordRef | null {
  return route.kind === "detail"
    ? { providerId: route.providerId, recordId: route.recordId }
    : null;
}

function errorText(error: ComposerTransitionError): string {
  const cause = error.cause;
  return cause instanceof Error && cause.message ? `${error.message} ${cause.message}` : error.message;
}

export function ProductionComposerApp({
  providers: injectedProviders,
  navigation: injectedNavigation,
  routeConfig: injectedRouteConfig,
  idFactory: injectedIdFactory,
  nodeIdFactory: injectedNodeIdFactory,
  now: injectedNow,
  preview,
}: ProductionComposerAppProps): JSX.Element {
  const providers = useMemo(
    () => injectedProviders ?? createProductionComposerProviders(),
    [injectedProviders],
  );
  const navigation = useMemo(
    () => injectedNavigation ?? browserNavigation(),
    [injectedNavigation],
  );
  const routeConfig = useMemo<ComposerRouteConfig>(
    () => ({
      ...DEFAULT_ROUTE_CONFIG,
      ...injectedRouteConfig,
      isKnownProvider: (id) => providers.some(({ descriptor }) => descriptor.id === id),
    }),
    [injectedRouteConfig, providers],
  );
  const providersById = useMemo(
    () => new Map(providers.map((provider) => [provider.descriptor.id, provider])),
    [providers],
  );
  const idFactory = useMemo(() => injectedIdFactory ?? createUuidIdFactory(), [injectedIdFactory]);
  const nodeIdFactory = useMemo(
    () => injectedNodeIdFactory ?? createUuidIdFactory(),
    [injectedNodeIdFactory],
  );
  const now = injectedNow ?? (() => new Date().toISOString());
  const nowRef = useRef(now);
  nowRef.current = now;
  const preference = useMemo(
    () =>
      createComposerProviderPreference({
        getItem: (key) => globalThis.localStorage.getItem(key),
        setItem: (key, value) => globalThis.localStorage.setItem(key, value),
      }),
    [],
  );
  const [state, setState] = useState<ComposerCommittedState | null>(null);
  const [transitionError, setTransitionError] = useState<ComposerTransitionError | null>(null);
  const [failedTransition, setFailedTransition] =
    useState<ComposerTransitionIntent | null>(null);
  const [retryingNavigation, setRetryingNavigation] = useState(false);
  const [detailOperationError, setDetailOperationError] = useState<string | null>(null);
  const [duplicatingComposition, setDuplicatingComposition] = useState(false);
  const [bootProviderId, setBootProviderId] = useState<CompositionProviderId | null>(null);
  const [initializationNotice, setInitializationNotice] =
    useState<CompositionRecoveryOutcome | null>(null);
  const [retryingRecovery, setRetryingRecovery] = useState(false);

  const coordinator = useMemo(
    () =>
      createComposerTransitionCoordinator({
        registry: {
          get: (providerId) => {
            const provider = providersById.get(providerId as CompositionProviderId);
            return provider
              ? { id: provider.descriptor.id, list: () => provider.store.list(), get: (id) => provider.store.get(id) }
              : undefined;
          },
        },
        defaultProviderId: COMPOSITION_PROVIDERS.indexeddb.id,
        preference,
        history: navigation,
        createDetailSession: (ref, record): ComposerDetailSession => {
          let flushPendingProps: (() => void) | null = null;
          const provider = providersById.get(ref.providerId);
          if (!provider) throw new Error(`Composition provider "${ref.providerId}" is unavailable.`);
          const queue = createCompositionSaveQueue({
            ref: { ...ref },
            initialRecord: record,
            write: (snapshot) => provider.store.put(snapshot.record),
          });
          const session: ProductionDetailSession = {
            queue,
            flushPendingProps: (boundRef) => {
              if (boundRef.providerId !== ref.providerId || boundRef.recordId !== ref.recordId) {
                throw new Error("The mounted editor is not bound to the requested composition.");
              }
              flushPendingProps?.();
            },
            registerFlushPendingProps: (flush) => {
              flushPendingProps = flush;
            },
          };
          return session;
        },
      }),
    [navigation, preference, providersById],
  );

  useEffect(() => coordinator.subscribe(setState), [coordinator]);

  const transition = useCallback(
    async (intent: ComposerTransitionIntent) => {
      setTransitionError(null);
      const result = await coordinator.transition(intent);
      if (result.status === "rolled-back") {
        setTransitionError(result.error);
        setFailedTransition(
          intent.history === "already-applied" ? { ...intent, history: "push" } : intent,
        );
      } else if (result.status === "committed") {
        setFailedTransition(null);
        setDetailOperationError(null);
      }
      return result;
    },
    [coordinator],
  );

  const transitionLocation = useCallback(
    async (location: ComposerRouteLocation, initializeDirectDetail: boolean) => {
      const target = canonicalResolution(location, routeConfig);
      if (
        initializeDirectDetail &&
        target.resolution.status === "matched" &&
        target.resolution.route.kind === "detail"
      ) {
        const providerId = target.resolution.route.providerId;
        const provider = providersById.get(providerId);
        if (provider) {
          const outcome = await provider.initialization.initialize();
          if (outcome.status === "error" || outcome.status === "recovery-required") {
            setInitializationNotice(null);
            setBootProviderId(providerId);
            return;
          }
          setInitializationNotice(
            outcome.status === "ready-with-recovery" ? outcome.recovery : null,
          );
        }
      } else {
        setInitializationNotice(null);
      }
      setBootProviderId(null);
      await transition({
        resolution: target.resolution,
        url: target.url,
        history: target.history,
      });
    },
    [providersById, routeConfig, transition],
  );

  useEffect(() => {
    let active = true;
    void transitionLocation(navigation.read(), true);
    const unsubscribe = navigation.subscribe(() => {
      if (active) void transitionLocation(navigation.read(), false);
    });
    return () => {
      active = false;
      unsubscribe();
      coordinator.cancel();
    };
  }, [coordinator, navigation, transitionLocation]);

  const navigate = useCallback(
    async (
      route: ComposerRoute,
      history: "push" | "replace" = "push",
      indexProviderId?: CompositionProviderId,
    ) => {
      setInitializationNotice(null);
      return transition({
        resolution: { status: "matched", route },
        url: formatComposerRoute(route, routeConfig),
        history,
        indexProviderId,
      });
    },
    [routeConfig, transition],
  );

  const libraryIntents = useMemo<CompositionLibraryIntents>(() => {
    const provider = (providerId: CompositionProviderId): CompositionProvider => {
      const found = providersById.get(providerId);
      if (!found) throw new Error(`Composition provider "${providerId}" is unavailable.`);
      return found;
    };
    return {
      initialize: (providerId) => provider(providerId).initialization.initialize(),
      retry: (providerId) => provider(providerId).initialization.retry(),
      startFresh: (providerId) => provider(providerId).initialization.startFresh(),
      create: async (providerId) => {
        const record = createCompositionRecord(createSampleDocument(), {
          idFactory,
          now: nowRef.current,
        });
        await provider(providerId).store.put(record);
        return summarizeComposition(record);
      },
      open: async (ref) => {
        const result = await navigate(
          { kind: "detail", providerId: ref.providerId, recordId: ref.recordId },
          "push",
        );
        if (result.status === "rolled-back") {
          if (result.error.code === "record-not-found") return { status: "not-found" };
          throw result.error;
        }
        return { status: "opened" };
      },
      duplicate: async (ref) => {
        const source = await provider(ref.providerId).store.get(ref.recordId);
        if (source.status !== "loaded") throw new Error(failedLoadMessage(source));
        const record = duplicateCompositionRecord(source.record, {
          idFactory,
          nodeIdFactory,
          now: nowRef.current,
        });
        await provider(ref.providerId).store.put(record);
        return summarizeComposition(record);
      },
      delete: (ref) => provider(ref.providerId).store.delete(ref.recordId),
      clear: (providerId) => provider(providerId).store.clear(),
    };
  }, [idFactory, navigate, nodeIdFactory, providersById]);

  const handleInitializationApplied = useCallback(
    (providerId: CompositionProviderId, outcome: CompositionInitializationOutcome) => {
      if (outcome.status === "error" || outcome.status === "recovery-required") return;
      try {
        preference.write(providerId);
      } catch {
        // Provider preference is best-effort; the initialized collection remains active.
      }
      if (bootProviderId) {
        setBootProviderId(null);
        void navigate({ kind: "index" }, "replace", providerId);
      }
    },
    [bootProviderId, navigate, preference],
  );

  const retryInitializationRecovery = useCallback(async () => {
    if (state?.view !== "detail") return;
    const provider = providersById.get(state.providerId);
    if (!provider) return;
    setRetryingRecovery(true);
    try {
      const outcome = await provider.initialization.retry();
      if (outcome.status === "error" || outcome.status === "recovery-required") {
        setInitializationNotice(null);
        setBootProviderId(state.providerId);
        return;
      }
      setInitializationNotice(
        outcome.status === "ready-with-recovery" ? outcome.recovery : null,
      );
    } finally {
      setRetryingRecovery(false);
    }
  }, [providersById, state]);

  const retryFailedTransition = useCallback(async () => {
    if (!failedTransition) return;
    setRetryingNavigation(true);
    try {
      await transition(failedTransition);
    } finally {
      setRetryingNavigation(false);
    }
  }, [failedTransition, transition]);

  const duplicateMountedComposition = useCallback(async () => {
    if (state?.view !== "detail" || duplicatingComposition) return;
    const session = state.session as ProductionDetailSession;
    const ref = routeRef(state.route)!;
    const provider = providersById.get(ref.providerId);
    if (!provider) return;

    setDetailOperationError(null);
    setDuplicatingComposition(true);
    try {
      await session.flushPendingProps(ref);
      await session.queue.flush();
      const duplicate = duplicateCompositionRecord(session.queue.state.draft, {
        idFactory,
        nodeIdFactory,
        now: nowRef.current,
      });
      await provider.store.put(duplicate);
      await navigate({
        kind: "detail",
        providerId: ref.providerId,
        recordId: duplicate.id,
      });
    } catch (reason) {
      setDetailOperationError(
        reason instanceof Error
          ? reason.message
          : "The composition could not be duplicated.",
      );
    } finally {
      setDuplicatingComposition(false);
    }
  }, [duplicatingComposition, idFactory, navigate, nodeIdFactory, providersById, state]);

  const availableProviders = useMemo(
    () => providers.map(({ descriptor }) => ({ descriptor, available: true })),
    [providers],
  );
  const preferredProviderId = (() => {
    const candidate = bootProviderId ?? (state?.view !== "not-found" ? state?.providerId : null);
    return candidate && providersById.has(candidate)
      ? candidate
      : COMPOSITION_PROVIDERS.indexeddb.id;
  })();

  if (bootProviderId || state?.view === "index") {
    return (
      <>
        {transitionError && (
          <div class="sg-composer-library-alert sg-composer-library-alert-error" role="alert">
            <p>{errorText(transitionError)}</p>
          </div>
        )}
        <CompositionLibrary
          providers={availableProviders}
          initialProviderId={preferredProviderId}
          intents={libraryIntents}
          onInitializationApplied={handleInitializationApplied}
        />
      </>
    );
  }

  if (state?.view === "detail") {
    const ref = routeRef(state.route)!;
    const session = state.session as ProductionDetailSession;
    return (
      <ComposerIntegration
        key={`${ref.providerId}:${ref.recordId}:${state.generation}`}
        controllerOptions={{
          record: state.record,
          saveQueue: session.queue,
          now: nowRef.current,
        }}
        registerFlushPendingProps={session.registerFlushPendingProps}
        onNavigateToLibrary={() => void navigate({ kind: "index" })}
        onDuplicateComposition={() => void duplicateMountedComposition()}
        duplicatingComposition={duplicatingComposition}
        navigationError={
          transitionError
            ? errorText(transitionError)
            : detailOperationError
        }
        onRetryNavigation={
          transitionError && failedTransition
            ? () => void retryFailedTransition()
            : undefined
        }
        navigationRetrying={retryingNavigation}
        recoveryNotice={
          initializationNotice
            ? `${initializationNotice.message} The original source has been preserved.`
            : null
        }
        onRetryRecovery={() => void retryInitializationRecovery()}
        recoveryRetrying={retryingRecovery}
        {...preview}
      />
    );
  }

  if (state?.view === "not-found") {
    return (
      <main class="sg-composer-library" aria-labelledby="sg-composer-route-error-title">
        <section class="sg-composer-library-alert sg-composer-library-alert-error" role="alert">
          <div>
            <h1 id="sg-composer-route-error-title">Composition could not be opened</h1>
            <p>
              {state.error instanceof ComposerTransitionError
                ? errorText(state.error)
                : state.error.message}
            </p>
          </div>
          <div class="sg-composer-library-actions">
            {state.route && (
              <button
                type="button"
                class="sg-composer-library-button"
                onClick={() =>
                  void transitionLocation(navigation.read(), state.route?.kind === "detail")
                }
              >
                Retry
              </button>
            )}
            <button
              type="button"
              class="sg-composer-library-button"
              onClick={() => void navigate({ kind: "index" }, "replace")}
            >
              Back to library
            </button>
          </div>
        </section>
        {initializationNotice && (
          <section class="sg-composer-library-alert" aria-label="Composition recovery notice">
            <p>{initializationNotice.message}</p>
            <p>The original source has been preserved.</p>
          </section>
        )}
      </main>
    );
  }

  return (
    <main class="sg-composer-library" aria-busy="true" aria-label="Loading Composer">
      <section class="sg-composer-library-state">
        <h1>Loading Composer…</h1>
        <p>Opening the selected composition storage.</p>
      </section>
    </main>
  );
}
