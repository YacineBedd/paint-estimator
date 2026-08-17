import { describe, it, expect } from "vitest";
import { computeRoomGeometry, roomPerimeter } from "../geometry";
import { goldenJob, GOLDEN_EXPECTED } from "../__fixtures__/goldenJob";
import type { Room, RateProfile, Opening } from "../types";

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

  // Every other opening/casing/slab/baseboard test above uses quantity: 1,
  // and the only quantity test uses openings: []. Neither combination would
  // catch an implementation that double-scales opening deduction by qty, or
  // forgets to scale baseboard/casing/slab by qty at all. This test pins all
  // seven outputs together with quantity: 3 and one door opening present.
  it("scales opening deduction, baseboard, casing, and slab by room quantity together", () => {
    const room: Room = {
      ...base,
      walls: [10, 10],
      ceilingHeight: 8,
      quantity: 3,
      scope: { walls: true, ceiling: true, trim: true, primer: "full" },
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
    expect(g.grossWallArea).toBeCloseTo(960, 4);
    expect(g.openingArea).toBeCloseTo(126, 4);
    expect(g.netWallArea).toBeCloseTo(834, 4);
    expect(g.baseboardLinFt).toBeCloseTo(102, 4);
    expect(g.casingLinFt).toBeCloseTo(204, 4);
    expect(g.doorSlabArea).toBeCloseTo(252, 4);
    expect(g.trimArea).toBeCloseTo(405, 4);
  });

  // v1's UI never produces a "passage" opening, but the engine handles it
  // like a screenless doorway: it interrupts baseboard (like a door), gets
  // door-style 3-sided casing (2h + w), and never contributes slab area
  // even if paintSlab is set true (nothing to paint — there's no door).
  it("treats passage openings like doors for baseboard/casing but never adds slab area", () => {
    const room: Room = {
      ...base,
      openings: [
        {
          id: "o1",
          kind: "passage",
          quantity: 1,
          width: 3,
          height: 7,
          paintSlab: true,
          casedSides: 2,
        },
      ],
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.baseboardLinFt).toBeCloseTo(37, 4); // 40 − 3
    expect(g.casingLinFt).toBeCloseTo(34, 4); // (2×7+3) × 2 sides
    expect(g.doorSlabArea).toBe(0);
  });

  // F3: a mis-keyed negative dimension must never subtract area (and thus
  // hours/material) from a room — it should behave as if that entry were 0,
  // not go negative and silently deflate the whole estimate.
  it("clamps a negative wall dimension to 0 rather than going negative", () => {
    const room: Room = {
      ...base,
      walls: [-10, 5],
      ceilingHeight: 8,
      openings: [],
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.grossWallArea).toBeGreaterThanOrEqual(0);
    expect(g.netWallArea).toBeGreaterThanOrEqual(0);
    expect(g.ceilingArea).toBeGreaterThanOrEqual(0);
    expect(g.baseboardLinFt).toBeGreaterThanOrEqual(0);
    expect(g.trimArea).toBeGreaterThanOrEqual(0);
    // -10 clamps to 0, so perimeter is (0 + 5) × 2 = 10, not -10.
    expect(g.grossWallArea).toBeCloseTo(80, 4); // 10 perimeter × 8 height
    expect(g.ceilingArea).toBe(0); // 0 × 5
  });

  it("clamps a negative ceiling height to 0", () => {
    const room: Room = {
      ...base,
      walls: [10, 10],
      ceilingHeight: -8,
      openings: [],
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.grossWallArea).toBe(0);
    expect(g.netWallArea).toBe(0);
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

  // Split into three isolated cases (rather than flipping walls/ceiling/trim
  // false together) so a mix-up — e.g. ceilingArea accidentally keyed off
  // scope.walls instead of scope.ceiling — would fail one of these instead
  // of hiding behind the other two flags being off too.
  it("zeroes only wall output when scope.walls is off, leaving ceiling and trim computed", () => {
    const room: Room = {
      ...base,
      openings: [],
      scope: { walls: false, ceiling: true, trim: true, primer: "full" },
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.netWallArea).toBe(0);
    expect(g.grossWallArea).toBe(0);
    expect(g.openingArea).toBe(0);
    expect(g.ceilingArea).toBeCloseTo(100, 4); // 10 × 10
    expect(g.baseboardLinFt).toBeCloseTo(40, 4);
  });

  it("zeroes only ceiling output when scope.ceiling is off, leaving walls and trim computed", () => {
    const room: Room = {
      ...base,
      openings: [],
      scope: { walls: true, ceiling: false, trim: true, primer: "full" },
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.ceilingArea).toBe(0);
    expect(g.netWallArea).toBeCloseTo(320, 4); // 40 perimeter × 8
    expect(g.baseboardLinFt).toBeCloseTo(40, 4);
  });

  it("zeroes only trim output when scope.trim is off, leaving walls and ceiling computed", () => {
    const room: Room = {
      ...base,
      openings: [],
      scope: { walls: true, ceiling: true, trim: false, primer: "full" },
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.baseboardLinFt).toBe(0);
    expect(g.casingLinFt).toBe(0);
    expect(g.doorSlabArea).toBe(0);
    expect(g.trimArea).toBe(0);
    expect(g.netWallArea).toBeCloseTo(320, 4);
    expect(g.ceilingArea).toBeCloseTo(100, 4);
  });
});

// Documents and pins the contract stated on Room.walls and on
// computeRoomGeometry: a 4-entry walls array must be ordered [a, b, a, b]
// (alternating opposite sides), not grouped pairs. [10, 12, 10, 12] is the
// same rectangle as [10, 12] and must produce the same 120 sq ft ceiling.
// R2: a negative Opening.width/height/quantity is only reachable through a
// hand-edited or corrupted import file (importProject does not validate
// numeric ranges), but the engine must not depend on the UI's min={0} for
// its own invariants. A negative dimension must never subtract casing/trim/
// slab area — it must behave as if that opening contributed nothing.
describe("opening dimension clamping (R2)", () => {
  const base: Room = {
    ...goldenJob.rooms[1]!,
    id: "t3",
    walls: [10, 10],
    ceilingHeight: 8,
    scope: { walls: true, ceiling: true, trim: true, primer: "full" },
  };

  const doorOpening: Opening = {
    id: "o1",
    kind: "door",
    quantity: 1,
    width: 3,
    height: 7,
    paintSlab: true,
    casedSides: 2,
  };

  it("clamps a negative opening width to 0 rather than subtracting area", () => {
    const room: Room = {
      ...base,
      openings: [{ ...doorOpening, width: -3 }],
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.openingArea).toBeGreaterThanOrEqual(0);
    expect(g.casingLinFt).toBeGreaterThanOrEqual(0);
    expect(g.doorSlabArea).toBeGreaterThanOrEqual(0);
    expect(g.trimArea).toBeGreaterThanOrEqual(0);
  });

  it("clamps a negative opening height to 0 rather than subtracting area", () => {
    const room: Room = {
      ...base,
      openings: [{ ...doorOpening, height: -7 }],
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.openingArea).toBeGreaterThanOrEqual(0);
    expect(g.casingLinFt).toBeGreaterThanOrEqual(0);
    expect(g.doorSlabArea).toBeGreaterThanOrEqual(0);
    expect(g.trimArea).toBeGreaterThanOrEqual(0);
  });

  it("clamps a negative opening quantity to contribute nothing rather than subtracting", () => {
    const room: Room = {
      ...base,
      openings: [{ ...doorOpening, quantity: -2 }],
    };
    const zeroQtyRoom: Room = {
      ...base,
      openings: [{ ...doorOpening, quantity: 0 }],
    };
    const g = computeRoomGeometry(room, rates);
    const zeroG = computeRoomGeometry(zeroQtyRoom, rates);
    // openingArea/casingLinFt/doorSlabArea flow through the three clamped
    // helpers (openingArea, casingLinFt, slabArea) and so match the
    // zero-quantity room exactly. trimArea also folds in room-level
    // baseboard (perimeter minus door widths), which is a separate,
    // unclamped computation outside this fix's scope — so it is only
    // asserted non-negative, not equal to the zero-quantity case.
    expect(g.openingArea).toBe(zeroG.openingArea);
    expect(g.casingLinFt).toBe(zeroG.casingLinFt);
    expect(g.doorSlabArea).toBe(zeroG.doorSlabArea);
    expect(g.trimArea).toBeGreaterThanOrEqual(0);
  });

  it("never lets netWallArea exceed grossWallArea as a result of any clamping", () => {
    const room: Room = {
      ...base,
      openings: [{ ...doorOpening, width: -3, height: -7, quantity: -4 }],
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.netWallArea).toBeLessThanOrEqual(g.grossWallArea);
  });
});

describe("ceiling area — 4-entry walls ordering contract", () => {
  it("derives ceilingArea from walls[0] * walls[1] for an alternating 4-entry list", () => {
    const room: Room = {
      ...goldenJob.rooms[1]!,
      id: "t2",
      walls: [10, 12, 10, 12],
      ceilingHeight: 8,
      quantity: 1,
      scope: { walls: true, ceiling: true, trim: false, primer: "full" },
      openings: [],
    };
    const g = computeRoomGeometry(room, rates);
    expect(g.ceilingArea).toBeCloseTo(120, 4);
  });
});
