// Sitemapper ↔ Composer boundary: this catalog is the only Sitemapper module
// allowed to depend on @/composer, and its public operations are read-only.
// Opening an IndexedDB Composer provider can seed or migrate data on first
// open, so the catalog is mutation-free at its API level but not literally
// side-effect-free.

import type {
  CompositionLoadOutcome,
  CompositionRecord,
  CompositionStore,
  CompositionSummary,
} from "@/composer";
import type { CompositionRef } from "../model/types";

/** One saved Composer record as it appears in the Sitemapper picker. */
export interface CatalogEntry {
  /** Provider-qualified identity; a bare record id is not sufficient. */
  ref: CompositionRef;
  providerLabel: string;
  name: string;
  updatedAt: string;
  nodeCount: number;
}

/** A provider whose list operation failed while other providers may succeed. */
export interface ProviderFailure {
  providerId: string;
  providerLabel: string;
  reason: string;
}

export interface CompositionCatalogListOutcome {
  entries: CatalogEntry[];
  failures: ProviderFailure[];
}

/** The five deliberate results of resolving a Sitemap composition reference. */
export type ResolveOutcome =
  | { status: "resolved"; record: CompositionRecord }
  | { status: "not-found" }
  | { status: "provider-unavailable" }
  | { status: "unreadable-target"; reason: string }
  | { status: "invalid-ref"; reason: string };

/**
 * The smallest provider surface the catalog needs. A real CompositionProvider
 * is structurally assignable here, while tests and host adapters need not
 * expose any Composer write or lifecycle methods to this read-only boundary.
 */
export interface CompositionCatalogProvider {
  readonly descriptor: {
    readonly id: string;
    readonly label: string;
  };
  readonly store: Pick<CompositionStore, "list" | "get">;
}

/**
 * Registry lookup used by resolveComposition. `values` is optional so a
 * lookup-only registry can still resolve refs; listCompositions needs an
 * enumerable source (an array, map, or registry that exposes values).
 */
export interface CompositionCatalogProviderRegistry {
  get(providerId: string): CompositionCatalogProvider | undefined;
  values?: () => Iterable<CompositionCatalogProvider>;
}

export type CompositionCatalogProviderSource =
  | readonly CompositionCatalogProvider[]
  | ReadonlyMap<string, CompositionCatalogProvider>
  | CompositionCatalogProviderRegistry;

/** Optional named form, useful when wiring the adapter from an app boundary. */
export type CompositionCatalogInput =
  | CompositionCatalogProviderSource
  | { readonly providers: CompositionCatalogProviderSource }
  | { readonly registry: CompositionCatalogProviderSource };

export interface CompositionCatalog {
  listCompositions(): Promise<CompositionCatalogListOutcome>;
  resolveComposition(ref: CompositionRef): Promise<ResolveOutcome>;
}

/** Narrow read-only store shape exported for fake-provider fixtures. */
export type CompositionCatalogStore = Pick<CompositionStore, "list" | "get">;

/** Type-only aliases for consumers that need to describe provider calls. */
export type { CompositionLoadOutcome, CompositionRecord, CompositionSummary };
