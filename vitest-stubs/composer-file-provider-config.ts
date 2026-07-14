import type { ComposerFileProviderConfig } from "@/composer/storage/file-provider/types";

// Production-shaped default. Adapter tests mock this module with a development
// capability before importing the adapter.
export const fileProviderConfig: ComposerFileProviderConfig | undefined = undefined;
