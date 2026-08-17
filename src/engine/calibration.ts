import type {
  CalibrationReport,
  CoverageDrift,
  Estimate,
  Project,
} from "./types";

export function computeCalibration(
  project: Project,
  estimate: Estimate,
): CalibrationReport | null {
  const actuals = project.actuals;
  if (!actuals) return null;

  const byId = new Map(project.priceBook.map((p) => [p.id, p]));

  const coverage: CoverageDrift[] = estimate.materials.requirements.map((r) => {
    const product = byId.get(r.productId);
    const actualGallons = actuals.gallonsPurchased[r.productId] ?? 0;
    const coatedArea = r.coatedArea * r.coats;

    return {
      productId: r.productId,
      name: product?.name ?? r.productId,
      isPrimer: product?.use === "primer",
      assumedCoverage: r.coverage,
      realCoverage: actualGallons > 0 ? coatedArea / actualGallons : 0,
      estimatedGallons: r.gallons,
      actualGallons,
      deltaPct:
        r.gallons > 0 ? ((actualGallons - r.gallons) / r.gallons) * 100 : 0,
    };
  });

  // Primer is never blended into the finish figure — averaging them is exactly
  // what let one error hide another in the source spreadsheet.
  const finish = coverage.filter((c) => !c.isPrimer);
  const finishGallonsEstimated = finish.reduce(
    (sum, c) => sum + c.estimatedGallons,
    0,
  );
  const finishGallonsActual = finish.reduce(
    (sum, c) => sum + c.actualGallons,
    0,
  );

  const finishCoatedArea = estimate.materials.requirements
    .filter(
      (r) => !byId.get(r.productId) || byId.get(r.productId)!.use !== "primer",
    )
    .reduce((sum, r) => sum + r.coatedArea * r.coats, 0);

  // Must match the area basis `labor.ts` bills hours against: room
  // wall/ceiling/trim area PLUS custom-surface area (e.g. "Doors & trim").
  // Custom surfaces carry real hours in `actuals.hoursWorked` but live
  // outside `estimate.geometry`, so omitting them here would understate
  // paintedArea and overstate the back-solved production rate.
  const paintedArea =
    estimate.geometry.reduce(
      (sum, g) => sum + g.netWallArea + g.ceilingArea + g.trimArea,
      0,
    ) + project.customSurfaces.reduce((sum, cs) => sum + cs.area, 0);

  return {
    coverage,
    finishGallonsEstimated,
    finishGallonsActual,
    finishShortfallPct:
      finishGallonsEstimated > 0
        ? ((finishGallonsActual - finishGallonsEstimated) /
            finishGallonsEstimated) *
          100
        : 0,
    finishRealCoverage:
      finishGallonsActual > 0 ? finishCoatedArea / finishGallonsActual : 0,
    productionRateAssumed: project.rateProfile.wallRate,
    productionRateActual:
      paintedArea > 0 ? (actuals.hoursWorked * 60) / paintedArea : null,
  };
}
