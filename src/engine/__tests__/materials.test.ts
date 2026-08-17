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
