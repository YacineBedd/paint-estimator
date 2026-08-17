export type OpeningKind = "door" | "window" | "passage";
export type PrimerScope = "none" | "spot" | "full";
export type ProductUse = "primer" | "wall" | "ceiling" | "trim" | "specialty";

export interface Opening {
  id: string;
  kind: OpeningKind;
  quantity: number;
  width: number; // ft
  height: number; // ft
  paintSlab: boolean; // paint both faces of a door
  casedSides: 0 | 1 | 2;
}

export interface RoomScope {
  walls: boolean;
  ceiling: boolean;
  trim: boolean;
  primer: PrimerScope;
}

export interface Room {
  id: string;
  name: string;
  floor: number;
  quantity: number;
  // 2 entries (rectangular, mirrored: [a, b]) or 4. A 4-entry array MUST be
  // ordered [a, b, a, b] — alternating opposite sides — not grouped pairs
  // like [a, a, b, b]. geometry.ts derives ceilingArea as walls[0] * walls[1],
  // which depends on this ordering; grouped-pairs order yields a wrong
  // ceiling area.
  walls: number[];
  ceilingHeight: number;
  scope: RoomScope;
  wallProductId: string;
  ceilingProductId: string;
  trimProductId: string;
  openings: Opening[];
}

/** Anything that is not a room: his `Doors & trim` row, a garage door, an elevation. */
export interface CustomSurface {
  id: string;
  name: string;
  area: number;
  rateMinPerSqFt: number;
  productId: string;
  coats: number;
  includeInPrimer: boolean;
}

export interface Coats {
  walls: number;
  trim: number;
  ceilings: number;
  specialty: number;
}

export interface RateProfile {
  laborRate: number; // $/hr
  wallRate: number; // min/sq ft
  ceilingRate: number;
  trimRate: number;
  hoursPerDay: number;
  travelHoursPerDay: number;
  roundRoomHoursUp: boolean;
  wallCoverage: number; // sq ft/gal
  ceilingCoverage: number;
  spotPrimeFraction: number;
  trimGirthFt: number; // converts trim linear ft to area
  coats: Coats;
}

export interface PaintProduct {
  id: string;
  name: string;
  use: ProductUse;
  listPrice: number; // per gallon, always
  actualPrice: number; // per gallon, always
  packSizeGal: number; // display/ordering only — never priced
  coverageOverride?: number;
  priceUpdatedAt: string; // ISO date
}

export interface JobActuals {
  hoursWorked: number;
  gallonsPurchased: Record<string, number>;
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  rooms: Room[];
  customSurfaces: CustomSurface[];
  rateProfile: RateProfile;
  priceBook: PaintProduct[];
  actuals?: JobActuals;
}

// ---------- engine outputs ----------

export interface RoomGeometry {
  roomId: string;
  grossWallArea: number;
  openingArea: number;
  netWallArea: number;
  ceilingArea: number;
  baseboardLinFt: number;
  casingLinFt: number;
  doorSlabArea: number;
  trimArea: number;
}

export interface RoomLabor {
  roomId: string;
  wallHours: number;
  ceilingHours: number;
  trimHours: number;
  totalHours: number;
  billedHours: number;
}

export interface LaborResult {
  rooms: RoomLabor[];
  hoursWorked: number;
  billedRoomHours: number;
  days: number;
  travelHours: number;
  totalBilledHours: number;
  laborCost: number;
}

export interface ProductRequirement {
  productId: string;
  coatedArea: number;
  coats: number;
  coverage: number;
  rawGallons: number;
  gallons: number; // Math.ceil(rawGallons)
}

export interface MaterialsResult {
  requirements: ProductRequirement[];
  totalGallons: number;
}

export interface MaterialLine {
  productId: string;
  name: string;
  gallons: number;
  unitPrice: number;
  lineCost: number;
  listUnitPrice: number;
  listLineCost: number;
}

export interface PricingResult {
  materialLines: MaterialLine[];
  materialCost: number;
  materialCostAtList: number;
  laborCost: number;
  total: number;
}

export type WarningLevel = "error" | "warning" | "info";

export interface Warning {
  level: WarningLevel;
  code: string;
  message: string;
  roomId?: string;
}

export interface Estimate {
  geometry: RoomGeometry[];
  labor: LaborResult;
  materials: MaterialsResult;
  pricing: PricingResult;
  warnings: Warning[];
}

export interface CoverageDrift {
  productId: string;
  name: string;
  isPrimer: boolean;
  assumedCoverage: number;
  realCoverage: number;
  estimatedGallons: number;
  actualGallons: number;
  deltaPct: number; // positive = bought more than estimated
}

export interface CalibrationReport {
  coverage: CoverageDrift[];
  finishGallonsEstimated: number;
  finishGallonsActual: number;
  finishShortfallPct: number;
  finishRealCoverage: number;
  productionRateAssumed: number; // min/sq ft
  productionRateActual: number | null;
}
