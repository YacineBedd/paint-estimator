import { describe, it, expect } from "vitest";
import { computeEstimate } from "../estimate";
import { goldenJob } from "../__fixtures__/goldenJob";
import type { Opening, Project, Room } from "../types";

const NOW = Date.parse("2026-08-19T00:00:00Z");

function roomWithOpening(overrides: Partial<Opening>): Project {
  const base = goldenJob.rooms[1]!;
  const room: Room = {
    ...base,
    id: "placement",
    walls: [10, 12],
    ceilingHeight: 8,
    scope: { walls: true, ceiling: true, trim: true, primer: "full" },
    openings: [
      {
        id: "o1",
        kind: "window",
        quantity: 2,
        width: 4,
        height: 3,
        paintSlab: false,
        casedSides: 1,
        ...overrides,
      },
    ],
  };
  return { ...goldenJob, id: "placement-project", rooms: [room] };
}

describe("opening placement is decoration", () => {
  it("produces an identical estimate regardless of wallIndex", () => {
    const a = computeEstimate(roomWithOpening({ wallIndex: 0 }), NOW);
    const b = computeEstimate(roomWithOpening({ wallIndex: 3 }), NOW);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("produces an identical estimate regardless of offset", () => {
    const a = computeEstimate(roomWithOpening({ offset: 0 }), NOW);
    const b = computeEstimate(roomWithOpening({ offset: 0.87 }), NOW);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("produces an identical estimate whether placement is set or absent", () => {
    const withPlacement = computeEstimate(
      roomWithOpening({ wallIndex: 2, offset: 0.4 }),
      NOW,
    );
    const without = computeEstimate(roomWithOpening({}), NOW);
    expect(JSON.stringify(withPlacement)).toBe(JSON.stringify(without));
  });

  it("still deducts the opening area — the decoupling is not just zeroing", () => {
    const withOpening = computeEstimate(roomWithOpening({ wallIndex: 1 }), NOW);
    const geo = withOpening.geometry[0]!;
    expect(geo.grossWallArea).toBeCloseTo(352, 4); // 2*(10+12)*8
    expect(geo.openingArea).toBeCloseTo(24, 4); // 2 windows * 4*3
    expect(geo.netWallArea).toBeCloseTo(328, 4);
  });
});
