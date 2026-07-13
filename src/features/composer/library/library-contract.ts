import type {
  CompositionInitializationOutcome,
  CompositionProviderDescriptor,
  CompositionProviderId,
  CompositionRecordRef,
  CompositionSummary,
} from "@/composer";

/** A provider can be described even when the current runtime cannot offer it. */
export interface CompositionLibraryProviderCapability {
  descriptor: CompositionProviderDescriptor;
  available: boolean;
}

export type CompositionLibraryOpenOutcome =
  | { status: "opened" }
  | { status: "not-found" };

/**
 * UI intents only. Production provider and router adapters are deliberately
 * supplied by a later composition layer; component tests use an async fake.
 */
export interface CompositionLibraryIntents {
  initialize(providerId: CompositionProviderId): Promise<CompositionInitializationOutcome>;
  retry(providerId: CompositionProviderId): Promise<CompositionInitializationOutcome>;
  startFresh(providerId: CompositionProviderId): Promise<CompositionInitializationOutcome>;
  create(providerId: CompositionProviderId): Promise<CompositionSummary>;
  open(ref: CompositionRecordRef): Promise<CompositionLibraryOpenOutcome>;
  duplicate(ref: CompositionRecordRef): Promise<CompositionSummary>;
  delete(ref: CompositionRecordRef): Promise<boolean>;
  clear(providerId: CompositionProviderId): Promise<void>;
}
