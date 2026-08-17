import type {
  CustomSurface,
  LaborResult,
  RateProfile,
  RoomGeometry,
  RoomLabor,
} from "./types";

const hours = (area: number, minPerSqFt: number): number =>
  (area * minPerSqFt) / 60;

export function computeLabor(
  geometry: RoomGeometry[],
  customSurfaces: CustomSurface[],
  rates: RateProfile,
): LaborResult {
  const bill = (h: number) => (rates.roundRoomHoursUp ? Math.ceil(h) : h);

  const roomRows: RoomLabor[] = geometry.map((g) => {
    const wallHours = hours(g.netWallArea, rates.wallRate);
    const ceilingHours = hours(g.ceilingArea, rates.ceilingRate);
    const trimHours = hours(g.trimArea, rates.trimRate);
    const totalHours = wallHours + ceilingHours + trimHours;
    return {
      roomId: g.roomId,
      wallHours,
      ceilingHours,
      trimHours,
      totalHours,
      billedHours: bill(totalHours),
    };
  });

  const customRows: RoomLabor[] = customSurfaces.map((cs) => {
    // Custom surfaces carry their own production rate (rateMinPerSqFt) —
    // that is the entire reason CustomSurface is a separate type from a
    // room's trim: a garage door or an exterior elevation runs at a
    // different rate than interior trim. rates.trimRate governs room trim
    // area only (see roomRows above) and never applies to custom surfaces.
    const totalHours = hours(cs.area, cs.rateMinPerSqFt);
    return {
      roomId: cs.id,
      wallHours: 0,
      ceilingHours: 0,
      trimHours: totalHours,
      totalHours,
      billedHours: bill(totalHours),
    };
  });

  const rows = [...roomRows, ...customRows];
  const hoursWorked = rows.reduce((sum, r) => sum + r.totalHours, 0);
  const billedRoomHours = rows.reduce((sum, r) => sum + r.billedHours, 0);

  // Days come from UNROUNDED hours, matching his K17 = L17/8 → ROUNDUP.
  const days = hoursWorked > 0 ? Math.ceil(hoursWorked / rates.hoursPerDay) : 0;
  const travelHours = days * rates.travelHoursPerDay;
  const totalBilledHours = billedRoomHours + travelHours;

  return {
    rooms: rows,
    hoursWorked,
    billedRoomHours,
    days,
    travelHours,
    totalBilledHours,
    laborCost: totalBilledHours * rates.laborRate,
  };
}
