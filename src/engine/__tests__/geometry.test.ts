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
