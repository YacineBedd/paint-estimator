import type { Project, RoomGeometry, Warning } from "./types";

const STALE_DAYS = 182;

export function collectWarnings(
  project: Project,
  geometry: RoomGeometry[],
): Warning[] {
  const warnings: Warning[] = [];
  const geoById = new Map(geometry.map((g) => [g.roomId, g]));

  for (const room of project.rooms) {
    const hasDimensions =
      room.walls.length > 0 && room.walls.every((w) => w > 0);
    if (!hasDimensions) {
      warnings.push({
        level: "warning",
        code: "EMPTY_ROOM",
        roomId: room.id,
        message: `"${room.name}" has no dimensions and contributes nothing to the estimate.`,
      });
      continue;
    }

    const g = geoById.get(room.id);
    if (g && room.scope.walls && g.openingArea >= g.grossWallArea) {
      warnings.push({
        level: "error",
        code: "OPENINGS_EXCEED_WALL",
        roomId: room.id,
        message: `"${room.name}": doors and windows total ${g.openingArea.toFixed(1)} sq ft, which meets or exceeds its ${g.grossWallArea.toFixed(1)} sq ft of wall.`,
      });
    }
  }

  const now = Date.parse("2026-08-16T00:00:00Z");
  for (const product of project.priceBook) {
    const updated = Date.parse(product.priceUpdatedAt);
    if (Number.isNaN(updated)) continue;
    const days = (now - updated) / 86_400_000;
    if (days > STALE_DAYS) {
      warnings.push({
        level: "info",
        code: "STALE_PRICE",
        message: `${product.name} price last updated ${Math.round(days)} days ago.`,
      });
    }
  }

  return warnings;
}
