import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// vite.config.ts does not set `test.globals: true`, so testing-library's
// automatic-cleanup hook (which looks for a global `afterEach`) never
// registers. Without this, DOM from one test leaks into the next and
// getByRole/getByTestId queries start matching multiple elements.
afterEach(() => {
  cleanup();
});
