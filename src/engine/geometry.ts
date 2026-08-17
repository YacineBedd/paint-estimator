import type { Opening, RateProfile, Room, RoomGeometry } from "./types";

/** A 2-entry wall list means a rectangle: [a, b] → a + b + a + b. */
export function roomPerimeter(room: Room): number {
  const walls = room.walls;
  if (walls.length === 2) {
    return (walls[0]! + walls[1]!) * 2;
  }
  return walls.reduce((sum, w) => sum + w, 0);
}

// A negative width/height/quantity is only reachable through a hand-edited
// or corrupted import file (the UI enforces min={0}), but the engine must
// not depend on the UI for its invariants: an unclamped negative value here
// would silently subtract area (and thus hours/money) instead of
// contributing nothing — or, in doorWidths' case below (subtracted from
// perimeter rather than added to a total), inflate it instead. Clamp each
// dimension individually, the same way room walls and ceiling height are
// clamped below, and share this one helper across every opening arithmetic
// path so none of them can drift out of sync with the others.
const clampNonNegative = (n: number): number => Math.max(0, n);

const openingArea = (o: Opening): number =>
  clampNonNegative(o.width) *
  clampNonNegative(o.height) *
  clampNonNegative(o.quantity);

const casingLinFt = (o: Opening): number => {
  const width = clampNonNegative(o.width);
  const height = clampNonNegative(o.height);
  const quantity = clampNonNegative(o.quantity);
  return o.kind === "door" || o.kind === "passage"
    ? (2 * height + width) * o.casedSides * quantity
    : 2 * (width + height) * o.casedSides * quantity;
};

const slabArea = (o: Opening): number =>
  o.kind === "door" && o.paintSlab
    ? clampNonNegative(o.width) *
      clampNonNegative(o.height) *
      2 *
      clampNonNegative(o.quantity)
    : 0;

/**
 * Computes wall, ceiling, and trim geometry for one room, net of openings.
 *
 * Ceiling area convention: a 4-entry `room.walls` array MUST be ordered
 * `[a, b, a, b]` — alternating opposite sides of a rectangle, matching the
 * 2-entry `[a, b]` convention. `ceilingArea` is derived as `walls[0] *
 * walls[1]`, which depends on that ordering: a grouped-pairs array such as
 * `[10, 10, 12, 12]` (same rectangle, different order) yields a wrong
 * ceiling area (100 instead of 120). v1's UI only ever produces 2-entry
 * arrays, so this is currently latent, not live.
 */
export function computeRoomGeometry(
  room: Room,
  rates: RateProfile,
): RoomGeometry {
  const qty = room.quantity;
  // A mis-keyed negative wall length or ceiling height must never produce a
  // negative surface (which would silently subtract hours/material rather
  // than flag the room as empty). Clamp each wall entry individually — not
  // just the final perimeter — so one bad entry in a multi-wall room only
  // zeroes its own contribution instead of cancelling out the others.
  const clampedWalls = room.walls.map((w) => Math.max(0, w));
  const clampedRoom: Room = { ...room, walls: clampedWalls };
  const ceilingHeight = Math.max(0, room.ceilingHeight);
  const perimeter = roomPerimeter(clampedRoom);
  const grossWallArea = perimeter * ceilingHeight * qty;

  const openings = room.openings;
  const deduction = openings.reduce((sum, o) => sum + openingArea(o), 0) * qty;
  const openingAreaTotal = Math.min(deduction, grossWallArea);

  // doorWidths is SUBTRACTED from perimeter below, so — unlike the additive
  // openingArea/casingLinFt/slabArea helpers above — an unclamped negative
  // width or quantity here doesn't zero out; it makes baseboard LONGER than
  // the room's actual perimeter, inflating trimArea, hours, and price.
  // Clamp with the same shared helper those three helpers use, so this
  // fourth arithmetic path can't drift out of sync with them.
  const doorWidths = openings
    .filter((o) => o.kind === "door" || o.kind === "passage")
    .reduce(
      (sum, o) =>
        sum + clampNonNegative(o.width) * clampNonNegative(o.quantity),
      0,
    );

  const baseboard = Math.max(0, perimeter - doorWidths) * qty;
  const casing = openings.reduce((sum, o) => sum + casingLinFt(o), 0) * qty;
  const slab = openings.reduce((sum, o) => sum + slabArea(o), 0) * qty;

  const inScope = (on: boolean, value: number) => (on ? value : 0);

  return {
    roomId: room.id,
    grossWallArea: inScope(room.scope.walls, grossWallArea),
    openingArea: inScope(room.scope.walls, openingAreaTotal),
    netWallArea: inScope(
      room.scope.walls,
      Math.max(0, grossWallArea - openingAreaTotal),
    ),
    ceilingArea: inScope(
      room.scope.ceiling,
      clampedWalls.length >= 2 ? clampedWalls[0]! * clampedWalls[1]! * qty : 0,
    ),
    baseboardLinFt: inScope(room.scope.trim, baseboard),
    casingLinFt: inScope(room.scope.trim, casing),
    doorSlabArea: inScope(room.scope.trim, slab),
    trimArea: inScope(
      room.scope.trim,
      (baseboard + casing) * rates.trimGirthFt + slab,
    ),
  };
}

export function computeGeometry(
  rooms: Room[],
  rates: RateProfile,
): RoomGeometry[] {
  return rooms.map((room) => computeRoomGeometry(room, rates));
}
