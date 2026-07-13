import type { CompositionPersistenceErrorCode } from "../../library";

/** Injected only into dev client bundles by the zfb file-provider plugin. */
export interface ComposerFileProviderConfig {
  endpoint: string;
  capability: string;
  capabilityHeader: string;
  maxBodyBytes: number;
}

export interface ComposerFileProviderErrorPayload {
  code: CompositionPersistenceErrorCode | "jsx-required" | string;
  message: string;
  operation?: string;
}
