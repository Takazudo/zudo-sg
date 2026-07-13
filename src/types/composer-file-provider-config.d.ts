// Registered by plugins/composer-file-provider-plugin.mjs. The production
// loader exports `undefined`, so neither the endpoint nor capability can enter
// a build/preview client artifact.
declare module "virtual:composer-file-provider-config" {
  import type { ComposerFileProviderConfig } from "@/composer/storage/file-provider/types";

  export const fileProviderConfig: ComposerFileProviderConfig | undefined;
}
