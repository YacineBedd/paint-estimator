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
