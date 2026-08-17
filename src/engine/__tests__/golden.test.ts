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
              casedSides: 1 as const,
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
