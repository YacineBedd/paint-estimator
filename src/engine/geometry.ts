import type { Opening, RateProfile, Room, RoomGeometry } from "./types";

/** A 2-entry wall list means a rectangle: [a, b] → a + b + a + b. */
export function roomPerimeter(room: Room): number {
  const walls = room.walls;
  if (walls.length === 2) {
    return (walls[0]! + walls[1]!) * 2;
  }
  return walls.reduce((sum, w) => sum + w, 0);
}

const openingArea = (o: Opening): number => o.width * o.height * o.quantity;

const casingLinFt = (o: Opening): number =>
  o.kind === "door" || o.kind === "passage"
    ? (2 * o.height + o.width) * o.casedSides * o.quantity
    : 2 * (o.width + o.height) * o.casedSides * o.quantity;

const slabArea = (o: Opening): number =>
  o.kind === "door" && o.paintSlab ? o.width * o.height * 2 * o.quantity : 0;

export function computeRoomGeometry(
  room: Room,
  rates: RateProfile,
): RoomGeometry {
  const qty = room.quantity ?? 1;
  const perimeter = roomPerimeter(room);
  const grossWallArea = perimeter * room.ceilingHeight * qty;

  const openings = room.openings ?? [];
  const deduction = openings.reduce((sum, o) => sum + openingArea(o), 0) * qty;
  const openingAreaTotal = Math.min(deduction, grossWallArea);

  const doorWidths = openings
    .filter((o) => o.kind === "door" || o.kind === "passage")
    .reduce((sum, o) => sum + o.width * o.quantity, 0);

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
      room.walls.length >= 2 ? room.walls[0]! * room.walls[1]! * qty : 0,
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
