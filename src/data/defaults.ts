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
 * Mirrors `src/engine/__fixtures__/goldenJob.ts` by design, and the duplication
 * is intentional — see the note there. This list is the painter's EDITABLE
 * starting point; the fixture is a frozen historical record. They begin
 * identical and are expected to diverge as he updates prices.
 */
export const DEFAULT_PRICE_BOOK: PaintProduct[] = [
  {
    id: "K380",
    name: "Fresh Start primer",
    use: "primer",
    listPrice: 35,
    actualPrice: 42,
    packSizeGal: 5,
    priceUpdatedAt: "2026-08-16",
  },
  {
    id: "549",
    name: "Regal Select",
    use: "wall",
    listPrice: 94.99,
    actualPrice: 71.25,
    packSizeGal: 1,
    priceUpdatedAt: "2026-08-16",
  },
  {
    id: "550",
    name: "Regal Pearl (trim)",
    use: "trim",
    listPrice: 94.99,
    actualPrice: 80.74,
    packSizeGal: 1,
    priceUpdatedAt: "2026-08-16",
  },
  {
    id: "K532",
    name: "Aura Bath & Spa",
    use: "specialty",
    listPrice: 112.99,
    actualPrice: 84.74,
    packSizeGal: 1,
    coverageOverride: 550,
    priceUpdatedAt: "2026-08-16",
  },
  {
    id: "K508",
    name: "Waterborne Ceiling",
    use: "ceiling",
    listPrice: 83.99,
    actualPrice: 62.5,
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
