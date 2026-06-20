// Ambient type for the eager `import.meta.glob` macro zfb expands at build time.
//
// zfb implements Vite's `import.meta.glob('<literal>', { eager: true })` at the
// bundler level (verified: the styleguide story registry resolves against it),
// but it ships NO TypeScript declaration for the macro — so `tsc --noEmit`
// (`pnpm check`) reports TS2339 "Property 'glob' does not exist on ImportMeta".
//
// This declares ONLY the single form the styleguide uses: eager glob with a
// typed module shape. Lazy / query / import-mode forms are intentionally absent
// because zfb does not support them (it rejects `query`, `import()`-mode, and
// `../` patterns — see packages/sg-registry.ts).

interface ImportMeta {
  glob<T = Record<string, unknown>>(
    pattern: string,
    options: { eager: true },
  ): Record<string, T>;
}
