import { computeMaterials } from "./materials";
import type { Project, RoomGeometry, Warning } from "./types";

const STALE_DAYS = 182;

// A caller-supplied default keeps the engine deterministic — no Date.now()
// call lives in src/engine/** (purity.test.ts enforces this) — while still
// letting every existing call site that doesn't care about staleness omit
// the argument. Real callers (the UI) must pass Date.now() explicitly.
const FALLBACK_NOW = Date.parse("2026-08-16T00:00:00Z");

export function collectWarnings(
  project: Project,
  geometry: RoomGeometry[],
  now: number = FALLBACK_NOW,
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

  // The shipped price book ships with every price zeroed out (see the
  // comment on DEFAULT_PRICE_BOOK in src/data/defaults.ts) so no real
  // pricing goes into the bundle. A $0 actualPrice would otherwise let the
  // app silently quote $0 for that product's materials. Only products the
  // estimate actually consumes (computeMaterials' requirements — driven by
  // rooms' wall/ceiling/trim product assignments, custom surfaces, and the
  // derived primer requirement) are checked, so an unpriced product sitting
  // unused in the price book doesn't nag him.
  const priceById = new Map(project.priceBook.map((p) => [p.id, p]));
  const materials = computeMaterials(
    project.rooms,
    geometry,
    project.customSurfaces,
    project.rateProfile,
    project.priceBook,
  );
  for (const requirement of materials.requirements) {
    const product = priceById.get(requirement.productId);
    if (product && product.actualPrice <= 0) {
      warnings.push({
        level: "error",
        code: "UNPRICED_PRODUCT",
        message: `${product.name} has no price set. Set its price in Settings before quoting.`,
      });
    }
  }

  return warnings;
}
