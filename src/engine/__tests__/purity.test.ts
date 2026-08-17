import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ENGINE = join(process.cwd(), "src", "engine");
const BANNED = [
  /from\s+["']react["']/,
  /from\s+["']react-dom/,
  /\blocalStorage\b/,
  // Negative lookbehind/lookahead for quotes: `window`/`document` are also
  // legitimate domain words (e.g. OpeningKind's "window" literal). Only ban
  // them as bare identifiers (the browser globals), not as quoted strings.
  /(?<!["'])\bwindow\b(?!["'])/,
  /(?<!["'])\bdocument\b(?!["'])/,
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
