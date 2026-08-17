import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ENGINE = join(process.cwd(), "src", "engine");
// Negative lookbehind/lookahead for quotes: several of these words are also
// plausible domain vocabulary (e.g. OpeningKind's "window" literal, or a
// future "location"/"history" field). Applying the exclusion uniformly means
// a quoted string literal can never trip a ban meant for a bare identifier
// (the actual browser global / import).
const noQuotes = (word: string) => new RegExp(`(?<!["'])\\b${word}\\b(?!["'])`);

const BANNED = [
  /from\s+["']react["']/,
  /from\s+["']react-dom/,
  noQuotes("localStorage"),
  noQuotes("sessionStorage"),
  noQuotes("indexedDB"),
  noQuotes("XMLHttpRequest"),
  noQuotes("fetch"),
  noQuotes("navigator"),
  noQuotes("alert"),
  noQuotes("window"),
  noQuotes("document"),
  noQuotes("location"),
  noQuotes("history"),
  noQuotes("requestAnimationFrame"),
];

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "__tests__" ? [] : tsFiles(full);
    }
    return full.endsWith(".ts") ? [full] : [];
  });
}

describe("engine purity", () => {
  it("imports no framework or browser APIs", () => {
    for (const file of tsFiles(ENGINE)) {
      const src = readFileSync(file, "utf8");
      for (const pattern of BANNED) {
        expect(pattern.test(src), `${file} matched ${pattern}`).toBe(false);
      }
    }
  });
});
