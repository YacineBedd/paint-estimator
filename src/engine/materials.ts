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

  /** productId → coated area, before coats are applied */
  const areas = new Map<string, number>();
  const add = (productId: string, area: number) => {
    if (area <= 0) return;
    areas.set(productId, (areas.get(productId) ?? 0) + area);
  };

  let primerArea = 0;

  for (const room of rooms) {
    const g = geoById.get(room.id);
    if (!g) continue;

    add(room.wallProductId, g.netWallArea);
    add(room.ceilingProductId, g.ceilingArea);
    add(room.trimProductId, g.trimArea);

    if (room.scope.primer === "full") {
      primerArea += g.grossWallArea;
    } else if (room.scope.primer === "spot") {
      primerArea += g.grossWallArea * rates.spotPrimeFraction;
    }
  }

  for (const cs of customSurfaces) {
    add(cs.productId, cs.area);
    if (cs.includeInPrimer) primerArea += cs.area;
  }

  const primerProduct = priceBook.find((p) => p.use === "primer");
  if (primerProduct && primerArea > 0) {
    add(primerProduct.id, primerArea);
  }

  const requirements: ProductRequirement[] = [];
  for (const [productId, area] of areas) {
    const product = byId.get(productId);
    if (!product) continue;

    // A custom surface carries its own coat count; otherwise use the product's.
    const custom = customSurfaces.find((cs) => cs.productId === productId);
    const coats = custom ? custom.coats : coatsFor(product, rates);
    const coverage = coverageFor(product, rates);
    const rawGallons = (area * coats) / coverage;

    requirements.push({
      productId,
      coatedArea: area,
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
