// Vitest stand-in for `virtual:zudo-sg-tokens` (only zfb's bundler resolves
// this plugin virtual module). Tests `vi.mock` it with their own fixture when
// they need a non-null manifest; this only needs to resolve.
export const tokensManifest: unknown = null;
