import { describe, it, expect } from "vitest";
import { newOpening } from "../OpeningsEditor";

describe("newOpening defaults", () => {
  // F1: a window is cased on its interior face only -- the exterior face is
  // siding/brick, not something this estimate touches. Defaulting a window
  // to casedSides: 2 (both sides, like an interior door) overstates its
  // casing linear footage enough that placing a 4x3 window RAISES the bid
  // instead of lowering it: 28 lin ft of casing (14 sq ft of trim at the
  // 0.5 ft girth) against only 12 sq ft of wall removed.
  //
  // Verified on a 10x12x8 room: no window $794.62; casedSides: 2 $796.49
  // (up); casedSides: 1 $789.93 (down, correctly).
  it("defaults a window to one cased side", () => {
    const o = newOpening("window", "w1");
    expect(o.casedSides).toBe(1);
  });

  // A door is genuinely cased both sides -- both faces of its frame are
  // interior. This must not regress alongside the window fix.
  it("defaults a door to two cased sides", () => {
    const o = newOpening("door", "d1");
    expect(o.casedSides).toBe(2);
  });

  // A passage (interior opening, no door slab) is likewise interior on
  // both faces.
  it("defaults a passage to two cased sides", () => {
    const o = newOpening("passage", "p1");
    expect(o.casedSides).toBe(2);
  });
});
