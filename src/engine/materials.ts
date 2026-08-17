import type {
  CustomSurface,
  MaterialsResult,
  PaintProduct,
  ProductRequirement,
  RateProfile,
  Room,
  RoomGeometry,
} from "./types";

function coatsFor(product: PaintProduct, rates: RateProfile): number {
  switch (product.use) {
    case "primer":
      return 1;
    case "wall":
      return rates.coats.walls;
    case "ceiling":
      return rates.coats.ceilings;
    case "trim":
      return rates.coats.trim;
    case "specialty":
      return rates.coats.specialty;
  }
}

function coverageFor(product: PaintProduct, rates: RateProfile): number {
  if (product.coverageOverride !== undefined) return product.coverageOverride;
  return product.use === "ceiling" ? rates.ceilingCoverage : rates.wallCoverage;
}

export function computeMaterials(
  rooms: Room[],
  geometry: RoomGeometry[],
  customSurfaces: CustomSurface[],
  rates: RateProfile,
  priceBook: PaintProduct[],
): MaterialsResult {
  const byId = new Map(priceBook.map((p) => [p.id, p]));
  const geoById = new Map(geometry.map((g) => [g.roomId, g]));

  // Coats belong to the AREA SOURCE (a room's wall scope, a room's trim
  // scope, a custom surface), not to the product. Two sources sharing a
  // product — e.g. room trim and a custom surface both on product "550" —
  // can legitimately want different coat counts. Resolving a single coat
  // count for the whole merged bucket (as a naive "areas: Map<id, area>"
  // would force) silently overwrites one source's coats with the other's and
  // corrupts gallons for both. Instead we accumulate, per product, both the
  // raw area (for display) and the coat-weighted area (area × coats, for
  // gallons) so each source contributes its own coat count independently.
  const buckets = new Map<string, { area: number; coatedArea: number }>();
  const contribute = (productId: string, area: number, coats: number) => {
    if (area <= 0) return;
    const entry = buckets.get(productId) ?? { area: 0, coatedArea: 0 };
    entry.area += area;
    entry.coatedArea += area * coats;
    buckets.set(productId, entry);
  };

  let primerArea = 0;

  for (const room of rooms) {
    const g = geoById.get(room.id);
    if (!g) continue;

    const wallProduct = byId.get(room.wallProductId);
    if (wallProduct) {
      contribute(
        room.wallProductId,
        g.netWallArea,
        coatsFor(wallProduct, rates),
      );
    }
    const ceilingProduct = byId.get(room.ceilingProductId);
    if (ceilingProduct) {
      contribute(
        room.ceilingProductId,
        g.ceilingArea,
        coatsFor(ceilingProduct, rates),
      );
    }
    const trimProduct = byId.get(room.trimProductId);
    if (trimProduct) {
      contribute(room.trimProductId, g.trimArea, coatsFor(trimProduct, rates));
    }

    // Primer must track the SAME surface as finish paint (netWallArea, i.e.
    // openings already deducted). Using grossWallArea here would prime the
    // windows and doors along with the wall, inflating primer gallons beyond
    // what the finish coat actually needs.
    if (room.scope.primer === "full") {
      primerArea += g.netWallArea;
    } else if (room.scope.primer === "spot") {
      primerArea += g.netWallArea * rates.spotPrimeFraction;
    }
  }

  for (const cs of customSurfaces) {
    contribute(cs.productId, cs.area, cs.coats);
    if (cs.includeInPrimer) primerArea += cs.area;
  }

  const primerProduct = priceBook.find((p) => p.use === "primer");
  if (primerProduct && primerArea > 0) {
    contribute(primerProduct.id, primerArea, coatsFor(primerProduct, rates));
  }

  const requirements: ProductRequirement[] = [];
  for (const [productId, bucket] of buckets) {
    const product = byId.get(productId);
    if (!product) continue;

    const coverage = coverageFor(product, rates);
    const rawGallons = bucket.coatedArea / coverage;
    // Reported as the effective (area-weighted) coat count across every
    // source that shares this product, so it stays meaningful even when
    // sources disagree — but gallons are always derived from the true
    // coat-weighted area above, never from this average re-multiplied by area.
    const coats = bucket.area > 0 ? bucket.coatedArea / bucket.area : 0;

    requirements.push({
      productId,
      coatedArea: bucket.area,
      coats,
      coverage,
      rawGallons,
      gallons: Math.ceil(rawGallons),
    });
  }

  return {
    requirements,
    totalGallons: requirements.reduce((sum, r) => sum + r.gallons, 0),
  };
}
