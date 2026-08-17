import { describe, it, expect } from "vitest";
import { collectWarnings } from "../warnings";
import { computeGeometry } from "../geometry";
import { goldenJob, goldenPriceBook } from "../__fixtures__/goldenJob";
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

// The shipped app's DEFAULT_PRICE_BOOK (src/data/defaults.ts) intentionally
// zeroes out every price so real supplier pricing never enters the bundle.
// UNPRICED_PRODUCT is the guard that stops that placeholder data from
// silently producing a $0 quote.
describe("collectWarnings — UNPRICED_PRODUCT", () => {
  const geometry = computeGeometry(goldenJob.rooms, goldenJob.rateProfile);

  it("fires for a zero-priced product that a room actually uses", () => {
    // K508 (Waterborne Ceiling) is the ceilingProductId for bedroom1,
    // bedroom2, and the kitchen in the golden job — very much in use.
    const priceBook = goldenPriceBook.map((p) =>
      p.id === "K508" ? { ...p, actualPrice: 0 } : p,
    );
    const project: Project = { ...goldenJob, priceBook };
    const warnings = collectWarnings(project, geometry);
    const unpriced = warnings.filter((w) => w.code === "UNPRICED_PRODUCT");
    expect(unpriced).toHaveLength(1);
    expect(unpriced[0]!.level).toBe("error");
    expect(unpriced[0]!.message).toMatch(/Waterborne Ceiling/);
    expect(unpriced[0]!.message).toMatch(/Settings/);
  });

  it("does not fire for a zero-priced product no room references", () => {
    const unused: PaintProduct = {
      id: "unused-1",
      name: "Never Assigned Paint",
      use: "wall",
      listPrice: 0,
      actualPrice: 0,
      packSizeGal: 1,
      priceUpdatedAt: "2026-08-16",
    };
    // goldenPriceBook itself is fully (and realistically) priced, so the
    // only zero-priced product here is the unreferenced one appended below.
    const project: Project = {
      ...goldenJob,
      priceBook: [...goldenPriceBook, unused],
    };
    const warnings = collectWarnings(project, geometry);
    expect(warnings.some((w) => w.code === "UNPRICED_PRODUCT")).toBe(false);
  });

  it("stops firing once a price is set", () => {
    const priceBook = goldenPriceBook.map((p) =>
      p.id === "K508" ? { ...p, actualPrice: 0 } : p,
    );
    const zeroed: Project = { ...goldenJob, priceBook };
    expect(
      collectWarnings(zeroed, geometry).some(
        (w) => w.code === "UNPRICED_PRODUCT",
      ),
    ).toBe(true);

    const priced = priceBook.map((p) =>
      p.id === "K508" ? { ...p, actualPrice: 62.5 } : p,
    );
    const fixed: Project = { ...goldenJob, priceBook: priced };
    expect(
      collectWarnings(fixed, geometry).some(
        (w) => w.code === "UNPRICED_PRODUCT",
      ),
    ).toBe(false);
  });
});
