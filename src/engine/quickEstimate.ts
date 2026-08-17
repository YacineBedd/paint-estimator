import type {
  Opening,
  PaintProduct,
  Project,
  RateProfile,
  Room,
} from "./types";

/**
 * Derived in spec §9 from his own sheet: the four entered rooms total
 * 953.16 sq ft of floor against 1,960 sq ft of wall. Calibration refines
 * this per completed detailed takeoff.
 */
export const FLOOR_TO_WALL_RATIO = 2.06;

export interface QuickInput {
  floorAreaSqFt: number;
  ceilingHeight: number;
  doorCount: number;
  windowCount: number;
  paintCeilings: boolean;
  paintTrim: boolean;
}

/**
 * Derives a rectangle's two side lengths from a target half-perimeter
 * (side + depth) and a target floor area (side * depth), by solving
 * x^2 - Sx + F = 0 for S = halfPerimeter, F = floorArea.
 *
 * Per the task brief, the wall-area assertion wins: `side + depth` always
 * equals `halfPerimeter` exactly (so `grossWallArea = perimeter * height`
 * hits its target exactly), regardless of what happens below. Floor area
 * (`side * depth`) is reproduced exactly whenever the quadratic has real
 * roots (halfPerimeter^2 >= 4 * floorArea) — true for any normal room or
 * house shape. Below that threshold (a very tall ceiling over a very small
 * footprint) the roots collapse to an equal split (side === depth), which
 * still hits the wall-area target exactly but undershoots the floor-area
 * target. That degradation is acceptable for a ballpark: wall area drives
 * the money, ceiling area is secondary.
 */
function sideAndDepth(
  halfPerimeter: number,
  floorArea: number,
): [number, number] {
  const discriminant = halfPerimeter * halfPerimeter - 4 * floorArea;
  const sqrtDiscriminant = discriminant > 0 ? Math.sqrt(discriminant) : 0;
  const side = (halfPerimeter + sqrtDiscriminant) / 2;
  const depth = halfPerimeter - side;
  return [side, depth];
}

export function buildQuickProject(
  input: QuickInput,
  rates: RateProfile,
  priceBook: PaintProduct[],
): Project {
  const wallArea = input.floorAreaSqFt * FLOOR_TO_WALL_RATIO;

  // Model the house as one rectangular room whose perimeter × height gives
  // the target wall area, and whose footprint reproduces the floor area
  // (see sideAndDepth for the derivation and its edge-case behavior).
  const halfPerimeter =
    input.ceilingHeight > 0 ? wallArea / input.ceilingHeight / 2 : 0;
  const [side, depth] = sideAndDepth(halfPerimeter, input.floorAreaSqFt);

  const openings: Opening[] = [];
  if (input.doorCount > 0) {
    openings.push({
      id: "quick-doors",
      kind: "door",
      quantity: input.doorCount,
      width: 3,
      height: 7,
      paintSlab: true,
      casedSides: 2,
    });
  }
  if (input.windowCount > 0) {
    openings.push({
      id: "quick-windows",
      kind: "window",
      quantity: input.windowCount,
      width: 4,
      height: 3,
      paintSlab: false,
      casedSides: 1,
    });
  }

  const room: Room = {
    id: "quick",
    name: "Whole house (estimated)",
    floor: 1,
    quantity: 1,
    walls: [side, depth],
    ceilingHeight: input.ceilingHeight,
    scope: {
      walls: true,
      ceiling: input.paintCeilings,
      trim: input.paintTrim,
      primer: "full",
    },
    wallProductId: "549",
    ceilingProductId: "K508",
    trimProductId: "550",
    openings,
  };

  return {
    id: "quick",
    name: "Quick estimate",
    rooms: [room],
    customSurfaces: [],
    rateProfile: rates,
    priceBook,
  };
}
