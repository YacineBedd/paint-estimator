import { describe, it, expect } from "vitest";
import { computeMaterials } from "../materials";
import { computeGeometry } from "../geometry";
import { goldenJob, GOLDEN_EXPECTED } from "../__fixtures__/goldenJob";
import type { CustomSurface } from "../types";

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

  // F7: room trim and a custom surface sharing the same product must each
  // keep their own coat count. A naive "resolve one coat count per product"
  // implementation lets whichever source is found last (or the custom
  // surface unconditionally) win, silently changing gallons for the other
  // source's area too.
  it("keeps distinct coat counts when room trim and a custom surface share a product", () => {
    const roomWithTrim = {
      ...goldenJob.rooms[1]!,
      id: "trimroom",
      walls: [10, 10],
      ceilingHeight: 8,
      scope: {
        walls: false,
        ceiling: false,
        trim: true,
        primer: "none" as const,
      },
      trimProductId: "550",
    };
    // rates.coats.trim === 1, so room trim contributes at 1 coat.
    const rooms = [roomWithTrim];
    const customSurfaces: CustomSurface[] = [
      {
        id: "cs-x",
        name: "Garage door",
        area: 100,
        rateMinPerSqFt: 0.75,
        productId: "550",
        coats: 3,
        includeInPrimer: false,
      },
    ];
    const g = computeGeometry(rooms, rates);
    const r = computeMaterials(
      rooms,
      g,
      customSurfaces,
      rates,
      goldenJob.priceBook,
    );
    const trimReq = r.requirements.find((x) => x.productId === "550")!;

    const roomTrimArea = g[0]!.trimArea; // baseboard+casing at girth 0.5, no slab
    expect(roomTrimArea).toBeGreaterThan(0);

    const expectedCoatedArea = roomTrimArea * 1 + 100 * 3;
    const expectedArea = roomTrimArea + 100;
    expect(trimReq.coatedArea).toBeCloseTo(expectedArea, 4);
    expect(trimReq.rawGallons).toBeCloseTo(
      expectedCoatedArea / trimReq.coverage,
      4,
    );
    expect(trimReq.gallons).toBe(
      Math.ceil(expectedCoatedArea / trimReq.coverage),
    );
  });

  // F4: primer was computed on grossWallArea while finish paint used
  // netWallArea, so a room with windows/doors got primed on top of glass and
  // door slabs that finish paint never touches. Primer must track the SAME
  // net surface as finish so the two move together.
  it("primer tracks netWallArea (openings deducted), not grossWallArea, when a room has openings", () => {
    const room = {
      ...goldenJob.rooms[1]!,
      id: "primerRoom",
      walls: [10, 10],
      ceilingHeight: 8,
      scope: {
        walls: true,
        ceiling: false,
        trim: false,
        primer: "full" as const,
      },
      wallProductId: "549",
      openings: [
        {
          id: "o1",
          kind: "window" as const,
          quantity: 4,
          width: 3,
          height: 4,
          paintSlab: false,
          casedSides: 1 as const,
        },
      ],
    };
    const g = computeGeometry([room], rates);
    const r = computeMaterials([room], g, [], rates, goldenJob.priceBook);
    const primer = r.requirements.find((x) => x.productId === "K380")!;
    const finish = r.requirements.find((x) => x.productId === "549")!;

    // Sanity check the fixture actually has openings deducted.
    expect(g[0]!.netWallArea).toBeLessThan(g[0]!.grossWallArea);

    expect(primer.coatedArea).toBeCloseTo(g[0]!.netWallArea, 4);
    expect(primer.coatedArea).toBeCloseTo(finish.coatedArea, 4);
    expect(primer.coatedArea).not.toBeCloseTo(g[0]!.grossWallArea, 4);
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
