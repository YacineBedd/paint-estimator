import { computeGeometry } from "./geometry";
import { computeLabor } from "./labor";
import { computeMaterials } from "./materials";
import { computePricing } from "./pricing";
import { collectWarnings } from "./warnings";
import type { Estimate, Project } from "./types";

// `now` is optional: engine callers that don't care about price staleness
// (most tests) can omit it and get warnings.ts's deterministic fallback. The
// UI must pass Date.now() explicitly at the call site — that's the ONLY
// place a browser clock is allowed to enter this system. Date.now() itself
// must never appear inside src/engine/** (purity.test.ts enforces this).
export function computeEstimate(project: Project, now?: number): Estimate {
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
  const warnings = collectWarnings(project, geometry, now);

  return { geometry, labor, materials, pricing, warnings };
}
