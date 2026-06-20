// Vitest global setup.
//
// - @testing-library/jest-dom adds DOM matchers (toBeInTheDocument, toHaveAttribute…).
// - @testing-library/preact's cleanup runs after each test to unmount renders.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/preact";

afterEach(() => {
  cleanup();
});
