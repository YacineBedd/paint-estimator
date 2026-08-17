import type { Project, Room, CustomSurface, PaintProduct } from "../types";

const scope = (walls: boolean, ceiling: boolean) => ({
  walls,
  ceiling,
  trim: false,
  primer: "full" as const,
});

// Bathroom takes Aura on BOTH walls and ceiling (his K22 = H3+H4+J3+J4).
const bathroom: Room = {
  id: "r1",
  name: "Salle de bains",
  floor: 1,
  quantity: 1,
  walls: [11.8, 11],
  ceilingHeight: 8,
  scope: scope(true, true),
  wallProductId: "K532",
  ceilingProductId: "K532",
  trimProductId: "550",
  openings: [],
};

const bedroom1: Room = {
  id: "r2",
  name: "bedroom 1",
  floor: 1,
  quantity: 1,
  walls: [9.8, 11.3],
  ceilingHeight: 8,
  scope: scope(true, true),
  wallProductId: "549",
  ceilingProductId: "K508",
  trimProductId: "550",
  openings: [],
};

const bedroom2: Room = {
  id: "r3",
  name: "Bedroom 2",
  floor: 1,
  quantity: 1,
  walls: [11.9, 13.2],
  ceilingHeight: 8,
  scope: scope(true, true),
  wallProductId: "549",
  ceilingProductId: "K508",
  trimProductId: "550",
  openings: [],
};

// His D13 is the formula =20.5+10.4+8.5 = 39.4
const kitchen: Room = {
  id: "r4",
  name: "Kitchen/dining/kitchen",
  floor: 1,
  quantity: 1,
  walls: [14.1, 39.4],
  ceilingHeight: 8,
  scope: scope(true, true),
  wallProductId: "549",
  ceilingProductId: "K508",
  trimProductId: "550",
  openings: [],
};

// His row 12: ((3+7)*7)*4 = 280 sq ft, rate 0.75, 1 coat, counted in primer (H20).
const doorsAndTrim: CustomSurface = {
  id: "cs1",
  name: "Doors & trim",
  area: 280,
  rateMinPerSqFt: 0.75,
  productId: "550",
  coats: 1,
  includeInPrimer: true,
};

/**
 * DELIBERATELY DUPLICATES `src/data/defaults.ts` — do not refactor into a
 * shared module. This fixture is a frozen record of the Estimator.xlsx job.
 * If it imported the editable defaults, changing his prices in Settings would
 * silently move the golden test's expected numbers, and the one artifact that
 * proves we reproduce his spreadsheet would stop proving anything.
 */
export const goldenPriceBook: PaintProduct[] = [
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

export const goldenJob: Project = {
  id: "golden",
  name: "Estimator.xlsx reference job",
  rooms: [bathroom, bedroom1, bedroom2, kitchen],
  customSurfaces: [doorsAndTrim],
  rateProfile: {
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
  },
  priceBook: goldenPriceBook,
  actuals: {
    hoursWorked: 39.9145,
    gallonsPurchased: { K380: 5, "549": 4, "550": 1, K532: 2, K508: 4 },
  },
};

/** Verified against Estimator.xlsx. Never change these to make a test pass. */
export const GOLDEN_EXPECTED = {
  perRoom: {
    r1: { wallArea: 364.8, ceilingArea: 129.8, hours: 6.1825, billed: 7 },
    r2: { wallArea: 337.6, ceilingArea: 110.74, hours: 5.60425, billed: 6 },
    r3: { wallArea: 401.6, ceilingArea: 157.08, hours: 6.9835, billed: 7 },
    r4: { wallArea: 856.0, ceilingArea: 555.54, hours: 17.64425, billed: 18 },
  },
  customSurface: { cs1: { area: 280, hours: 3.5, billed: 4 } },
  labor: {
    hoursWorked: 39.9145,
    billedRoomHours: 42,
    days: 5,
    travelHours: 5,
    totalBilledHours: 47,
    laborCost: 3525.0,
  },
  areas: {
    primer: 2240, // all gross wall areas + the 280 custom surface
    walls: 1595.2, // 549: bedroom1 + bedroom2 + kitchen
    aura: 494.6, // K532: bathroom walls 364.8 + bathroom ceiling 129.8
    ceilings: 823.36, // K508: bedroom1 + bedroom2 + kitchen ceilings
    trim: 280,
  },
  gallons: { K380: 5, "549": 4, "550": 1, K532: 2, K508: 3 },
  /** His sheet says Aura 1 — it uses ROUNDDOWN there. We round up. Spec §8.4. */
  sheetGallonsForAura: 1,
  materialCostFromActuals: 995.22,
  totalUsingActuals: 4520.22,
} as const;
