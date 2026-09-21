// Vitest stand-in for `virtual:zudo-doc-chrome-bindings` (only zfb's bundler
// resolves this plugin virtual module). The payload's shape is irrelevant to
// the tests using it — they mock `@takazudo/zudo-doc/chrome`'s `createChrome`
// too, so this only needs to resolve.
export const chromeBindings = {};
