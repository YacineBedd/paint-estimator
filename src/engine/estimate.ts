import { computeGeometry } from "./geometry";
import { computeLabor } from "./labor";
import { computeMaterials } from "./materials";
import { computePricing } from "./pricing";
import { collectWarnings } from "./warnings";
import type { Estimate, Project } from "./types";

export function computeEstimate(project: Project): Estimate {
  const { rooms, customSurfaces, rateProfile, priceBook } = project;

  const geometry = computeGeometry(rooms, rateProfile);
  const labor = computeLabor(geometry, customSurfaces, rateProfile);
  const materials = computeMaterials(
    rooms,
    geometry,
    customSurfaces,
    rateProfile,
    priceBook,
  );
  const pricing = computePricing(materials, priceBook, labor.laborCost);
  const warnings = collectWarnings(project, geometry);

  return { geometry, labor, materials, pricing, warnings };
}
