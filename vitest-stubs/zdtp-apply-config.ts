// Stub for the "virtual:zdtp-apply-config" module.
//
// That specifier is a zfb virtual module registered by
// plugins/zdtp-apply-proxy-plugin.mjs's `setup` hook via `addVirtualModule` —
// only zfb's own bundler knows how to resolve a "virtual:" specifier.
// Vitest runs preview-token-panel-config.ts under plain Vite instead, which
// has no resolver for it at all, so vitest.config.ts aliases the specifier
// to this file.
//
// Mirrors the plugin's production-BUILD branch (both fields undefined) —
// no vitest suite needs the real dev-mode endpoint/routing map; that branch
// is covered directly by plugins/__tests__/zdtp-apply-proxy-plugin.test.ts.
export const applyEndpoint = undefined;
export const applyRouting = undefined;
