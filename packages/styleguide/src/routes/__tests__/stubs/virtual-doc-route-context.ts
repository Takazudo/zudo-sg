// Vitest stand-in for `virtual:zudo-doc-route-context` (only zfb's bundler
// resolves this plugin virtual module). The payload's shape is irrelevant to
// the tests using it — they mock `@takazudo/zudo-doc/route-context`'s
// `createRouteContext` too, so this only needs to resolve.
export const routeContext = {};
