// Vitest stand-in for `virtual:zudo-sg-registry` (only zfb's bundler resolves
// this plugin virtual module). Tests `vi.mock` it with their own fixture; this
// only needs to resolve, with the same three exports in every registry mode.
export const storyModules = {};
export const storyExportOrder = {};
export const storyDescriptors: unknown = [];
