// Temporary read-only catalog retained until the in-repo Sitemapper is removed.

import { isSafeRecordId } from "@/shared";
import type { CompositionRef } from "../model/types";
import type {
  CatalogEntry,
  CompositionCatalog,
  CompositionCatalogInput,
  CompositionCatalogListOutcome,
  CompositionCatalogProvider,
  CompositionCatalogProviderRegistry,
  CompositionCatalogProviderSource,
  ProviderFailure,
  ResolveOutcome,
  CompositionLoadOutcome,
} from "./types";

interface ProviderCollection {
  readonly get: (providerId: string) => CompositionCatalogProvider | undefined;
  readonly all: readonly CompositionCatalogProvider[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProvider(value: unknown): value is CompositionCatalogProvider {
  if (!isObject(value)) return false;
  const descriptor = value.descriptor;
  const store = value.store;
  return isObject(descriptor)
    && typeof descriptor.id === "string"
    && typeof descriptor.label === "string"
    && isObject(store)
    && typeof store.list === "function"
    && typeof store.get === "function";
}

function isProviderRegistry(value: unknown): value is CompositionCatalogProviderRegistry {
  return isObject(value) && typeof value.get === "function";
}

function providerCollectionFromArray(
  providers: readonly CompositionCatalogProvider[],
): ProviderCollection {
  const byId = new Map<string, CompositionCatalogProvider>();
  for (const provider of providers) {
    if (!isProvider(provider)) continue;
    byId.set(provider.descriptor.id, provider);
  }
  return { get: (providerId) => byId.get(providerId), all: [...byId.values()] };
}

function providerCollectionFromMap(
  providers: ReadonlyMap<string, CompositionCatalogProvider>,
): ProviderCollection {
  const byId = new Map<string, CompositionCatalogProvider>();
  for (const [key, provider] of providers) {
    if (!isProvider(provider)) continue;
    // Descriptor identity is authoritative for entries. Retain the map key
    // as a lookup alias as well, which makes a registry mismatch diagnosable
    // rather than silently unable to resolve the provider.
    byId.set(key, provider);
    byId.set(provider.descriptor.id, provider);
  }
  const all = [...new Set(byId.values())];
  return { get: (providerId) => byId.get(providerId), all };
}

function providerCollectionFromRegistry(
  registry: CompositionCatalogProviderRegistry,
): ProviderCollection {
  const all = registry.values
    ? [...registry.values()].filter(isProvider)
    : [];
  return {
    get: (providerId) => {
      try {
        const provider = registry.get(providerId);
        return isProvider(provider) ? provider : undefined;
      } catch {
        return undefined;
      }
    },
    all,
  };
}

function unwrapInput(input: CompositionCatalogInput): CompositionCatalogProviderSource {
  if (isObject(input) && "providers" in input) {
    return input.providers as CompositionCatalogProviderSource;
  }
  if (isObject(input) && "registry" in input) {
    return input.registry as CompositionCatalogProviderSource;
  }
  return input as CompositionCatalogProviderSource;
}

function providerCollection(input: CompositionCatalogInput): ProviderCollection {
  const source = unwrapInput(input);
  if (Array.isArray(source)) return providerCollectionFromArray(source);
  if (source instanceof Map) return providerCollectionFromMap(source);
  if (isProviderRegistry(source)) return providerCollectionFromRegistry(source);
  // The public type prevents this path, but a defensive empty collection keeps
  // an untrusted runtime wiring value from crashing the picker.
  return { get: () => undefined, all: [] };
}

function failureReason(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

function listEntry(
  provider: CompositionCatalogProvider,
  summary: {
    id: string;
    name: string;
    updatedAt: string;
    nodeCount: number;
  },
): CatalogEntry {
  return {
    ref: {
      providerId: provider.descriptor.id,
      recordId: summary.id,
    },
    providerLabel: provider.descriptor.label,
    name: summary.name,
    updatedAt: summary.updatedAt,
    nodeCount: summary.nodeCount,
  };
}

function invalidRefReason(ref: unknown): string | undefined {
  if (!isObject(ref) || Array.isArray(ref)) {
    return "Composition reference must be an object.";
  }
  if (typeof ref.providerId !== "string" || ref.providerId.length === 0) {
    return "Composition reference providerId must be a non-empty string.";
  }
  if (!isSafeRecordId(ref.recordId)) {
    return "Composition reference recordId is not a safe record id.";
  }
  return undefined;
}

function unreadableReason(outcome: Extract<CompositionLoadOutcome, { status: "invalid" | "future-schema" }>): string {
  return outcome.status === "invalid"
    ? outcome.issue.message
    : `The composition uses unsupported schema version ${outcome.foundSchemaVersion}.`;
}

async function resolveFromProvider(
  provider: CompositionCatalogProvider,
  recordId: string,
): Promise<ResolveOutcome> {
  let outcome: CompositionLoadOutcome;
  try {
    outcome = await provider.store.get(recordId);
  } catch (error) {
    // A provider that exists but cannot complete a read has a real target that
    // cannot currently be opened. Keep resolve's closed outcome union intact
    // and preserve the actionable operational message for the UI.
    return {
      status: "unreadable-target",
      reason: failureReason(error, `Could not read composition "${recordId}".`),
    };
  }

  switch (outcome.status) {
    case "loaded":
      return { status: "resolved", record: outcome.record };
    case "not-found":
      return { status: "not-found" };
    case "invalid":
    case "future-schema":
      return { status: "unreadable-target", reason: unreadableReason(outcome) };
    default:
      return {
        status: "unreadable-target",
        reason: "The composition provider returned an unknown load outcome.",
      };
  }
}

/**
 * Build the Sitemapper's Composer catalog boundary from the active providers.
 * Only list/get are retained; no Composer mutation method is reachable through
 * the returned API.
 */
export function createCompositionCatalog(input: CompositionCatalogInput): CompositionCatalog {
  const collection = providerCollection(input);

  return {
    async listCompositions(): Promise<CompositionCatalogListOutcome> {
      const entries: CatalogEntry[] = [];
      const failures: ProviderFailure[] = [];

      // Keep each provider attached to its settled result. One rejected list
      // must not suppress entries from any provider that did load. Catching
      // inside each task also covers a malformed test/provider implementation
      // that throws synchronously before returning its Promise.
      const results = await Promise.all(
        collection.all.map(async (provider) => {
          try {
            return { provider, summaries: await provider.store.list() } as const;
          } catch (error) {
            return { provider, error } as const;
          }
        }),
      );
      for (const result of results) {
        const { provider } = result;
        if ("error" in result) {
          failures.push({
            providerId: provider.descriptor.id,
            providerLabel: provider.descriptor.label,
            reason: failureReason(
              result.error,
              `Could not list compositions from provider "${provider.descriptor.id}".`,
            ),
          });
          continue;
        }
        for (const summary of result.summaries) entries.push(listEntry(provider, summary));
      }

      return { entries, failures };
    },

    async resolveComposition(ref: CompositionRef): Promise<ResolveOutcome> {
      const reason = invalidRefReason(ref);
      if (reason !== undefined) return { status: "invalid-ref", reason };

      // The guard above proves these fields exist and have the expected
      // runtime types; keep the cast local so the public contract stays tied to
      // the schema-owned CompositionRef.
      const candidate = ref as unknown as { providerId: string; recordId: string };
      let provider: CompositionCatalogProvider | undefined;
      try {
        provider = collection.get(candidate.providerId);
      } catch {
        provider = undefined;
      }
      if (!provider) return { status: "provider-unavailable" };
      return resolveFromProvider(provider, candidate.recordId);
    },
  };
}

/** Convenience function for callers that do not need to retain the adapter. */
export async function listCompositions(
  input: CompositionCatalogInput,
): Promise<CompositionCatalogListOutcome> {
  return createCompositionCatalog(input).listCompositions();
}

/** Convenience function for one-off provider-qualified resolution. */
export async function resolveComposition(
  input: CompositionCatalogInput,
  ref: CompositionRef,
): Promise<ResolveOutcome> {
  return createCompositionCatalog(input).resolveComposition(ref);
}
