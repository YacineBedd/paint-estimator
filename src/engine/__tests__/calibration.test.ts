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
