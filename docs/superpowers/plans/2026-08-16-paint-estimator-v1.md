# Paint Estimator v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local-first web app that reproduces a working painter's estimating spreadsheet exactly, adds the door/window handling he asked for, and automates his manual calibration loop.

**Architecture:** A pure TypeScript engine (`src/engine/`) with zero framework dependencies and zero I/O takes geometry + rates in and returns a full itemized estimate. A React UI consumes it. The engine is the product; the UI is a shell around it. `geometry.ts` is the sole seam the phase-2 floorplan sketcher will touch.

**Tech Stack:** TypeScript 5.x (strict), React 18, Vite 5, Vitest, `localStorage`. No backend, no database, no auth, no runtime dependencies in the engine.

**Spec:** `docs/superpowers/specs/2026-08-16-paint-estimator-design.md`

## Global Constraints

- **Units:** feet and square feet throughout. Currency CAD. Never metric in v1.
- **All paint prices are per gallon, always.** `packSizeGal` is display/ordering metadata and must never participate in a price calculation. This is spec defect 2.
- **`src/engine/**` must not import React, browser APIs, `localStorage`, or any npm runtime dependency.** Enforced by a test in Task 2.
- **Gallons always round UP** via `Math.ceil`. You cannot buy a partial gallon.
- **Money is compared in tests to 2 decimal places** using `toBeCloseTo(expected, 2)`. Hours compare to 4 decimal places.
- **TypeScript `strict: true`.** No `any` in engine code.
- **The golden fixture is sacred.** Never edit `src/engine/__fixtures__/goldenJob.ts` to make a test pass. If the engine disagrees with it, the engine is wrong.
- Every task ends with a commit. Conventional commit prefixes: `feat:`, `test:`, `chore:`, `fix:`.

---

## File Structure

```
src/
  engine/
    types.ts                    all shared types; no logic
    geometry.ts                 rooms + openings → areas and linear footage
    labor.ts                    areas → hours → roundup → travel → cost
    materials.ts                areas + coats + coverage → gallons per product
    pricing.ts                  gallons + price book → money
    calibration.ts              actuals vs estimate → coverage/rate drift
    estimate.ts                 orchestrator
    warnings.ts                 validation and advisory warnings
    __fixtures__/goldenJob.ts   the Estimator.xlsx job as data
  data/
    defaults.ts                 his rate profile and price book, seeded
    storage.ts                  localStorage persistence + export/import
  ui/
    App.tsx                     routing between the five screens
    TakeoffScreen.tsx           room table + openings editor
    RoomRow.tsx                 one room's inputs
    OpeningsEditor.tsx          doors/windows for one room
    ResultsScreen.tsx           breakdown + margin levers
    SettingsScreen.tsx          rate profile + price book editors
    CloseoutScreen.tsx          actuals entry + drift report
    QuickEstimateScreen.tsx     whole-house ballpark (built last, cuttable)
  main.tsx
```

**Task dependency order.** Tasks 1–2 are foundational. Tasks 3, 4, and 5 are independent of each other and may run in parallel once 2 is done. Task 6 needs 3+4+5.

```
1 → 2 → ┬→ 3 (geometry) ─┐
        ├→ 4 (labor)     ├→ 6 (estimate + golden) → 7 (calibration) → 8 (data)
        └→ 5 (materials) ┘                                              ↓
                                                    9 (takeoff UI) → 10 (results)
                                                                       ↓
                                                    11 (settings) → 12 (closeout) → 13 (quick)
```

---

### Task 1: Project scaffold

**Files:**

- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `.gitignore` (already exists — verify)
- Test: `src/engine/__tests__/smoke.test.ts`

**Interfaces:**

- Consumes: nothing
- Produces: a working `npm test` and `npm run dev`

- [ ] **Step 1: Scaffold the project**

```bash
cd "/Users/yacinebeddiari/Desktop/Paint estomator"
npm create vite@latest . -- --template react-ts
```

If the directory is non-empty, Vite prompts — choose "Ignore files and continue". Then:

```bash
npm install
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Enable strict mode**

In `tsconfig.json`, ensure `compilerOptions` contains:

```json
"strict": true,
"noUncheckedIndexedAccess": true
```

- [ ] **Step 4: Write a smoke test**

Create `src/engine/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + react + typescript + vitest"
```

---

### Task 2: Engine types and the golden fixture

This task encodes the reference job as data. Every later task tests against it. Get the numbers exactly right — they are copied from `Estimator.xlsx` and verified.

**Files:**

- Create: `src/engine/types.ts`, `src/engine/__fixtures__/goldenJob.ts`
- Test: `src/engine/__tests__/purity.test.ts`

**Interfaces:**

- Consumes: nothing
- Produces: every type below, plus `goldenJob: Project` and `GOLDEN_EXPECTED`

- [ ] **Step 1: Write the types**

Create `src/engine/types.ts`:

```ts
export type OpeningKind = "door" | "window" | "passage";
export type PrimerScope = "none" | "spot" | "full";
export type ProductUse = "primer" | "wall" | "ceiling" | "trim" | "specialty";

export interface Opening {
  id: string;
  kind: OpeningKind;
  quantity: number;
  width: number; // ft
  height: number; // ft
  paintSlab: boolean; // paint both faces of a door
  casedSides: 0 | 1 | 2;
}

export interface RoomScope {
  walls: boolean;
  ceiling: boolean;
  trim: boolean;
  primer: PrimerScope;
}

export interface Room {
  id: string;
  name: string;
  floor: number;
  quantity: number;
  walls: number[]; // 2 entries (rectangular, mirrored) or 4
  ceilingHeight: number;
  scope: RoomScope;
  wallProductId: string;
  ceilingProductId: string;
  trimProductId: string;
  openings: Opening[];
}

/** Anything that is not a room: his `Doors & trim` row, a garage door, an elevation. */
export interface CustomSurface {
  id: string;
  name: string;
  area: number;
  rateMinPerSqFt: number;
  productId: string;
  coats: number;
  includeInPrimer: boolean;
}

export interface Coats {
  walls: number;
  trim: number;
  ceilings: number;
  specialty: number;
}

export interface RateProfile {
  laborRate: number; // $/hr
  wallRate: number; // min/sq ft
  ceilingRate: number;
  trimRate: number;
  hoursPerDay: number;
  travelHoursPerDay: number;
  roundRoomHoursUp: boolean;
  wallCoverage: number; // sq ft/gal
  ceilingCoverage: number;
  spotPrimeFraction: number;
  trimGirthFt: number; // converts trim linear ft to area
  coats: Coats;
}

export interface PaintProduct {
  id: string;
  name: string;
  use: ProductUse;
  listPrice: number; // per gallon, always
  actualPrice: number; // per gallon, always
  packSizeGal: number; // display/ordering only — never priced
  coverageOverride?: number;
  priceUpdatedAt: string; // ISO date
}

export interface JobActuals {
  hoursWorked: number;
  gallonsPurchased: Record<string, number>;
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  rooms: Room[];
  customSurfaces: CustomSurface[];
  rateProfile: RateProfile;
  priceBook: PaintProduct[];
  actuals?: JobActuals;
}

// ---------- engine outputs ----------

export interface RoomGeometry {
  roomId: string;
  grossWallArea: number;
  openingArea: number;
  netWallArea: number;
  ceilingArea: number;
  baseboardLinFt: number;
  casingLinFt: number;
  doorSlabArea: number;
  trimArea: number;
}

export interface RoomLabor {
  roomId: string;
  wallHours: number;
  ceilingHours: number;
  trimHours: number;
  totalHours: number;
  billedHours: number;
}

export interface LaborResult {
  rooms: RoomLabor[];
  hoursWorked: number;
  billedRoomHours: number;
  days: number;
  travelHours: number;
  totalBilledHours: number;
  laborCost: number;
}

export interface ProductRequirement {
  productId: string;
  coatedArea: number;
  coats: number;
  coverage: number;
  rawGallons: number;
  gallons: number; // Math.ceil(rawGallons)
}

export interface MaterialsResult {
  requirements: ProductRequirement[];
  totalGallons: number;
}

export interface MaterialLine {
  productId: string;
  name: string;
  gallons: number;
  unitPrice: number;
  lineCost: number;
  listUnitPrice: number;
  listLineCost: number;
}

export interface PricingResult {
  materialLines: MaterialLine[];
  materialCost: number;
  materialCostAtList: number;
  laborCost: number;
  total: number;
}

export type WarningLevel = "error" | "warning" | "info";

export interface Warning {
  level: WarningLevel;
  code: string;
  message: string;
  roomId?: string;
}

