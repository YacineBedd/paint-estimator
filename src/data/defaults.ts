import type { PaintProduct, Project, RateProfile } from "../engine/types";

export const DEFAULT_RATE_PROFILE: RateProfile = {
  laborRate: 75,
  wallRate: 0.75,
  ceilingRate: 0.75,
  trimRate: 0.75,
  hoursPerDay: 8,
  travelHoursPerDay: 1,
  roundRoomHoursUp: true,
  wallCoverage: 500,
  ceilingCoverage: 550,
  spotPrimeFraction: 0.25,
  trimGirthFt: 0.5,
  coats: { walls: 1, trim: 1, ceilings: 2, specialty: 2 },
};

/**
 * Mirrors `src/engine/__fixtures__/goldenJob.ts` in shape (same product
 * `id`s, `name`s, `use`s, `packSizeGal`, `coverageOverride`) but NOT in
 * price — see below.
 *
 * PRICES ARE INTENTIONALLY ZERO. This file is a plain TypeScript module
 * that Vite compiles straight into the JavaScript bundle shipped to the
 * browser, so any literal written here is readable by anyone who opens the
 * deployed site's dev tools. His real supplier pricing is commercially
 * sensitive (negotiated well under Benjamin Moore list) and must never be
 * checked in or shipped.
 *
 * Real prices are entered by the painter himself in Settings after the app
 * loads, and persist only in his own browser's `localStorage` (see
 * `src/data/storage.ts`) — never in this file, never in the built bundle.
 *
 * Do NOT repopulate `listPrice`/`actualPrice` below with a real person's
 * supplier pricing, not even temporarily for testing. Use
 * `src/engine/__fixtures__/goldenJob.ts` for that — it's a frozen test
 * fixture that is never imported by the app and never reaches the bundle.
 *
 * Because a $0 `actualPrice` would otherwise let the app quote $0 for
 * materials without anyone noticing, `src/engine/warnings.ts` raises a
 * hard `UNPRICED_PRODUCT` error for any product referenced by the estimate
 * whose price is still 0.
 */
export const DEFAULT_PRICE_BOOK: PaintProduct[] = [
  {
    id: "K380",
    name: "Fresh Start primer",
    use: "primer",
    listPrice: 0,
    actualPrice: 0,
    packSizeGal: 5,
    priceUpdatedAt: "2026-08-16",
  },
  {
    id: "549",
    name: "Regal Select",
    use: "wall",
    listPrice: 0,
    actualPrice: 0,
    packSizeGal: 1,
    priceUpdatedAt: "2026-08-16",
  },
  {
    id: "550",
    name: "Regal Pearl (trim)",
    use: "trim",
    listPrice: 0,
    actualPrice: 0,
    packSizeGal: 1,
    priceUpdatedAt: "2026-08-16",
  },
  {
    id: "K532",
    name: "Aura Bath & Spa",
    use: "specialty",
    listPrice: 0,
    actualPrice: 0,
    packSizeGal: 1,
    coverageOverride: 550,
    priceUpdatedAt: "2026-08-16",
  },
  {
    id: "K508",
    name: "Waterborne Ceiling",
    use: "ceiling",
    listPrice: 0,
    actualPrice: 0,
    packSizeGal: 1,
    priceUpdatedAt: "2026-08-16",
  },
];

export function newProject(name: string, id: string): Project {
  return {
    id,
    name,
    rooms: [],
    customSurfaces: [],
    rateProfile: { ...DEFAULT_RATE_PROFILE },
    priceBook: DEFAULT_PRICE_BOOK.map((p) => ({ ...p })),
  };
}
