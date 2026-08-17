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