export interface Estimate {
  geometry: RoomGeometry[];
  labor: LaborResult;
  materials: MaterialsResult;
  pricing: PricingResult;
  warnings: Warning[];
}
```

- [ ] **Step 2: Write the golden fixture**

Create `src/engine/__fixtures__/goldenJob.ts`. Note that all rooms have `trim: false` and no openings — his sheet handles doors and trim as one separate 280 sq ft line, which becomes a `CustomSurface`.

```ts
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
```

- [ ] **Step 3: Write the engine purity test**

Create `src/engine/__tests__/purity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ENGINE = join(process.cwd(), "src", "engine");
const BANNED = [
  /from\s+["']react["']/,
  /from\s+["']react-dom/,
  /\blocalStorage\b/,
  /\bwindow\b/,
  /\bdocument\b/,
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
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS. The purity test passes trivially now and guards every later task.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add engine types and the Estimator.xlsx golden fixture"
```

---

### Task 3: Geometry

**Files:**

- Create: `src/engine/geometry.ts`
- Test: `src/engine/__tests__/geometry.test.ts`

**Interfaces:**

- Consumes: `Room`, `Opening`, `RoomGeometry`, `RateProfile` from `../types`
- Produces:
  - `roomPerimeter(room: Room): number`
  - `computeRoomGeometry(room: Room, rates: RateProfile): RoomGeometry`
  - `computeGeometry(rooms: Room[], rates: RateProfile): RoomGeometry[]`

- [ ] **Step 1: Write the failing tests**

Create `src/engine/__tests__/geometry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeRoomGeometry, roomPerimeter } from "../geometry";
import { goldenJob, GOLDEN_EXPECTED } from "../__fixtures__/goldenJob";
import type { Room, RateProfile } from "../types";

const rates: RateProfile = goldenJob.rateProfile;

// `as unknown as Room` is required — a bare `as Room` fails under strict TS
// because the object literal does not sufficiently overlap the full Room type.
const wallsOnly = (walls: number[]) => ({ walls }) as unknown as Room;

describe("roomPerimeter", () => {
  it("mirrors a 2-entry wall list", () => {
    expect(roomPerimeter(wallsOnly([11.8, 11]))).toBeCloseTo(45.6, 4);
  });

  it("sums a 4-entry wall list as given", () => {
    expect(roomPerimeter(wallsOnly([10, 12, 10, 12]))).toBeCloseTo(44, 4);
  });
});

describe("computeRoomGeometry — golden rooms, no openings", () => {
  for (const room of goldenJob.rooms) {
    const expected =
      GOLDEN_EXPECTED.perRoom[room.id as keyof typeof GOLDEN_EXPECTED.perRoom];

    it(`${room.name}: wall ${expected.wallArea}, ceiling ${expected.ceilingArea}`, () => {
      const g = computeRoomGeometry(room, rates);
      expect(g.grossWallArea).toBeCloseTo(expected.wallArea, 4);
      expect(g.netWallArea).toBeCloseTo(expected.wallArea, 4);
      expect(g.openingArea).toBe(0);
      expect(g.ceilingArea).toBeCloseTo(expected.ceilingArea, 4);
    });
  }
});

describe("openings", () => {
  const base: Room = {
    ...goldenJob.rooms[1]!,
    id: "t1",
    walls: [10, 10],
    ceilingHeight: 8,
    scope: { walls: true, ceiling: true, trim: true, primer: "full" },
  };

  it("deducts opening area from gross wall area", () => {
    const room: Room = {
      ...base,
      openings: [
        {
          id: "o1",
          kind: "door",
          quantity: 2,
          width: 3,
          height: 7,
          paintSlab: true,
          casedSides: 2,
        },
      ],
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.grossWallArea).toBeCloseTo(320, 4); // 40 perimeter × 8
    expect(g.openingArea).toBeCloseTo(42, 4); // 2 doors × 21
    expect(g.netWallArea).toBeCloseTo(278, 4);
  });

  it("shortens baseboard by door widths but not window widths", () => {
    const room: Room = {
      ...base,
      openings: [
        {
          id: "o1",
          kind: "door",
          quantity: 2,
          width: 3,
          height: 7,
          paintSlab: true,
          casedSides: 2,
        },
        {
          id: "o2",
          kind: "window",
          quantity: 1,
          width: 4,
          height: 3,
          paintSlab: false,
          casedSides: 1,
        },
      ],
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.baseboardLinFt).toBeCloseTo(34, 4); // 40 − (2 × 3)
  });

  it("computes casing: doors (2h+w) per cased side, windows 2(w+h)", () => {
    const room: Room = {
      ...base,
      openings: [
        {
          id: "o1",
          kind: "door",
          quantity: 1,
          width: 3,
          height: 7,
          paintSlab: true,
          casedSides: 2,
        },
        {
          id: "o2",
          kind: "window",
          quantity: 1,
          width: 4,
          height: 3,
          paintSlab: false,
          casedSides: 1,
        },
      ],
    };
    const g = computeRoomGeometry(room, rates);
    // door: (2×7 + 3) × 2 = 34 ; window: 2 × (4+3) × 1 = 14
    expect(g.casingLinFt).toBeCloseTo(48, 4);
  });

  it("paints both faces of a door slab, and nothing when paintSlab is false", () => {
    const withSlab: Room = {
      ...base,
      openings: [
        {
          id: "o1",
          kind: "door",
          quantity: 1,
          width: 3,
          height: 7,
          paintSlab: true,
          casedSides: 2,
        },
      ],
    };
    const withoutSlab: Room = {
      ...withSlab,
      openings: [{ ...withSlab.openings[0]!, paintSlab: false }],
    };
    expect(computeRoomGeometry(withSlab, rates).doorSlabArea).toBeCloseTo(
      42,
      4,
    );
    expect(computeRoomGeometry(withoutSlab, rates).doorSlabArea).toBe(0);
  });

  it("reproduces the spec's ~67.5 sq ft decomposition for one 3x7 door", () => {
    const room: Room = {
      ...base,
      walls: [10, 10],
      openings: [
        {
          id: "o1",
          kind: "door",
          quantity: 1,
          width: 3,
          height: 7,
          paintSlab: true,
          casedSides: 2,
        },
      ],
    };
    const g = computeRoomGeometry(room, rates);
    // slab 42 + casing 34 lf × 0.5 girth = 17 → 59 for the door alone.
    // Baseboard is the room's, not the door's, so subtract it out.
    const doorOnly = g.doorSlabArea + g.casingLinFt * rates.trimGirthFt;
    expect(doorOnly).toBeGreaterThan(55);
    expect(doorOnly).toBeLessThan(62);
  });

  it("multiplies geometry by room quantity", () => {
    const single: Room = { ...base, quantity: 1, openings: [] };
    const triple: Room = { ...base, quantity: 3, openings: [] };
    expect(computeRoomGeometry(triple, rates).grossWallArea).toBeCloseTo(
      computeRoomGeometry(single, rates).grossWallArea * 3,
      4,
    );
  });

  it("never returns a negative net wall area", () => {
    const room: Room = {
      ...base,
      walls: [2, 2],
      ceilingHeight: 8,
      openings: [
        {
          id: "o1",
          kind: "window",
          quantity: 20,
          width: 4,
          height: 3,
          paintSlab: false,
          casedSides: 1,
        },
      ],
    };
    expect(computeRoomGeometry(room, rates).netWallArea).toBe(0);
  });

  it("returns zero areas for surfaces out of scope", () => {
    const room: Room = {
      ...base,
      openings: [],
      scope: { walls: false, ceiling: false, trim: false, primer: "none" },
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.netWallArea).toBe(0);
    expect(g.ceilingArea).toBe(0);
    expect(g.trimArea).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/geometry.test.ts`
Expected: FAIL — `Failed to resolve import "../geometry"`.

- [ ] **Step 3: Implement geometry**

Create `src/engine/geometry.ts`:

```ts
import type { Opening, RateProfile, Room, RoomGeometry } from "./types";

/** A 2-entry wall list means a rectangle: [a, b] → a + b + a + b. */
export function roomPerimeter(room: Room): number {
  const walls = room.walls;
  if (walls.length === 2) {
    return (walls[0]! + walls[1]!) * 2;
  }
  return walls.reduce((sum, w) => sum + w, 0);
}

const openingArea = (o: Opening): number => o.width * o.height * o.quantity;

const casingLinFt = (o: Opening): number =>
  o.kind === "door" || o.kind === "passage"
    ? (2 * o.height + o.width) * o.casedSides * o.quantity
    : 2 * (o.width + o.height) * o.casedSides * o.quantity;

const slabArea = (o: Opening): number =>
  o.kind === "door" && o.paintSlab ? o.width * o.height * 2 * o.quantity : 0;

export function computeRoomGeometry(
  room: Room,
  rates: RateProfile,
): RoomGeometry {
  const qty = room.quantity ?? 1;
  const perimeter = roomPerimeter(room);
  const grossWallArea = perimeter * room.ceilingHeight * qty;

  const openings = room.openings ?? [];
  const deduction = openings.reduce((sum, o) => sum + openingArea(o), 0) * qty;
  const openingAreaTotal = Math.min(deduction, grossWallArea);

  const doorWidths = openings
    .filter((o) => o.kind === "door" || o.kind === "passage")
    .reduce((sum, o) => sum + o.width * o.quantity, 0);

  const baseboard = Math.max(0, perimeter - doorWidths) * qty;
  const casing = openings.reduce((sum, o) => sum + casingLinFt(o), 0) * qty;
  const slab = openings.reduce((sum, o) => sum + slabArea(o), 0) * qty;

  const inScope = (on: boolean, value: number) => (on ? value : 0);

  return {
    roomId: room.id,
    grossWallArea: inScope(room.scope.walls, grossWallArea),
    openingArea: inScope(room.scope.walls, openingAreaTotal),
    netWallArea: inScope(
      room.scope.walls,
      Math.max(0, grossWallArea - openingAreaTotal),
    ),
    ceilingArea: inScope(
      room.scope.ceiling,
      room.walls.length >= 2 ? room.walls[0]! * room.walls[1]! * qty : 0,
    ),
    baseboardLinFt: inScope(room.scope.trim, baseboard),
    casingLinFt: inScope(room.scope.trim, casing),
    doorSlabArea: inScope(room.scope.trim, slab),
    trimArea: inScope(
      room.scope.trim,
      (baseboard + casing) * rates.trimGirthFt + slab,
    ),
  };
}

export function computeGeometry(
  rooms: Room[],
  rates: RateProfile,
): RoomGeometry[] {
  return rooms.map((room) => computeRoomGeometry(room, rates));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/__tests__/geometry.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/geometry.ts src/engine/__tests__/geometry.test.ts
git commit -m "feat: add geometry with opening deduction and trim derivation"
```

---

### Task 4: Labor

Depends only on Task 2's types. Can run in parallel with Tasks 3 and 5.

**Files:**

- Create: `src/engine/labor.ts`
- Test: `src/engine/__tests__/labor.test.ts`

**Interfaces:**

- Consumes: `RoomGeometry`, `CustomSurface`, `RateProfile`, `LaborResult`, `RoomLabor`
- Produces: `computeLabor(geometry: RoomGeometry[], customSurfaces: CustomSurface[], rates: RateProfile): LaborResult`

Note: custom surfaces appear in `LaborResult.rooms` keyed by their own id, so `billedRoomHours` includes them. His sheet rounds up per row, and `Doors & trim` is a row.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/__tests__/labor.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeLabor } from "../labor";
import { computeGeometry } from "../geometry";
import { goldenJob, GOLDEN_EXPECTED } from "../__fixtures__/goldenJob";

const rates = goldenJob.rateProfile;
const geometry = computeGeometry(goldenJob.rooms, rates);
const result = computeLabor(geometry, goldenJob.customSurfaces, rates);

describe("computeLabor — golden job", () => {
  it("matches per-room hours and roundup", () => {
    for (const [id, expected] of Object.entries(GOLDEN_EXPECTED.perRoom)) {
      const row = result.rooms.find((r) => r.roomId === id);
      expect(row, `missing room ${id}`).toBeDefined();
      expect(row!.totalHours).toBeCloseTo(expected.hours, 4);
      expect(row!.billedHours).toBe(expected.billed);
    }
  });

  it("bills the Doors & trim custom surface at 3.5 hrs → 4", () => {
    const row = result.rooms.find((r) => r.roomId === "cs1");
    expect(row!.totalHours).toBeCloseTo(3.5, 4);
    expect(row!.billedHours).toBe(4);
  });

  it("totals 39.9145 hours worked", () => {
    expect(result.hoursWorked).toBeCloseTo(
      GOLDEN_EXPECTED.labor.hoursWorked,
      4,
    );
  });

  it("bills 42 room hours", () => {
    expect(result.billedRoomHours).toBe(GOLDEN_EXPECTED.labor.billedRoomHours);
  });

  it("derives days from UNROUNDED hours: ceil(39.9145 / 8) = 5", () => {
    expect(result.days).toBe(5);
  });

  it("adds 1 travel hour per day", () => {
    expect(result.travelHours).toBe(5);
  });

  it("totals 47 billed hours at $3,525.00", () => {
    expect(result.totalBilledHours).toBe(47);
    expect(result.laborCost).toBeCloseTo(3525.0, 2);
  });
});

describe("computeLabor — options", () => {
  it("skips per-room rounding when roundRoomHoursUp is false", () => {
    const r = computeLabor(geometry, goldenJob.customSurfaces, {
      ...rates,
      roundRoomHoursUp: false,
    });
    expect(r.billedRoomHours).toBeCloseTo(39.9145, 4);
    expect(r.totalBilledHours).toBeCloseTo(44.9145, 4);
  });

  it("never bills fewer hours than were worked", () => {
    expect(result.totalBilledHours).toBeGreaterThanOrEqual(result.hoursWorked);
  });

  it("applies the trim rate independently of the wall rate", () => {
    const r = computeLabor(geometry, goldenJob.customSurfaces, {
      ...rates,
      trimRate: 1.5,
    });
    const trimRow = r.rooms.find((x) => x.roomId === "cs1");
    expect(trimRow!.totalHours).toBeCloseTo(7.0, 4); // 280 × 1.5 / 60
  });

  it("returns zeros for an empty job", () => {
    const r = computeLabor([], [], rates);
    expect(r.hoursWorked).toBe(0);
    expect(r.days).toBe(0);
    expect(r.travelHours).toBe(0);
    expect(r.laborCost).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/labor.test.ts`
Expected: FAIL — cannot resolve `../labor`.

- [ ] **Step 3: Implement labor**

Create `src/engine/labor.ts`:

```ts
import type {
  CustomSurface,
  LaborResult,
  RateProfile,
  RoomGeometry,
  RoomLabor,
} from "./types";

const hours = (area: number, minPerSqFt: number): number =>
  (area * minPerSqFt) / 60;

export function computeLabor(
  geometry: RoomGeometry[],
  customSurfaces: CustomSurface[],
  rates: RateProfile,
): LaborResult {
  const bill = (h: number) => (rates.roundRoomHoursUp ? Math.ceil(h) : h);

  const roomRows: RoomLabor[] = geometry.map((g) => {
    const wallHours = hours(g.netWallArea, rates.wallRate);
    const ceilingHours = hours(g.ceilingArea, rates.ceilingRate);
    const trimHours = hours(g.trimArea, rates.trimRate);
    const totalHours = wallHours + ceilingHours + trimHours;
    return {
      roomId: g.roomId,
      wallHours,
      ceilingHours,
      trimHours,
      totalHours,
      billedHours: bill(totalHours),
    };
  });

  const customRows: RoomLabor[] = customSurfaces.map((cs) => {
    const totalHours = hours(cs.area, cs.rateMinPerSqFt);
    return {
      roomId: cs.id,
      wallHours: 0,
      ceilingHours: 0,
      trimHours: totalHours,
      totalHours,
      billedHours: bill(totalHours),
    };
  });

  const rows = [...roomRows, ...customRows];
  const hoursWorked = rows.reduce((sum, r) => sum + r.totalHours, 0);
  const billedRoomHours = rows.reduce((sum, r) => sum + r.billedHours, 0);

  // Days come from UNROUNDED hours, matching his K17 = L17/8 → ROUNDUP.
  const days = hoursWorked > 0 ? Math.ceil(hoursWorked / rates.hoursPerDay) : 0;
  const travelHours = days * rates.travelHoursPerDay;
  const totalBilledHours = billedRoomHours + travelHours;

  return {
    rooms: rows,
    hoursWorked,
    billedRoomHours,
    days,
    travelHours,
    totalBilledHours,
    laborCost: totalBilledHours * rates.laborRate,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/__tests__/labor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/labor.ts src/engine/__tests__/labor.test.ts
git commit -m "feat: add labor with per-room roundup and travel hours"
```

---

### Task 5: Materials

Depends only on Task 2's types. Can run in parallel with Tasks 3 and 4.

**Files:**

- Create: `src/engine/materials.ts`
- Test: `src/engine/__tests__/materials.test.ts`

**Interfaces:**

- Consumes: `Room`, `RoomGeometry`, `CustomSurface`, `RateProfile`, `PaintProduct`, `MaterialsResult`, `ProductRequirement`
- Produces: `computeMaterials(rooms, geometry, customSurfaces, rates, priceBook): MaterialsResult`

**Allocation rules** (these reproduce his sheet — read carefully):

- Wall area goes to `room.wallProductId`; ceiling area to `room.ceilingProductId`; trim area to `room.trimProductId`. The bathroom points both walls and ceiling at `K532`, which is how his `K22 = H3+H4+J3+J4` arises without any hardcoded room list.
- Coats come from `rates.coats`, chosen by the **product's** `use`: `wall`→walls, `ceiling`→ceilings, `trim`→trim, `specialty`→specialty, `primer`→1.
- Coverage is `product.coverageOverride` if set, else `ceilingCoverage` for `use === 'ceiling'`, else `wallCoverage`.
- Primer area is the sum of **gross** wall areas of rooms whose `scope.primer !== 'none'` (scaled by `spotPrimeFraction` when `'spot'`), plus custom surfaces with `includeInPrimer`. Primer is always 1 coat and uses `wallCoverage`. Primer product is the first product in the book with `use === 'primer'`.

**Known v1 limitation, deliberate:** coats are resolved per _product_, so if a room's
`trimProductId` and a `CustomSurface` both point at product `550`, the custom surface's
coat count wins for the merged total. This cannot occur in the golden job (its rooms all
have `scope.trim === false`) and is unlikely in practice, since a product normally carries
one coat count. Do not add per-surface coat tracking to solve it in v1 — note it and move
on.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/__tests__/materials.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeMaterials } from "../materials";
import { computeGeometry } from "../geometry";
import { goldenJob, GOLDEN_EXPECTED } from "../__fixtures__/goldenJob";

const rates = goldenJob.rateProfile;
const geometry = computeGeometry(goldenJob.rooms, rates);
const result = computeMaterials(
  goldenJob.rooms,
  geometry,
  goldenJob.customSurfaces,
  rates,
  goldenJob.priceBook,
);

const req = (id: string) =>
  result.requirements.find((r) => r.productId === id)!;

describe("computeMaterials — golden job areas", () => {
  it("allocates 1595.2 sq ft to walls (549)", () => {
    expect(req("549").coatedArea).toBeCloseTo(GOLDEN_EXPECTED.areas.walls, 2);
  });

  it("allocates 494.6 sq ft to Aura (K532) — bathroom walls AND ceiling", () => {
    expect(req("K532").coatedArea).toBeCloseTo(GOLDEN_EXPECTED.areas.aura, 2);
  });

  it("allocates 823.36 sq ft to ceilings (K508)", () => {
    expect(req("K508").coatedArea).toBeCloseTo(
      GOLDEN_EXPECTED.areas.ceilings,
      2,
    );
  });

  it("allocates 280 sq ft to trim (550)", () => {
    expect(req("550").coatedArea).toBeCloseTo(GOLDEN_EXPECTED.areas.trim, 2);
  });

  it("primes 2240 sq ft — every gross wall plus the trim surface", () => {
    expect(req("K380").coatedArea).toBeCloseTo(GOLDEN_EXPECTED.areas.primer, 2);
  });
});

describe("computeMaterials — golden job gallons", () => {
  it("matches his D column for every product except Aura", () => {
    expect(req("K380").gallons).toBe(5); // 2240/500 = 4.48
    expect(req("549").gallons).toBe(4); // 1595.2×1/500 = 3.1904
    expect(req("550").gallons).toBe(1); // 280×1/500 = 0.56
    expect(req("K508").gallons).toBe(3); // 823.36×2/550 = 2.994
  });

  // His sheet ROUNDDOWNs this one line to 1 gallon; we round up like every
  // other product. GOLDEN_EXPECTED.sheetGallonsForAura records what his sheet
  // said, so the divergence is asserted against it rather than hardcoded here.
  it("returns Aura 2, diverging from the sheet's 1 — his ROUNDDOWN is the bug", () => {
    expect(req("K532").rawGallons).toBeCloseTo(1.7985, 3);
    expect(req("K532").gallons).toBe(2);
    expect(req("K532").gallons).not.toBe(GOLDEN_EXPECTED.sheetGallonsForAura);
  });

  it("uses the 550 coverageOverride for Aura, not 500", () => {
    expect(req("K532").coverage).toBe(550);
  });

  it("applies 2 coats to ceilings and specialty, 1 to walls and trim", () => {
    expect(req("K508").coats).toBe(2);
    expect(req("K532").coats).toBe(2);
    expect(req("549").coats).toBe(1);
    expect(req("550").coats).toBe(1);
  });
});

describe("computeMaterials — regressions", () => {
  it("includes a stairwell room in BOTH primer and finish paint (defect 1)", () => {
    const stairs = {
      ...goldenJob.rooms[1]!,
      id: "stairs",
      name: "stairs",
      walls: [4, 12],
      wallProductId: "549",
      ceilingProductId: "K508",
    };
    const rooms = [...goldenJob.rooms, stairs];
    const g = computeGeometry(rooms, rates);
    const r = computeMaterials(
      rooms,
      g,
      goldenJob.customSurfaces,
      rates,
      goldenJob.priceBook,
    );
    const walls = r.requirements.find((x) => x.productId === "549")!;
    const primer = r.requirements.find((x) => x.productId === "K380")!;
    expect(walls.coatedArea).toBeGreaterThan(GOLDEN_EXPECTED.areas.walls);
    expect(primer.coatedArea).toBeGreaterThan(GOLDEN_EXPECTED.areas.primer);
  });

  it("scales primer by spotPrimeFraction when scope is 'spot'", () => {
    const rooms = goldenJob.rooms.map((r) => ({
      ...r,
      scope: { ...r.scope, primer: "spot" as const },
    }));
    const g = computeGeometry(rooms, rates);
    const r = computeMaterials(
      rooms,
      g,
      goldenJob.customSurfaces,
      rates,
      goldenJob.priceBook,
    );
    const primer = r.requirements.find((x) => x.productId === "K380")!;
    // 1960 gross room walls × 0.25 + 280 custom = 770
    expect(primer.coatedArea).toBeCloseTo(770, 1);
  });

  it("omits primer entirely when every room is 'none'", () => {
    const rooms = goldenJob.rooms.map((r) => ({
      ...r,
      scope: { ...r.scope, primer: "none" as const },
    }));
    const g = computeGeometry(rooms, rates);
    const r = computeMaterials(rooms, g, [], rates, goldenJob.priceBook);
    expect(r.requirements.find((x) => x.productId === "K380")).toBeUndefined();
  });

  it("never rounds a nonzero area down to zero gallons", () => {
    const rooms = [{ ...goldenJob.rooms[1]!, walls: [1, 1], ceilingHeight: 1 }];
    const g = computeGeometry(rooms, rates);
    const r = computeMaterials(rooms, g, [], rates, goldenJob.priceBook);
    for (const requirement of r.requirements) {
      if (requirement.coatedArea > 0)
        expect(requirement.gallons).toBeGreaterThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/materials.test.ts`
Expected: FAIL — cannot resolve `../materials`.

- [ ] **Step 3: Implement materials**

Create `src/engine/materials.ts`:

```ts
import type {
  CustomSurface,
  MaterialsResult,
  PaintProduct,
  ProductRequirement,
  RateProfile,
  Room,
  RoomGeometry,
} from "./types";

function coatsFor(product: PaintProduct, rates: RateProfile): number {
  switch (product.use) {
    case "primer":
      return 1;
    case "wall":
      return rates.coats.walls;
    case "ceiling":
      return rates.coats.ceilings;
    case "trim":
      return rates.coats.trim;
    case "specialty":
      return rates.coats.specialty;
  }
}

function coverageFor(product: PaintProduct, rates: RateProfile): number {
  if (product.coverageOverride !== undefined) return product.coverageOverride;
  return product.use === "ceiling" ? rates.ceilingCoverage : rates.wallCoverage;
}

export function computeMaterials(
  rooms: Room[],
  geometry: RoomGeometry[],
  customSurfaces: CustomSurface[],
  rates: RateProfile,
  priceBook: PaintProduct[],
): MaterialsResult {
  const byId = new Map(priceBook.map((p) => [p.id, p]));
  const geoById = new Map(geometry.map((g) => [g.roomId, g]));

  /** productId → coated area, before coats are applied */
  const areas = new Map<string, number>();
  const add = (productId: string, area: number) => {
    if (area <= 0) return;
    areas.set(productId, (areas.get(productId) ?? 0) + area);
  };

  let primerArea = 0;

  for (const room of rooms) {
    const g = geoById.get(room.id);
    if (!g) continue;

    add(room.wallProductId, g.netWallArea);
    add(room.ceilingProductId, g.ceilingArea);
    add(room.trimProductId, g.trimArea);

    if (room.scope.primer === "full") {
      primerArea += g.grossWallArea;
    } else if (room.scope.primer === "spot") {
      primerArea += g.grossWallArea * rates.spotPrimeFraction;
    }
  }

  for (const cs of customSurfaces) {
    add(cs.productId, cs.area);
    if (cs.includeInPrimer) primerArea += cs.area;
  }

  const primerProduct = priceBook.find((p) => p.use === "primer");
  if (primerProduct && primerArea > 0) {
    add(primerProduct.id, primerArea);
  }

  const requirements: ProductRequirement[] = [];
  for (const [productId, area] of areas) {
    const product = byId.get(productId);
    if (!product) continue;

    // A custom surface carries its own coat count; otherwise use the product's.
    const custom = customSurfaces.find((cs) => cs.productId === productId);
    const coats = custom ? custom.coats : coatsFor(product, rates);
    const coverage = coverageFor(product, rates);
    const rawGallons = (area * coats) / coverage;

    requirements.push({
      productId,
      coatedArea: area,
      coats,
      coverage,
      rawGallons,
      gallons: Math.ceil(rawGallons),
    });
  }

  return {
    requirements,
    totalGallons: requirements.reduce((sum, r) => sum + r.gallons, 0),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/__tests__/materials.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/materials.ts src/engine/__tests__/materials.test.ts
git commit -m "feat: add materials allocation and gallon calculation"
```

---

### Task 6: Pricing, warnings, orchestrator, and the golden tests

This is the gate. G1 and G2 from spec §12 live here.

**Files:**

- Create: `src/engine/pricing.ts`, `src/engine/warnings.ts`, `src/engine/estimate.ts`
- Test: `src/engine/__tests__/golden.test.ts`

**Interfaces:**

- Consumes: everything from Tasks 3–5
- Produces:
  - `computePricing(materials: MaterialsResult, priceBook: PaintProduct[], laborCost: number): PricingResult`
  - `collectWarnings(project: Project, geometry: RoomGeometry[]): Warning[]`
  - `computeEstimate(project: Project): Estimate`

- [ ] **Step 1: Write the failing golden tests**

Create `src/engine/__tests__/golden.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeEstimate } from "../estimate";
import { goldenJob, GOLDEN_EXPECTED } from "../__fixtures__/goldenJob";

const estimate = computeEstimate(goldenJob);

describe("G1 — labor is exact and derived. This gates all releases.", () => {
  it("39.9145 hours worked", () => {
    expect(estimate.labor.hoursWorked).toBeCloseTo(39.9145, 4);
  });
  it("42 billed room hours", () => {
    expect(estimate.labor.billedRoomHours).toBe(42);
  });
  it("5 days, 5 travel hours", () => {
    expect(estimate.labor.days).toBe(5);
    expect(estimate.labor.travelHours).toBe(5);
  });
  it("47 total billed hours", () => {
    expect(estimate.labor.totalBilledHours).toBe(47);
  });
  it("$3,525.00 labor", () => {
    expect(estimate.pricing.laborCost).toBeCloseTo(3525.0, 2);
  });
});

describe("G2 — calculated gallons match his D column", () => {
  const gallons = (id: string) =>
    estimate.materials.requirements.find((r) => r.productId === id)!.gallons;

  it("primer 5, walls 4, trim 1, ceilings 3", () => {
    expect(gallons("K380")).toBe(GOLDEN_EXPECTED.gallons.K380);
    expect(gallons("549")).toBe(GOLDEN_EXPECTED.gallons["549"]);
    expect(gallons("550")).toBe(GOLDEN_EXPECTED.gallons["550"]);
    expect(gallons("K508")).toBe(GOLDEN_EXPECTED.gallons.K508);
  });

  it("Aura 2 — the one deliberate divergence, his sheet ROUNDDOWNs to 1", () => {
    expect(gallons("K532")).toBe(2);
    expect(gallons("K532")).not.toBe(GOLDEN_EXPECTED.sheetGallonsForAura);
  });
});

describe("pricing", () => {
  it("prices every line per gallon, never by pack size", () => {
    const primer = estimate.pricing.materialLines.find(
      (l) => l.productId === "K380",
    )!;
    expect(primer.unitPrice).toBe(42);
    expect(primer.lineCost).toBeCloseTo(5 * 42, 2);
  });

  it("reports both his cost and list cost", () => {
    const walls = estimate.pricing.materialLines.find(
      (l) => l.productId === "549",
    )!;
    expect(walls.lineCost).toBeCloseTo(4 * 71.25, 2);
    expect(walls.listLineCost).toBeCloseTo(4 * 94.99, 2);
  });

  it("total is labor plus calculated materials", () => {
    expect(estimate.pricing.total).toBeCloseTo(
      estimate.pricing.laborCost + estimate.pricing.materialCost,
      2,
    );
  });
});

describe("warnings", () => {
  it("flags a room with no dimensions rather than silently summing it", () => {
    const withBlank = {
      ...goldenJob,
      rooms: [
        ...goldenJob.rooms,
        { ...goldenJob.rooms[1]!, id: "blank", name: "salon", walls: [0, 0] },
      ],
    };
    const warnings = computeEstimate(withBlank).warnings;
    expect(warnings.some((w) => w.code === "EMPTY_ROOM")).toBe(true);
  });

  it("errors when openings exceed their wall area", () => {
    const overfilled = {
      ...goldenJob,
      rooms: [
        {
          ...goldenJob.rooms[1]!,
          id: "tiny",
          walls: [2, 2],
          ceilingHeight: 8,
          scope: {
            walls: true,
            ceiling: true,
            trim: true,
            primer: "full" as const,
          },
          openings: [
            {
              id: "o1",
              kind: "window" as const,
              quantity: 20,
              width: 4,
              height: 3,
              paintSlab: false,
              casedSides: 1,
            },
          ],
        },
      ],
    };
    const warnings = computeEstimate(overfilled).warnings;
    expect(
      warnings.some(
        (w) => w.code === "OPENINGS_EXCEED_WALL" && w.level === "error",
      ),
    ).toBe(true);
  });

  it("is silent on the clean golden job", () => {
    expect(estimate.warnings.filter((w) => w.level === "error")).toHaveLength(
      0,
    );
  });
});

describe("G3 — $995.22 is an input, never an output", () => {
  it("derives materials from calculated gallons: $932.72", () => {
    // 5 primer @42 + 4 walls @71.25 + 1 trim @80.74 + 2 Aura @84.74
    // + 3 ceiling @62.50 = 932.72
    expect(estimate.pricing.materialCost).toBeCloseTo(932.72, 2);
  });

  it("does not reproduce his $995.22, which came from 12 PURCHASED gallons", () => {
    expect(estimate.pricing.materialCost).not.toBeCloseTo(
      GOLDEN_EXPECTED.materialCostFromActuals,
      2,
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/golden.test.ts`
Expected: FAIL — cannot resolve `../estimate`.

- [ ] **Step 3: Implement pricing**

Create `src/engine/pricing.ts`:

```ts
import type {
  MaterialLine,
  MaterialsResult,
  PaintProduct,
  PricingResult,
} from "./types";

export function computePricing(
  materials: MaterialsResult,
  priceBook: PaintProduct[],
  laborCost: number,
): PricingResult {
  const byId = new Map(priceBook.map((p) => [p.id, p]));

  const materialLines: MaterialLine[] = materials.requirements.flatMap((r) => {
    const product = byId.get(r.productId);
    if (!product) return [];
    // Prices are per gallon. packSizeGal never enters this calculation.
    return [
      {
        productId: r.productId,
        name: product.name,
        gallons: r.gallons,
        unitPrice: product.actualPrice,
        lineCost: r.gallons * product.actualPrice,
        listUnitPrice: product.listPrice,
        listLineCost: r.gallons * product.listPrice,
      },
    ];
  });

  const materialCost = materialLines.reduce((sum, l) => sum + l.lineCost, 0);
  const materialCostAtList = materialLines.reduce(
    (sum, l) => sum + l.listLineCost,
    0,
  );

  return {
    materialLines,
    materialCost,
    materialCostAtList,
    laborCost,
    total: laborCost + materialCost,
  };
}
```

- [ ] **Step 4: Implement warnings**

Create `src/engine/warnings.ts`:

```ts
import type { Project, RoomGeometry, Warning } from "./types";

const STALE_DAYS = 182;

export function collectWarnings(
  project: Project,
  geometry: RoomGeometry[],
): Warning[] {
  const warnings: Warning[] = [];
  const geoById = new Map(geometry.map((g) => [g.roomId, g]));

  for (const room of project.rooms) {
    const hasDimensions =
      room.walls.length > 0 && room.walls.every((w) => w > 0);
    if (!hasDimensions) {
      warnings.push({
        level: "warning",
        code: "EMPTY_ROOM",
        roomId: room.id,
        message: `"${room.name}" has no dimensions and contributes nothing to the estimate.`,
      });
      continue;
    }

    const g = geoById.get(room.id);
    if (g && room.scope.walls && g.openingArea >= g.grossWallArea) {
      warnings.push({
        level: "error",
        code: "OPENINGS_EXCEED_WALL",
        roomId: room.id,
        message: `"${room.name}": doors and windows total ${g.openingArea.toFixed(1)} sq ft, which meets or exceeds its ${g.grossWallArea.toFixed(1)} sq ft of wall.`,
      });
    }
  }

  const now = Date.parse("2026-08-16T00:00:00Z");
  for (const product of project.priceBook) {
    const updated = Date.parse(product.priceUpdatedAt);
    if (Number.isNaN(updated)) continue;
    const days = (now - updated) / 86_400_000;
    if (days > STALE_DAYS) {
      warnings.push({
        level: "info",
        code: "STALE_PRICE",
        message: `${product.name} price last updated ${Math.round(days)} days ago.`,
      });
    }
  }

  return warnings;
}
```

Note: `now` is pinned rather than `Date.now()` so the suite is deterministic. Task 11 replaces this with an injected clock when Settings needs live staleness.

- [ ] **Step 5: Implement the orchestrator**

Create `src/engine/estimate.ts`:

```ts
import { computeGeometry } from "./geometry";
import { computeLabor } from "./labor";
import { computeMaterials } from "./materials";
import { computePricing } from "./pricing";
import { collectWarnings } from "./warnings";
import type { Estimate, Project } from "./types";

export function computeEstimate(project: Project): Estimate {
  const { rooms, customSurfaces, rateProfile, priceBook } = project;

  const geometry = computeGeometry(rooms, rateProfile);
  const labor = computeLabor(geometry, customSurfaces, rateProfile);
  const materials = computeMaterials(
    rooms,
    geometry,
    customSurfaces,
    rateProfile,
    priceBook,
  );
  const pricing = computePricing(materials, priceBook, labor.laborCost);
  const warnings = collectWarnings(project, geometry);

  return { geometry, labor, materials, pricing, warnings };
}
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, all files including purity, geometry, labor, materials, golden.

- [ ] **Step 7: Commit**

```bash
git add src/engine/pricing.ts src/engine/warnings.ts src/engine/estimate.ts src/engine/__tests__/golden.test.ts
git commit -m "feat: add pricing, warnings, orchestrator, and golden tests"
```

---

### Task 7: Calibration

**Files:**

- Create: `src/engine/calibration.ts`
- Test: `src/engine/__tests__/calibration.test.ts`

**Interfaces:**

- Consumes: `Project`, `Estimate`, `JobActuals`
- Produces:
  - `CoverageDrift`, `CalibrationReport` types added to `src/engine/types.ts`
  - `computeCalibration(project: Project, estimate: Estimate): CalibrationReport | null`

**Rule from spec §10:** real coverage is **coated area ÷ gallons purchased**, per product. Primer is reported separately and never blended into the finish-coat figure.

- [ ] **Step 1: Add the types**

Append to `src/engine/types.ts`:

```ts
export interface CoverageDrift {
  productId: string;
  name: string;
  isPrimer: boolean;
  assumedCoverage: number;
  realCoverage: number;
  estimatedGallons: number;
  actualGallons: number;
  deltaPct: number; // positive = bought more than estimated
}

export interface CalibrationReport {
  coverage: CoverageDrift[];
  finishGallonsEstimated: number;
  finishGallonsActual: number;
  finishShortfallPct: number;
  finishRealCoverage: number;
  productionRateAssumed: number; // min/sq ft
  productionRateActual: number | null;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/engine/__tests__/calibration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeEstimate } from "../estimate";
import { computeCalibration } from "../calibration";
import { goldenJob } from "../__fixtures__/goldenJob";

const estimate = computeEstimate(goldenJob);
const report = computeCalibration(goldenJob, estimate)!;

describe("computeCalibration — golden job", () => {
  it("returns null when there are no actuals", () => {
    const { actuals, ...withoutActuals } = goldenJob;
    expect(
      computeCalibration(withoutActuals as typeof goldenJob, estimate),
    ).toBeNull();
  });

  it("derives ~410 sq ft/gal real finish coverage, not the sheet's 388", () => {
    expect(report.finishRealCoverage).toBeGreaterThan(405);
    expect(report.finishRealCoverage).toBeLessThan(415);
  });

  it("excludes primer from the finish coverage figure", () => {
    const primer = report.coverage.find((c) => c.productId === "K380")!;
    expect(primer.isPrimer).toBe(true);
    expect(report.finishGallonsActual).toBe(11); // 4 + 1 + 2 + 4, no primer
  });

  it("reports primer as accurate — 5 estimated, 5 purchased", () => {
    const primer = report.coverage.find((c) => c.productId === "K380")!;
    expect(primer.estimatedGallons).toBe(5);
    expect(primer.actualGallons).toBe(5);
    expect(primer.deltaPct).toBeCloseTo(0, 4);
  });

  it("flags the ceiling shortfall: 3 estimated, 4 purchased", () => {
    const ceiling = report.coverage.find((c) => c.productId === "K508")!;
    expect(ceiling.estimatedGallons).toBe(3);
    expect(ceiling.actualGallons).toBe(4);
    expect(ceiling.deltaPct).toBeCloseTo(33.33, 1);
  });

  it("computes real coverage per product from coated area", () => {
    const ceiling = report.coverage.find((c) => c.productId === "K508")!;
    // 823.36 × 2 coats / 4 gal
    expect(ceiling.realCoverage).toBeCloseTo(411.68, 1);
    expect(ceiling.assumedCoverage).toBe(550);
  });

  it("back-solves the actual production rate from hours worked", () => {
    // Identical to assumed here, since actuals record exactly the estimate's hours.
    expect(report.productionRateActual).toBeCloseTo(0.75, 3);
    expect(report.productionRateAssumed).toBe(0.75);
  });

  it("reports the finish shortfall as a positive percentage", () => {
    expect(report.finishGallonsEstimated).toBe(10); // 4 + 1 + 2 + 3
    expect(report.finishShortfallPct).toBeCloseTo(10, 1);
  });
});
```

Note on the last test: the engine estimates Aura at 2 (his sheet said 1), so the engine's own finish estimate is 10 gallons against 11 purchased — a 10% shortfall, not the 22% his sheet had. That improvement is the point, and the test records it.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/calibration.test.ts`
Expected: FAIL — cannot resolve `../calibration`.

- [ ] **Step 4: Implement calibration**

Create `src/engine/calibration.ts`:

```ts
import type {
  CalibrationReport,
  CoverageDrift,
  Estimate,
  Project,
} from "./types";

export function computeCalibration(
  project: Project,
  estimate: Estimate,
): CalibrationReport | null {
  const actuals = project.actuals;
  if (!actuals) return null;

  const byId = new Map(project.priceBook.map((p) => [p.id, p]));

  const coverage: CoverageDrift[] = estimate.materials.requirements.map((r) => {
    const product = byId.get(r.productId);
    const actualGallons = actuals.gallonsPurchased[r.productId] ?? 0;
    const coatedArea = r.coatedArea * r.coats;

    return {
      productId: r.productId,
      name: product?.name ?? r.productId,
      isPrimer: product?.use === "primer",
      assumedCoverage: r.coverage,
      realCoverage: actualGallons > 0 ? coatedArea / actualGallons : 0,
      estimatedGallons: r.gallons,
      actualGallons,
      deltaPct:
        r.gallons > 0 ? ((actualGallons - r.gallons) / r.gallons) * 100 : 0,
    };
  });

  // Primer is never blended into the finish figure — averaging them is exactly
  // what let one error hide another in the source spreadsheet.
  const finish = coverage.filter((c) => !c.isPrimer);
  const finishGallonsEstimated = finish.reduce(
    (sum, c) => sum + c.estimatedGallons,
    0,
  );
  const finishGallonsActual = finish.reduce(
    (sum, c) => sum + c.actualGallons,
    0,
  );

  const finishCoatedArea = estimate.materials.requirements
    .filter(
      (r) => !byId.get(r.productId) || byId.get(r.productId)!.use !== "primer",
    )
    .reduce((sum, r) => sum + r.coatedArea * r.coats, 0);

  const paintedArea = estimate.geometry.reduce(
    (sum, g) => sum + g.netWallArea + g.ceilingArea + g.trimArea,
    0,
  );

  return {
    coverage,
    finishGallonsEstimated,
    finishGallonsActual,
    finishShortfallPct:
      finishGallonsEstimated > 0
        ? ((finishGallonsActual - finishGallonsEstimated) /
            finishGallonsEstimated) *
          100
        : 0,
    finishRealCoverage:
      finishGallonsActual > 0 ? finishCoatedArea / finishGallonsActual : 0,
    productionRateAssumed: project.rateProfile.wallRate,
    productionRateActual:
      paintedArea > 0 ? (actuals.hoursWorked * 60) / paintedArea : null,
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/engine/__tests__/calibration.test.ts`
Expected: PASS.

If `finishRealCoverage` lands outside 405–415, do not adjust the test bounds. Check that custom-surface areas are included in `finishCoatedArea` and that primer is excluded.

- [ ] **Step 6: Commit**

```bash
git add src/engine/calibration.ts src/engine/types.ts src/engine/__tests__/calibration.test.ts
git commit -m "feat: add calibration with primer separated from finish coverage"
```

---

### Task 8: Defaults and persistence

**Files:**

- Create: `src/data/defaults.ts`, `src/data/storage.ts`
- Test: `src/data/__tests__/storage.test.ts`

**Interfaces:**

- Consumes: `Project`, `RateProfile`, `PaintProduct`
- Produces:
  - `DEFAULT_RATE_PROFILE: RateProfile`
  - `DEFAULT_PRICE_BOOK: PaintProduct[]`
  - `newProject(name: string, id: string): Project`
  - `saveProject(p: Project): void`, `loadProject(id: string): Project | null`, `listProjects(): {id: string, name: string}[]`, `deleteProject(id: string): void`
  - `saveRateProfile(r: RateProfile): void`, `loadRateProfile(): RateProfile`
  - `savePriceBook(b: PaintProduct[]): void`, `loadPriceBook(): PaintProduct[]`
  - `exportProject(p: Project): string`, `importProject(json: string): Project`

- [ ] **Step 1: Write defaults**

Create `src/data/defaults.ts`. These are his real numbers from spec §4.1 and §4.4:

```ts
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
```

- [ ] **Step 2: Write the failing storage tests**

Create `src/data/__tests__/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  saveProject,
  loadProject,
  listProjects,
  deleteProject,
  saveRateProfile,
  loadRateProfile,
  exportProject,
  importProject,
} from "../storage";
import { newProject, DEFAULT_RATE_PROFILE } from "../defaults";

beforeEach(() => localStorage.clear());

describe("project persistence", () => {
  it("round-trips a project", () => {
    const p = newProject("Smith house", "p1");
    saveProject(p);
    expect(loadProject("p1")).toEqual(p);
  });

  it("returns null for an unknown id", () => {
    expect(loadProject("nope")).toBeNull();
  });

  it("lists saved projects", () => {
    saveProject(newProject("A", "p1"));
    saveProject(newProject("B", "p2"));
    expect(listProjects()).toEqual([
      { id: "p1", name: "A" },
      { id: "p2", name: "B" },
    ]);
  });

  it("deletes a project and drops it from the index", () => {
    saveProject(newProject("A", "p1"));
    deleteProject("p1");
    expect(loadProject("p1")).toBeNull();
    expect(listProjects()).toEqual([]);
  });
});

describe("rate profile persistence", () => {
  it("falls back to defaults when nothing is stored", () => {
    expect(loadRateProfile()).toEqual(DEFAULT_RATE_PROFILE);
  });

  it("round-trips an edited profile", () => {
    saveRateProfile({ ...DEFAULT_RATE_PROFILE, laborRate: 85 });
    expect(loadRateProfile().laborRate).toBe(85);
  });

  it("falls back to defaults when stored JSON is corrupt", () => {
    localStorage.setItem("paint-estimator:rates", "{not json");
    expect(loadRateProfile()).toEqual(DEFAULT_RATE_PROFILE);
  });
});

describe("export and import", () => {
  it("round-trips through JSON", () => {
    const p = newProject("Smith house", "p1");
    expect(importProject(exportProject(p))).toEqual(p);
  });

  it("throws a clear error on malformed input", () => {
    expect(() => importProject("{not json")).toThrow(/not a valid/i);
  });

  it("throws when required fields are missing", () => {
    expect(() => importProject('{"id":"x"}')).toThrow(/not a valid/i);
  });
});
```

- [ ] **Step 3: Configure the DOM test environment**

Storage tests need `localStorage`. Install and configure jsdom:

```bash
npm install -D jsdom
```

Replace `vite.config.ts` entirely. **The import must come from `vitest/config`, not
`vite`** — `defineConfig` from `vite` has no `test` property and will fail to typecheck:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run src/data/__tests__/storage.test.ts`
Expected: FAIL — cannot resolve `../storage`.

- [ ] **Step 5: Implement storage**

Create `src/data/storage.ts`:

```ts
import type { PaintProduct, Project, RateProfile } from "../engine/types";
import { DEFAULT_PRICE_BOOK, DEFAULT_RATE_PROFILE } from "./defaults";

const PROJECT_PREFIX = "paint-estimator:project:";
const INDEX_KEY = "paint-estimator:index";
const RATES_KEY = "paint-estimator:rates";
const BOOK_KEY = "paint-estimator:pricebook";

type IndexEntry = { id: string; name: string };

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function listProjects(): IndexEntry[] {
  return readJson<IndexEntry[]>(INDEX_KEY, []);
}

export function saveProject(project: Project): void {
  localStorage.setItem(PROJECT_PREFIX + project.id, JSON.stringify(project));
  const index = listProjects().filter((e) => e.id !== project.id);
  index.push({ id: project.id, name: project.name });
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function loadProject(id: string): Project | null {
  const raw = localStorage.getItem(PROJECT_PREFIX + id);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

export function deleteProject(id: string): void {
  localStorage.removeItem(PROJECT_PREFIX + id);
  localStorage.setItem(
    INDEX_KEY,
    JSON.stringify(listProjects().filter((e) => e.id !== id)),
  );
}

export function saveRateProfile(rates: RateProfile): void {
  localStorage.setItem(RATES_KEY, JSON.stringify(rates));
}

export function loadRateProfile(): RateProfile {
  return readJson<RateProfile>(RATES_KEY, DEFAULT_RATE_PROFILE);
}

export function savePriceBook(book: PaintProduct[]): void {
  localStorage.setItem(BOOK_KEY, JSON.stringify(book));
}

export function loadPriceBook(): PaintProduct[] {
  return readJson<PaintProduct[]>(BOOK_KEY, DEFAULT_PRICE_BOOK);
}

export function exportProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function importProject(json: string): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That file is not a valid estimate.");
  }
  const p = parsed as Partial<Project>;
  if (
    typeof p?.id !== "string" ||
    typeof p?.name !== "string" ||
    !Array.isArray(p?.rooms) ||
    !p?.rateProfile ||
    !Array.isArray(p?.priceBook)
  ) {
    throw new Error("That file is not a valid estimate.");
  }
  return {
    ...(p as Project),
    customSurfaces: p.customSurfaces ?? [],
  };
}
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS. Confirm the engine purity test still passes — `src/data/` may use `localStorage`, `src/engine/` may not.

- [ ] **Step 7: Commit**

```bash
git add src/data vite.config.ts package.json package-lock.json
git commit -m "feat: add his seeded defaults and localStorage persistence"
```

---

### Task 9: Takeoff screen

**Files:**

- Create: `src/ui/TakeoffScreen.tsx`, `src/ui/RoomRow.tsx`, `src/ui/OpeningsEditor.tsx`, `src/ui/format.ts`
- Modify: `src/ui/App.tsx`
- Test: `src/ui/__tests__/TakeoffScreen.test.tsx`

**Interfaces:**

- Consumes: `computeEstimate`, `newProject`, `saveProject`, `loadProject`
- Produces: `<TakeoffScreen project={p} onChange={(p: Project) => void} />`, and `formatMoney(n: number): string`, `formatHours(n: number): string` from `format.ts`

- [ ] **Step 1: Install testing libraries**

```bash
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Create `src/setupTests.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

In `vite.config.ts`, extend the `test` block created in Task 8:

```ts
test: {
  environment: "jsdom",
  setupFiles: ["./src/setupTests.ts"],
},
```

- [ ] **Step 2: Write the failing tests**

Create `src/ui/__tests__/TakeoffScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TakeoffScreen } from "../TakeoffScreen";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";

describe("TakeoffScreen", () => {
  it("renders one row per room", () => {
    render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByDisplayValue("Salle de bains")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Kitchen/dining/kitchen"),
    ).toBeInTheDocument();
  });

  it("shows live totals for the golden job", () => {
    render(<TakeoffScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByTestId("total-hours")).toHaveTextContent("39.9");
    expect(screen.getByTestId("total-billed")).toHaveTextContent("47");
    expect(screen.getByTestId("total-price")).toHaveTextContent("4,5");
  });

  it("adds a room", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add room/i }));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0]![0].rooms).toHaveLength(
      goldenJob.rooms.length + 1,
    );
  });

  it("removes a room", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);
    await userEvent.click(
      screen.getAllByRole("button", { name: /remove room/i })[0]!,
    );
    expect(onChange.mock.calls[0]![0].rooms).toHaveLength(
      goldenJob.rooms.length - 1,
    );
  });

  it("edits a wall dimension and reports it upward", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);
    const input = screen.getAllByLabelText(/wall 1/i)[0]!;
    await userEvent.clear(input);
    await userEvent.type(input, "20");
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)![0];
    expect(last.rooms[0].walls[0]).toBe(20);
  });

  it("surfaces engine warnings", () => {
    const withBlank = {
      ...goldenJob,
      rooms: [
        ...goldenJob.rooms,
        { ...goldenJob.rooms[1]!, id: "blank", name: "salon", walls: [0, 0] },
      ],
    };
    render(<TakeoffScreen project={withBlank} onChange={() => {}} />);
    expect(screen.getByText(/no dimensions/i)).toBeInTheDocument();
  });

  it("adds a door to a room and deducts its area", async () => {
    const onChange = vi.fn();
    render(<TakeoffScreen project={goldenJob} onChange={onChange} />);
    await userEvent.click(
      screen.getAllByRole("button", { name: /add door/i })[0]!,
    );
    const updated = onChange.mock.calls.at(-1)![0];
    expect(updated.rooms[0].openings).toHaveLength(1);
    expect(updated.rooms[0].openings[0].kind).toBe("door");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/ui/__tests__/TakeoffScreen.test.tsx`
Expected: FAIL — cannot resolve `../TakeoffScreen`.

- [ ] **Step 4: Write the formatters**

Create `src/ui/format.ts`:

```ts
export const formatMoney = (n: number): string =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  });

export const formatHours = (n: number): string => n.toFixed(1);

export const formatArea = (n: number): string =>
  `${n.toLocaleString("en-CA", { maximumFractionDigits: 1 })} sq ft`;
```

- [ ] **Step 5: Write the openings editor**

Create `src/ui/OpeningsEditor.tsx`:

```tsx
import type { Opening, OpeningKind } from "../engine/types";

const DEFAULTS: Record<OpeningKind, { width: number; height: number }> = {
  door: { width: 3, height: 7 },
  window: { width: 4, height: 3 },
  passage: { width: 5, height: 7 },
};

export function newOpening(kind: OpeningKind, id: string): Opening {
  return {
    id,
    kind,
    quantity: 1,
    ...DEFAULTS[kind],
    paintSlab: kind === "door",
    casedSides: 2,
  };
}

interface Props {
  openings: Opening[];
  onChange: (openings: Opening[]) => void;
}

export function OpeningsEditor({ openings, onChange }: Props) {
  const update = (id: string, patch: Partial<Opening>) =>
    onChange(openings.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const add = (kind: OpeningKind) =>
    onChange([
      ...openings,
      newOpening(kind, `${kind}-${Date.now()}-${openings.length}`),
    ]);

  return (
    <div className="openings">
      <div className="openings-actions">
        <button type="button" onClick={() => add("door")}>
          Add door
        </button>
        <button type="button" onClick={() => add("window")}>
          Add window
        </button>
      </div>

      {openings.map((o) => (
        <div key={o.id} className="opening-row">
          <span>{o.kind}</span>
          <label>
            Qty
            <input
              type="number"
              min={0}
              value={o.quantity}
              onChange={(e) =>
                update(o.id, { quantity: Number(e.target.value) })
              }
            />
          </label>
          <label>
            W
            <input
              type="number"
              step="0.1"
              value={o.width}
              onChange={(e) => update(o.id, { width: Number(e.target.value) })}
            />
          </label>
          <label>
            H
            <input
              type="number"
              step="0.1"
              value={o.height}
              onChange={(e) => update(o.id, { height: Number(e.target.value) })}
            />
          </label>
          <label>
            Cased sides
            <select
              value={o.casedSides}
              onChange={(e) =>
                update(o.id, {
                  casedSides: Number(e.target.value) as 0 | 1 | 2,
                })
              }
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
          <button
            type="button"
            aria-label={`remove ${o.kind}`}
            onClick={() => onChange(openings.filter((x) => x.id !== o.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Write the room row**

Create `src/ui/RoomRow.tsx`:

```tsx
import type { Room, RoomGeometry } from "../engine/types";
import { OpeningsEditor } from "./OpeningsEditor";
import { formatArea } from "./format";

interface Props {
  room: Room;
  geometry?: RoomGeometry;
  onChange: (room: Room) => void;
  onRemove: () => void;
}

export function RoomRow({ room, geometry, onChange, onRemove }: Props) {
  const setWall = (index: number, value: number) => {
    const walls = [...room.walls];
    walls[index] = value;
    onChange({ ...room, walls });
  };

  return (
    <div className="room-row">
      <input
        aria-label="room name"
        value={room.name}
        onChange={(e) => onChange({ ...room, name: e.target.value })}
      />
      <label>
        Wall 1
        <input
          type="number"
          step="0.1"
          value={room.walls[0] ?? 0}
          onChange={(e) => setWall(0, Number(e.target.value))}
        />
      </label>
      <label>
        Wall 2
        <input
          type="number"
          step="0.1"
          value={room.walls[1] ?? 0}
          onChange={(e) => setWall(1, Number(e.target.value))}
        />
      </label>
      <label>
        Height
        <input
          type="number"
          step="0.1"
          value={room.ceilingHeight}
          onChange={(e) =>
            onChange({ ...room, ceilingHeight: Number(e.target.value) })
          }
        />
      </label>

      <fieldset className="scope">
        <legend>Paint</legend>
        {(["walls", "ceiling", "trim"] as const).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={room.scope[key]}
              onChange={(e) =>
                onChange({
                  ...room,
                  scope: { ...room.scope, [key]: e.target.checked },
                })
              }
            />
            {key}
          </label>
        ))}
      </fieldset>

      {geometry && (
        <div className="room-geometry">
          <span>Net wall {formatArea(geometry.netWallArea)}</span>
          {geometry.openingArea > 0 && (
            <span> (−{formatArea(geometry.openingArea)} openings)</span>
          )}
          <span> · Ceiling {formatArea(geometry.ceilingArea)}</span>
        </div>
      )}

      <OpeningsEditor
        openings={room.openings}
        onChange={(openings) => onChange({ ...room, openings })}
      />

      <button type="button" aria-label="remove room" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Write the takeoff screen**

Create `src/ui/TakeoffScreen.tsx`:

```tsx
import { useMemo } from "react";
import type { Project, Room } from "../engine/types";
import { computeEstimate } from "../engine/estimate";
import { DEFAULT_RATE_PROFILE } from "../data/defaults";
import { RoomRow } from "./RoomRow";
import { formatHours, formatMoney } from "./format";

interface Props {
  project: Project;
  onChange: (project: Project) => void;
}

function blankRoom(id: string): Room {
  return {
    id,
    name: "New room",
    floor: 1,
    quantity: 1,
    walls: [0, 0],
    ceilingHeight: 8,
    scope: { walls: true, ceiling: true, trim: true, primer: "full" },
    wallProductId: "549",
    ceilingProductId: "K508",
    trimProductId: "550",
    openings: [],
  };
}

export function TakeoffScreen({ project, onChange }: Props) {
  const estimate = useMemo(() => computeEstimate(project), [project]);
  const geoById = new Map(estimate.geometry.map((g) => [g.roomId, g]));

  const updateRoom = (room: Room) =>
    onChange({
      ...project,
      rooms: project.rooms.map((r) => (r.id === room.id ? room : r)),
    });

  return (
    <div className="takeoff">
      <h2>{project.name}</h2>

      {estimate.warnings.length > 0 && (
        <ul className="warnings">
          {estimate.warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className={`warning-${w.level}`}>
              {w.message}
            </li>
          ))}
        </ul>
      )}

      {project.rooms.map((room) => (
        <RoomRow
          key={room.id}
          room={room}
          geometry={geoById.get(room.id)}
          onChange={updateRoom}
          onRemove={() =>
            onChange({
              ...project,
              rooms: project.rooms.filter((r) => r.id !== room.id),
            })
          }
        />
      ))}

      <button
        type="button"
        onClick={() =>
          onChange({
            ...project,
            rooms: [
              ...project.rooms,
              blankRoom(`room-${project.rooms.length + 1}-${Date.now()}`),
            ],
            rateProfile: project.rateProfile ?? DEFAULT_RATE_PROFILE,
          })
        }
      >
        Add room
      </button>

      <footer className="totals">
        <span data-testid="total-hours">
          {formatHours(estimate.labor.hoursWorked)} hrs worked
        </span>
        <span data-testid="total-billed">
          {estimate.labor.totalBilledHours} billed
        </span>
        <span data-testid="total-price">
          {formatMoney(estimate.pricing.total)}
        </span>
      </footer>
    </div>
  );
}
```

- [ ] **Step 8: Wire it into App**

Replace `src/ui/App.tsx` entirely:

```tsx
import { useState } from "react";
import type { Project } from "../engine/types";
import { newProject } from "../data/defaults";
import { TakeoffScreen } from "./TakeoffScreen";

export default function App() {
  const [project, setProject] = useState<Project>(() =>
    newProject("New estimate", "p1"),
  );

  return (
    <main>
      <h1>Paint Estimator</h1>
      <TakeoffScreen project={project} onChange={setProject} />
    </main>
  );
}
```

If Vite's scaffold put `App.tsx` at `src/App.tsx`, delete that file and update `src/main.tsx` to import from `./ui/App`.

- [ ] **Step 9: Run the tests**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 10: Verify it runs**

Run: `npm run dev`
Open the URL, confirm the page renders and adding a room works. Stop the server.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add takeoff screen with room rows and openings editor"
```

---

### Task 10: Results screen

**Files:**

- Create: `src/ui/ResultsScreen.tsx`
- Modify: `src/ui/App.tsx`
- Test: `src/ui/__tests__/ResultsScreen.test.tsx`

**Interfaces:**

- Consumes: `computeEstimate`, `formatMoney`, `formatHours`
- Produces: `<ResultsScreen project={p} />`

The margin-lever display is the point of this screen (spec §9).

- [ ] **Step 1: Write the failing tests**

Create `src/ui/__tests__/ResultsScreen.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultsScreen } from "../ResultsScreen";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";

describe("ResultsScreen", () => {
  it("shows hours worked, billed, and travel separately", () => {
    render(<ResultsScreen project={goldenJob} />);
    expect(screen.getByTestId("hours-worked")).toHaveTextContent("39.9");
    expect(screen.getByTestId("hours-billed-rooms")).toHaveTextContent("42");
    expect(screen.getByTestId("hours-travel")).toHaveTextContent("5");
    expect(screen.getByTestId("hours-total")).toHaveTextContent("47");
  });

  it("shows what the roundup and travel are worth in dollars", () => {
    render(<ResultsScreen project={goldenJob} />);
    // (42 − 39.9145) × 75 = $156.41
    expect(screen.getByTestId("roundup-value")).toHaveTextContent("156");
    // 5 × 75 = $375.00
    expect(screen.getByTestId("travel-value")).toHaveTextContent("375");
  });

  it("shows 5 crew-days", () => {
    render(<ResultsScreen project={goldenJob} />);
    expect(screen.getByTestId("crew-days")).toHaveTextContent("5");
  });

  it("lists every product with its gallons", () => {
    render(<ResultsScreen project={goldenJob} />);
    expect(screen.getByText(/Regal Select/)).toBeInTheDocument();
    expect(screen.getByText(/Aura Bath & Spa/)).toBeInTheDocument();
    expect(screen.getByText(/Waterborne Ceiling/)).toBeInTheDocument();
  });

  it("shows labor $3,525.00", () => {
    render(<ResultsScreen project={goldenJob} />);
    expect(screen.getByTestId("labor-cost")).toHaveTextContent("3,525");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/__tests__/ResultsScreen.test.tsx`
Expected: FAIL — cannot resolve `../ResultsScreen`.

- [ ] **Step 3: Implement the screen**

Create `src/ui/ResultsScreen.tsx`:

```tsx
import { useMemo } from "react";
import type { Project } from "../engine/types";
import { computeEstimate } from "../engine/estimate";
import { formatArea, formatHours, formatMoney } from "./format";

export function ResultsScreen({ project }: { project: Project }) {
  const estimate = useMemo(() => computeEstimate(project), [project]);
  const { labor, pricing, materials } = estimate;
  const rate = project.rateProfile.laborRate;

  const roundupValue = (labor.billedRoomHours - labor.hoursWorked) * rate;
  const travelValue = labor.travelHours * rate;

  return (
    <div className="results">
      <h2>Estimate</h2>

      <section className="labor">
        <h3>Labor</h3>
        <p>
          <span data-testid="hours-worked">
            {formatHours(labor.hoursWorked)} hrs worked
          </span>
          {" · "}
          <span data-testid="hours-billed-rooms">
            {labor.billedRoomHours} billed
          </span>
          {" (rounding "}
          <span data-testid="roundup-value">{formatMoney(roundupValue)}</span>
          {") · "}
          <span data-testid="hours-travel">{labor.travelHours} travel</span>
          {" ("}
          <span data-testid="travel-value">{formatMoney(travelValue)}</span>
          {") · "}
          <strong data-testid="hours-total">
            {labor.totalBilledHours} total
          </strong>
        </p>
        <p>
          <span data-testid="crew-days">{labor.days}</span> crew-days at{" "}
          {project.rateProfile.hoursPerDay} hrs
        </p>
        <p data-testid="labor-cost">{formatMoney(pricing.laborCost)}</p>
      </section>

      <section className="materials">
        <h3>Materials</h3>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Area</th>
              <th>Coats</th>
              <th>Gallons</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {pricing.materialLines.map((line) => {
              const req = materials.requirements.find(
                (r) => r.productId === line.productId,
              );
              return (
                <tr key={line.productId}>
                  <td>{line.name}</td>
                  <td>{req ? formatArea(req.coatedArea) : "—"}</td>
                  <td>{req?.coats ?? "—"}</td>
                  <td>{line.gallons}</td>
                  <td>{formatMoney(line.lineCost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p data-testid="material-cost">{formatMoney(pricing.materialCost)}</p>
      </section>

      <section className="total">
        <h3>Total</h3>
        <p data-testid="grand-total">{formatMoney(pricing.total)}</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Add screen switching to App**

Replace `src/ui/App.tsx`:

```tsx
import { useState } from "react";
import type { Project } from "../engine/types";
import { newProject } from "../data/defaults";
import { TakeoffScreen } from "./TakeoffScreen";
import { ResultsScreen } from "./ResultsScreen";

type Screen = "takeoff" | "results";

export default function App() {
  const [project, setProject] = useState<Project>(() =>
    newProject("New estimate", "p1"),
  );
  const [screen, setScreen] = useState<Screen>("takeoff");

  return (
    <main>
      <h1>Paint Estimator</h1>
      <nav>
        <button type="button" onClick={() => setScreen("takeoff")}>
          Takeoff
        </button>
        <button type="button" onClick={() => setScreen("results")}>
          Results
        </button>
      </nav>
      {screen === "takeoff" ? (
        <TakeoffScreen project={project} onChange={setProject} />
      ) : (
        <ResultsScreen project={project} />
      )}
    </main>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add results screen exposing roundup and travel margin"
```

---

### Task 11: Settings screen

**Files:**

- Create: `src/ui/SettingsScreen.tsx`
- Modify: `src/ui/App.tsx`
- Test: `src/ui/__tests__/SettingsScreen.test.tsx`

**Interfaces:**

- Consumes: `RateProfile`, `PaintProduct`, `saveRateProfile`, `savePriceBook`
- Produces: `<SettingsScreen project={p} onChange={(p: Project) => void} />`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/__tests__/SettingsScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsScreen } from "../SettingsScreen";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";

describe("SettingsScreen", () => {
  it("shows his seeded rates", () => {
    render(<SettingsScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByLabelText(/labor rate/i)).toHaveValue(75);
    expect(screen.getByLabelText(/wall rate/i)).toHaveValue(0.75);
    expect(screen.getByLabelText(/wall coverage/i)).toHaveValue(500);
    expect(screen.getByLabelText(/ceiling coverage/i)).toHaveValue(550);
  });

  it("edits the labor rate", async () => {
    const onChange = vi.fn();
    render(<SettingsScreen project={goldenJob} onChange={onChange} />);
    const input = screen.getByLabelText(/labor rate/i);
    await userEvent.clear(input);
    await userEvent.type(input, "85");
    expect(onChange.mock.calls.at(-1)![0].rateProfile.laborRate).toBe(85);
  });

  it("lists every product with per-gallon prices", () => {
    render(<SettingsScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByDisplayValue("Regal Select")).toBeInTheDocument();
    expect(screen.getByDisplayValue("71.25")).toBeInTheDocument();
  });

  it("labels prices as per gallon so pack size is never confused for a unit", () => {
    render(<SettingsScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getAllByText(/per gallon/i).length).toBeGreaterThan(0);
  });

  it("warns that trim rate equals wall rate", () => {
    render(<SettingsScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByTestId("trim-rate-note")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/__tests__/SettingsScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the screen**

Create `src/ui/SettingsScreen.tsx`:

```tsx
import type { PaintProduct, Project, RateProfile } from "../engine/types";

interface Props {
  project: Project;
  onChange: (project: Project) => void;
}

const NUMERIC_FIELDS: Array<{
  key: keyof RateProfile;
  label: string;
  step: string;
}> = [
  { key: "laborRate", label: "Labor rate ($/hr)", step: "1" },
  { key: "wallRate", label: "Wall rate (min/sq ft)", step: "0.01" },
  { key: "ceilingRate", label: "Ceiling rate (min/sq ft)", step: "0.01" },
  { key: "trimRate", label: "Trim rate (min/sq ft)", step: "0.01" },
  { key: "hoursPerDay", label: "Hours per day", step: "0.5" },
  { key: "travelHoursPerDay", label: "Travel hours per day", step: "0.5" },
  { key: "wallCoverage", label: "Wall coverage (sq ft/gal)", step: "10" },
  { key: "ceilingCoverage", label: "Ceiling coverage (sq ft/gal)", step: "10" },
  { key: "trimGirthFt", label: "Trim girth (ft)", step: "0.05" },
  { key: "spotPrimeFraction", label: "Spot prime fraction", step: "0.05" },
];

export function SettingsScreen({ project, onChange }: Props) {
  const rates = project.rateProfile;

  // Accepts boolean too — roundRoomHoursUp is a checkbox, not a number.
  const setRate = (key: keyof RateProfile, value: number | boolean) =>
    onChange({ ...project, rateProfile: { ...rates, [key]: value } });

  const setProduct = (id: string, patch: Partial<PaintProduct>) =>
    onChange({
      ...project,
      priceBook: project.priceBook.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    });

  return (
    <div className="settings">
      <h2>Rates</h2>
      {NUMERIC_FIELDS.map(({ key, label, step }) => (
        <label key={key}>
          {label}
          <input
            type="number"
            step={step}
            value={rates[key] as number}
            onChange={(e) => setRate(key, Number(e.target.value))}
          />
        </label>
      ))}

      {rates.trimRate === rates.wallRate && (
        <p data-testid="trim-rate-note" className="note">
          Trim is set to the same rate as walls, matching your spreadsheet. Trim
          typically runs 2–3× slower per square foot — worth revisiting on a
          heavy-trim house.
        </p>
      )}

      <label>
        <input
          type="checkbox"
          checked={rates.roundRoomHoursUp}
          onChange={(e) => setRate("roundRoomHoursUp", e.target.checked)}
        />
        Round each room up to whole hours
      </label>

      <h2>Price book</h2>
      <p className="note">All prices are per gallon.</p>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>List (per gallon)</th>
            <th>Yours (per gallon)</th>
            <th>Pack size</th>
          </tr>
        </thead>
        <tbody>
          {project.priceBook.map((p) => (
            <tr key={p.id}>
              <td>
                <input
                  aria-label={`${p.id} name`}
                  value={p.name}
                  onChange={(e) => setProduct(p.id, { name: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  aria-label={`${p.id} list price per gallon`}
                  value={p.listPrice}
                  onChange={(e) =>
                    setProduct(p.id, { listPrice: Number(e.target.value) })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  aria-label={`${p.id} your price per gallon`}
                  value={p.actualPrice}
                  onChange={(e) =>
                    setProduct(p.id, { actualPrice: Number(e.target.value) })
                  }
                />
              </td>
              <td>{p.packSizeGal} gal</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Add Settings to App nav**

In `src/ui/App.tsx`, extend `type Screen` to `"takeoff" | "results" | "settings"`, add a nav button labelled `Settings`, and render `<SettingsScreen project={project} onChange={setProject} />` for that case.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add settings screen for rates and price book"
```

---

### Task 12: Close-out screen

**Files:**

- Create: `src/ui/CloseoutScreen.tsx`
- Modify: `src/ui/App.tsx`
- Test: `src/ui/__tests__/CloseoutScreen.test.tsx`

**Interfaces:**

- Consumes: `computeEstimate`, `computeCalibration`, `JobActuals`
- Produces: `<CloseoutScreen project={p} onChange={(p: Project) => void} />`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/__tests__/CloseoutScreen.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CloseoutScreen } from "../CloseoutScreen";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";

describe("CloseoutScreen", () => {
  it("shows an actuals input per product", () => {
    render(<CloseoutScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByLabelText(/Regal Select gallons/i)).toHaveValue(4);
    expect(screen.getByLabelText(/Waterborne Ceiling gallons/i)).toHaveValue(4);
  });

  it("reports real finish coverage, excluding primer", () => {
    render(<CloseoutScreen project={goldenJob} onChange={() => {}} />);
    expect(screen.getByTestId("finish-coverage")).toHaveTextContent("41");
  });

  it("flags products bought over estimate", () => {
    render(<CloseoutScreen project={goldenJob} onChange={() => {}} />);
    const ceiling = screen.getByTestId("drift-K508");
    expect(ceiling).toHaveTextContent("3");
    expect(ceiling).toHaveTextContent("4");
  });

  it("records an edited gallon count", async () => {
    const onChange = vi.fn();
    render(<CloseoutScreen project={goldenJob} onChange={onChange} />);
    const input = screen.getByLabelText(/Regal Select gallons/i);
    await userEvent.clear(input);
    await userEvent.type(input, "6");
    const updated = onChange.mock.calls.at(-1)![0];
    expect(updated.actuals.gallonsPurchased["549"]).toBe(6);
  });

  it("prompts before any actuals are entered", () => {
    const { actuals, ...withoutActuals } = goldenJob;
    render(
      <CloseoutScreen
        project={withoutActuals as typeof goldenJob}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText(/enter what you actually used/i),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/ui/__tests__/CloseoutScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the screen**

Create `src/ui/CloseoutScreen.tsx`:

```tsx
import { useMemo } from "react";
import type { Project } from "../engine/types";
import { computeEstimate } from "../engine/estimate";
import { computeCalibration } from "../engine/calibration";

interface Props {
  project: Project;
  onChange: (project: Project) => void;
}

export function CloseoutScreen({ project, onChange }: Props) {
  const estimate = useMemo(() => computeEstimate(project), [project]);
  const report = useMemo(
    () => computeCalibration(project, estimate),
    [project, estimate],
  );

  const actuals = project.actuals ?? {
    hoursWorked: 0,
    gallonsPurchased: {},
  };

  const setGallons = (productId: string, gallons: number) =>
    onChange({
      ...project,
      actuals: {
        ...actuals,
        gallonsPurchased: { ...actuals.gallonsPurchased, [productId]: gallons },
      },
    });

  return (
    <div className="closeout">
      <h2>Job close-out</h2>

      <label>
        Hours actually worked
        <input
          type="number"
          step="0.25"
          value={actuals.hoursWorked}
          onChange={(e) =>
            onChange({
              ...project,
              actuals: { ...actuals, hoursWorked: Number(e.target.value) },
            })
          }
        />
      </label>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Estimated</th>
            <th>Actually bought</th>
          </tr>
        </thead>
        <tbody>
          {estimate.materials.requirements.map((r) => {
            const product = project.priceBook.find((p) => p.id === r.productId);
            const name = product?.name ?? r.productId;
            return (
              <tr key={r.productId} data-testid={`drift-${r.productId}`}>
                <td>{name}</td>
                <td>{r.gallons}</td>
                <td>
                  <input
                    type="number"
                    step="1"
                    aria-label={`${name} gallons purchased`}
                    value={actuals.gallonsPurchased[r.productId] ?? 0}
                    onChange={(e) =>
                      setGallons(r.productId, Number(e.target.value))
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {report === null || report.finishGallonsActual === 0 ? (
        <p>Enter what you actually used to calibrate future estimates.</p>
      ) : (
        <section className="drift">
          <p>
            Finish coverage ran{" "}
            <strong data-testid="finish-coverage">
              {report.finishRealCoverage.toFixed(0)} sq ft/gal
            </strong>{" "}
            against {project.rateProfile.wallCoverage} assumed for walls and{" "}
            {project.rateProfile.ceilingCoverage} for ceilings.
          </p>
          <p>
            Finish paint: estimated {report.finishGallonsEstimated} gal, bought{" "}
            {report.finishGallonsActual} gal (
            {report.finishShortfallPct.toFixed(0)}%). Primer is tracked
            separately so it cannot mask a finish-coat shortfall.
          </p>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add Close-out to App nav**

Extend `type Screen` with `"closeout"`, add a nav button, render `<CloseoutScreen project={project} onChange={setProject} />`.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add job close-out with coverage drift reporting"
```

---

### Task 13: Quick Estimate screen

Built last deliberately. This is the one v1 feature nothing in the painter's own material asked for — if the call says cut it, deleting this task's files removes it cleanly.

**Files:**

- Create: `src/ui/QuickEstimateScreen.tsx`, `src/engine/quickEstimate.ts`
- Modify: `src/ui/App.tsx`
- Test: `src/engine/__tests__/quickEstimate.test.ts`, `src/ui/__tests__/QuickEstimateScreen.test.tsx`

**Interfaces:**

- Consumes: `Project`, `RateProfile`, `computeEstimate`
- Produces:
  - `FLOOR_TO_WALL_RATIO = 2.06` (derived in spec §9 from his own sheet)
  - `buildQuickProject(input: QuickInput, rates: RateProfile, priceBook: PaintProduct[]): Project`
  - `QuickInput = { floorAreaSqFt: number; ceilingHeight: number; doorCount: number; windowCount: number; paintCeilings: boolean; paintTrim: boolean }`

- [ ] **Step 1: Write the failing engine tests**

Create `src/engine/__tests__/quickEstimate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildQuickProject, FLOOR_TO_WALL_RATIO } from "../quickEstimate";
import { computeEstimate } from "../estimate";
import { goldenJob } from "../__fixtures__/goldenJob";

const rates = goldenJob.rateProfile;
const book = goldenJob.priceBook;

describe("buildQuickProject", () => {
  it("uses the 2.06 floor-to-wall ratio derived from his sheet", () => {
    expect(FLOOR_TO_WALL_RATIO).toBeCloseTo(2.06, 2);
  });

  it("produces one synthetic room whose wall area is floor area × ratio", () => {
    const p = buildQuickProject(
      {
        floorAreaSqFt: 1000,
        ceilingHeight: 8,
        doorCount: 0,
        windowCount: 0,
        paintCeilings: true,
        paintTrim: false,
      },
      rates,
      book,
    );
    const estimate = computeEstimate(p);
    const gross = estimate.geometry.reduce((s, g) => s + g.grossWallArea, 0);
    expect(gross).toBeCloseTo(2060, 0);
  });

  it("sets ceiling area equal to floor area", () => {
    const p = buildQuickProject(
      {
        floorAreaSqFt: 1000,
        ceilingHeight: 8,
        doorCount: 0,
        windowCount: 0,
        paintCeilings: true,
        paintTrim: false,
      },
      rates,
      book,
    );
    const estimate = computeEstimate(p);
    const ceiling = estimate.geometry.reduce((s, g) => s + g.ceilingArea, 0);
    expect(ceiling).toBeCloseTo(1000, 0);
  });

  it("deducts doors and windows from the wall area", () => {
    const withOpenings = buildQuickProject(
      {
        floorAreaSqFt: 1000,
        ceilingHeight: 8,
        doorCount: 10,
        windowCount: 8,
        paintCeilings: true,
        paintTrim: true,
      },
      rates,
      book,
    );
    const estimate = computeEstimate(withOpenings);
    const opening = estimate.geometry.reduce((s, g) => s + g.openingArea, 0);
    // 10 doors × 21 + 8 windows × 12 = 306
    expect(opening).toBeCloseTo(306, 0);
  });

  it("omits ceilings when paintCeilings is false", () => {
    const p = buildQuickProject(
      {
        floorAreaSqFt: 1000,
        ceilingHeight: 8,
        doorCount: 0,
        windowCount: 0,
        paintCeilings: false,
        paintTrim: false,
      },
      rates,
      book,
    );
    const estimate = computeEstimate(p);
    expect(estimate.geometry.reduce((s, g) => s + g.ceilingArea, 0)).toBe(0);
  });

  it("returns a zero estimate for zero floor area", () => {
    const p = buildQuickProject(
      {
        floorAreaSqFt: 0,
        ceilingHeight: 8,
        doorCount: 0,
        windowCount: 0,
        paintCeilings: true,
        paintTrim: true,
      },
      rates,
      book,
    );
    expect(computeEstimate(p).pricing.total).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/engine/__tests__/quickEstimate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement quick estimate**

Create `src/engine/quickEstimate.ts`:

```ts
import type {
  Opening,
  PaintProduct,
  Project,
  RateProfile,
  Room,
} from "./types";

/**
 * Derived in spec §9 from his own sheet: the four entered rooms total
 * 953.16 sq ft of floor against 1,960 sq ft of wall. Calibration refines
 * this per completed detailed takeoff.
 */
export const FLOOR_TO_WALL_RATIO = 2.06;

export interface QuickInput {
  floorAreaSqFt: number;
  ceilingHeight: number;
  doorCount: number;
  windowCount: number;
  paintCeilings: boolean;
  paintTrim: boolean;
}

export function buildQuickProject(
  input: QuickInput,
  rates: RateProfile,
  priceBook: PaintProduct[],
): Project {
  const wallArea = input.floorAreaSqFt * FLOOR_TO_WALL_RATIO;

  // Model the house as one rectangular room whose perimeter × height gives
  // the target wall area, and whose footprint equals the floor area.
  const perimeter =
    input.ceilingHeight > 0 ? wallArea / input.ceilingHeight : 0;
  const side = perimeter / 4;
  const depth = side > 0 ? input.floorAreaSqFt / side : 0;

  const openings: Opening[] = [];
  if (input.doorCount > 0) {
    openings.push({
      id: "quick-doors",
      kind: "door",
      quantity: input.doorCount,
      width: 3,
      height: 7,
      paintSlab: true,
      casedSides: 2,
    });
  }
  if (input.windowCount > 0) {
    openings.push({
      id: "quick-windows",
      kind: "window",
      quantity: input.windowCount,
      width: 4,
      height: 3,
      paintSlab: false,
      casedSides: 1,
    });
  }

  const room: Room = {
    id: "quick",
    name: "Whole house (estimated)",
    floor: 1,
    quantity: 1,
    walls: [side, depth],
    ceilingHeight: input.ceilingHeight,
    scope: {
      walls: true,
      ceiling: input.paintCeilings,
      trim: input.paintTrim,
      primer: "full",
    },
    wallProductId: "549",
    ceilingProductId: "K508",
    trimProductId: "550",
    openings,
  };

  return {
    id: "quick",
    name: "Quick estimate",
    rooms: [room],
    customSurfaces: [],
    rateProfile: rates,
    priceBook,
  };
}
```

Note on geometry: `walls: [side, depth]` mirrors to perimeter `2(side + depth)`, which is not exactly `4 × side` unless the footprint is square. The ceiling-area test pins `side × depth = floorArea`; the wall-area test pins the gross area. If both cannot hold simultaneously for a given input, the wall-area assertion wins — adjust `depth` derivation, never the test bounds.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/engine/__tests__/quickEstimate.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the UI test**

Create `src/ui/__tests__/QuickEstimateScreen.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickEstimateScreen } from "../QuickEstimateScreen";
import { goldenJob } from "../../engine/__fixtures__/goldenJob";

describe("QuickEstimateScreen", () => {
  it("shows a total once a floor area is entered", async () => {
    render(
      <QuickEstimateScreen
        rates={goldenJob.rateProfile}
        priceBook={goldenJob.priceBook}
      />,
    );
    const input = screen.getByLabelText(/square feet/i);
    await userEvent.clear(input);
    await userEvent.type(input, "2000");
    expect(screen.getByTestId("quick-total")).not.toHaveTextContent("$0.00");
  });

  it("states that the estimate is a ballpark", () => {
    render(
      <QuickEstimateScreen
        rates={goldenJob.rateProfile}
        priceBook={goldenJob.priceBook}
      />,
    );
    expect(screen.getByText(/ballpark/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Implement the screen**

Create `src/ui/QuickEstimateScreen.tsx`:

```tsx
import { useMemo, useState } from "react";
import type { PaintProduct, RateProfile } from "../engine/types";
import { buildQuickProject, type QuickInput } from "../engine/quickEstimate";
import { computeEstimate } from "../engine/estimate";
import { formatHours, formatMoney } from "./format";

interface Props {
  rates: RateProfile;
  priceBook: PaintProduct[];
}

export function QuickEstimateScreen({ rates, priceBook }: Props) {
  const [input, setInput] = useState<QuickInput>({
    floorAreaSqFt: 0,
    ceilingHeight: 8,
    doorCount: 0,
    windowCount: 0,
    paintCeilings: true,
    paintTrim: true,
  });

  const estimate = useMemo(
    () => computeEstimate(buildQuickProject(input, rates, priceBook)),
    [input, rates, priceBook],
  );

  const set = (patch: Partial<QuickInput>) =>
    setInput((prev) => ({ ...prev, ...patch }));

  return (
    <div className="quick">
      <h2>Quick estimate</h2>

      <label>
        Square feet (from the listing)
        <input
          type="number"
          value={input.floorAreaSqFt}
          onChange={(e) => set({ floorAreaSqFt: Number(e.target.value) })}
        />
      </label>
      <label>
        Ceiling height
        <input
          type="number"
          step="0.5"
          value={input.ceilingHeight}
          onChange={(e) => set({ ceilingHeight: Number(e.target.value) })}
        />
      </label>
      <label>
        Doors
        <input
          type="number"
          value={input.doorCount}
          onChange={(e) => set({ doorCount: Number(e.target.value) })}
        />
      </label>
      <label>
        Windows
        <input
          type="number"
          value={input.windowCount}
          onChange={(e) => set({ windowCount: Number(e.target.value) })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={input.paintCeilings}
          onChange={(e) => set({ paintCeilings: e.target.checked })}
        />
        Ceilings
      </label>
      <label>
        <input
          type="checkbox"
          checked={input.paintTrim}
          onChange={(e) => set({ paintTrim: e.target.checked })}
        />
        Trim
      </label>

      <p data-testid="quick-total">{formatMoney(estimate.pricing.total)}</p>
      <p>
        {formatHours(estimate.labor.hoursWorked)} hrs · {estimate.labor.days}{" "}
        crew-days
      </p>
      <p className="note">
        Ballpark only — wall area is estimated from floor area. Do a
        room-by-room takeoff before quoting.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Add Quick to App nav**

Extend `type Screen` with `"quick"`, add a nav button, render `<QuickEstimateScreen rates={project.rateProfile} priceBook={project.priceBook} />`.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS, every suite.

- [ ] **Step 9: Verify the app runs end to end**

Run: `npm run dev`
Click through all five screens. Confirm the takeoff totals update live and the results screen shows the roundup and travel breakdown. Stop the server.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add quick estimate mode"
```

---

## Spec coverage check

| Spec section                   | Task     |
| ------------------------------ | -------- |
| §6 architecture, engine purity | 1, 2     |
| §7 data model                  | 2, 7     |
| §8.1 geometry + openings       | 3        |
| §8.2 labor, roundup, travel    | 4        |
| §8.3 trim rate visible         | 11       |
| §8.4 materials, ROUNDUP        | 5        |
| §9 five screens                | 9–13     |
| §10 calibration                | 7, 12    |
| §12 G1 / G2 / G3               | 6        |
| §13 error handling             | 6, 9     |
| §4.5 defect 1 stairwell        | 5        |
| §4.5 defect 2 pack size        | 2, 6, 11 |
| §4.5 defects 3–4 calibration   | 7, 12    |
| §4.5 defects 5–6 openings/trim | 3, 9     |
| §4.5 defect 7 roundup visible  | 10       |
| §4.5 defect 9 blank rooms      | 6, 9     |

**Not covered in v1, by design:** §4.5 defect 8 (sundries/overhead — needs his numbers from the call, §14 Q5), §11 (floorplan sketcher, phase 2), customer-facing proposal (phase 3), exterior rate model (phase 2).
