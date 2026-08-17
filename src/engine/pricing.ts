import type {
  MaterialLine,
  MaterialsResult,
  PaintProduct,
  PricingResult,
} from "./types";

export function computePricing(
  materials: MaterialsResult,
  priceBook: PaintProduct[],
  laborCost: number,
): PricingResult {
  const byId = new Map(priceBook.map((p) => [p.id, p]));

  const materialLines: MaterialLine[] = materials.requirements.flatMap((r) => {
    const product = byId.get(r.productId);
    if (!product) return [];
    // Prices are per gallon. packSizeGal never enters this calculation.
    return [
      {
        productId: r.productId,
        name: product.name,
        gallons: r.gallons,
        unitPrice: product.actualPrice,
        lineCost: r.gallons * product.actualPrice,
        listUnitPrice: product.listPrice,
        listLineCost: r.gallons * product.listPrice,
      },
    ];
  });

  const materialCost = materialLines.reduce((sum, l) => sum + l.lineCost, 0);
  const materialCostAtList = materialLines.reduce(
    (sum, l) => sum + l.listLineCost,
    0,
  );

  return {
    materialLines,
    materialCost,
    materialCostAtList,
    laborCost,
    total: laborCost + materialCost,
  };
}
