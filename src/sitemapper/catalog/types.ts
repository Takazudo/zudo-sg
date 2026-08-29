import type { CompositionRef } from "../model/types";

/** Minimal read-only record shape understood by the temporary Sitemapper catalog. */
export interface CompositionRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  document: {
    schemaVersion: number;
    id: string;
    name: string;
    root: unknown[];
  };
}

export interface CompositionSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
}

export type CompositionLoadOutcome =
  | { status: "loaded"; record: CompositionRecord }
  | { status: "not-found"; id: string }
  | { status: "invalid"; issue: { message: string } }
  | { status: "future-schema"; foundSchemaVersion: number };

export interface CompositionCatalogStore {
  list(): Promise<readonly CompositionSummary[]>;
  get(id: string): Promise<CompositionLoadOutcome>;
}

export interface CatalogEntry {
  ref: CompositionRef;
  providerLabel: string;
  name: string;
  updatedAt: string;
  nodeCount: number;
}

export interface ProviderFailure {
  providerId: string;
  providerLabel: string;
  reason: string;
}

export interface CompositionCatalogListOutcome {
  entries: CatalogEntry[];
  failures: ProviderFailure[];
}

export type ResolveOutcome =
  | { status: "resolved"; record: CompositionRecord }
  | { status: "not-found" }
  | { status: "provider-unavailable" }
  | { status: "unreadable-target"; reason: string }
  | { status: "invalid-ref"; reason: string };

export interface CompositionCatalogProvider {
  readonly descriptor: {
    readonly id: string;
    readonly label: string;
  };
  readonly store: CompositionCatalogStore;
}

export interface CompositionCatalogProviderRegistry {
  get(providerId: string): CompositionCatalogProvider | undefined;
  values?: () => Iterable<CompositionCatalogProvider>;
}

export type CompositionCatalogProviderSource =
  | readonly CompositionCatalogProvider[]
  | ReadonlyMap<string, CompositionCatalogProvider>
  | CompositionCatalogProviderRegistry;

export type CompositionCatalogInput =
  | CompositionCatalogProviderSource
  | { readonly providers: CompositionCatalogProviderSource }
  | { readonly registry: CompositionCatalogProviderSource };

export interface CompositionCatalog {
  listCompositions(): Promise<CompositionCatalogListOutcome>;
  resolveComposition(ref: CompositionRef): Promise<ResolveOutcome>;
}
