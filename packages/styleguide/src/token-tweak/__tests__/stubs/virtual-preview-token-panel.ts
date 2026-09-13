// Vitest stand-in for `virtual:zudo-sg-preview-token-panel` (only zfb's bundler
// resolves plugin virtual modules). Mirrors the plugin's BUILD branch with no
// `tabsModule`; suites that need tabs `vi.mock` the specifier.
export const tabs = undefined;
export const applyEndpoint = undefined;
export const applyRouting = undefined;
