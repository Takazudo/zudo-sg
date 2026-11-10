// One evaluation per Vitest worker. Importing
// `@testing-library/jest-dom/vitest` twice calls `expect.extend` twice, and
// Vitest 5 then reports `rejects.toThrow` against an empty message.
import "@testing-library/jest-dom/vitest";
