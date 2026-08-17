import { describe, it, expect } from "vitest";
import { collectWarnings } from "../warnings";
import { goldenJob } from "../__fixtures__/goldenJob";
import type { PaintProduct, Project } from "../types";

const product = (priceUpdatedAt: string): PaintProduct => ({
  id: "K380",
  name: "Fresh Start primer",
  use: "primer",
  listPrice: 35,
  actualPrice: 42,
  packSizeGal: 5,
  priceUpdatedAt,
});

const projectWith = (priceBook: PaintProduct[]): Project => ({
  ...goldenJob,
  priceBook,
});

// F5: STALE_PRICE must react to a caller-supplied clock, not a frozen
// literal baked into the engine — otherwise it can never fire (if "now" is
// permanently in the past relative to updates) or always fires (if frozen
// in the future), regardless of what the real date is.
describe("collectWarnings — STALE_PRICE (F5)", () => {
  const now = Date.parse("2027-01-01T00:00:00Z");

  it("does not flag a price updated recently", () => {
    // 10 days before `now`.
    const recent = new Date(now - 10 * 86_400_000).toISOString();
    const warnings = collectWarnings(projectWith([product(recent)]), [], now);
    expect(warnings.some((w) => w.code === "STALE_PRICE")).toBe(false);
  });

  it("flags a price updated more than 6 months (182 days) before now", () => {
    // 200 days before `now`.
    const old = new Date(now - 200 * 86_400_000).toISOString();
    const warnings = collectWarnings(projectWith([product(old)]), [], now);
    expect(warnings.some((w) => w.code === "STALE_PRICE")).toBe(true);
  });

  it("uses the supplied `now`, not a fixed date baked into the engine", () => {
    // Fixed 30 days before an arbitrary, far-future `now` — proves the
    // engine is not silently comparing against some hardcoded date.
    const farFuture = Date.parse("2030-06-01T00:00:00Z");
    const recentRelativeToFarFuture = new Date(
      farFuture - 30 * 86_400_000,
    ).toISOString();
    const warnings = collectWarnings(
      projectWith([product(recentRelativeToFarFuture)]),
      [],
      farFuture,
    );
    expect(warnings.some((w) => w.code === "STALE_PRICE")).toBe(false);
  });

  it("defaults to a deterministic fallback when `now` is omitted", () => {
    // No `now` passed — must not throw, and must remain deterministic
    // (i.e. not silently call Date.now()).
    const old = "2020-01-01T00:00:00Z";
    const warnings = collectWarnings(projectWith([product(old)]), []);
    expect(warnings.some((w) => w.code === "STALE_PRICE")).toBe(true);
  });
});
